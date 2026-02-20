"""
LinkedIn candidate sourcing via web search (Brave Search API / httpx fallback).
Replaces broken Voyager API scraper with Google/Brave search-based approach.
"""

import os
import re
import json
import sqlite3
import httpx
from datetime import datetime
from typing import List, Dict, Optional
from urllib.parse import quote_plus
from dotenv import load_dotenv

load_dotenv()

DB_PATH = os.path.join(os.path.dirname(__file__), "hiring.db")
BRAVE_API_KEY = os.getenv("BRAVE_API_KEY", "")

DEFAULT_SEARCH_QUERIES = [
    # Core blockchain roles
    'site:linkedin.com/in "ethereum" "solidity" developer',
    'site:linkedin.com/in "layer 2" OR "L2" OR "rollup" engineer',
    'site:linkedin.com/in "ZK" OR "zero knowledge" engineer blockchain',
    'site:linkedin.com/in "smart contract" "auditor" OR "security"',
    'site:linkedin.com/in "DeFi" developer "solidity" OR "rust"',
    'site:linkedin.com/in "blockchain protocol" engineer',
    'site:linkedin.com/in "ethereum" "rust" OR "typescript" developer open to work',
    # Additional sourcing queries for broader coverage
    'site:linkedin.com/in "solidity" "senior" engineer',
    'site:linkedin.com/in "ethereum" "full stack" developer blockchain',
    'site:linkedin.com/in "web3" developer "smart contract"',
    'site:linkedin.com/in "optimistic rollup" OR "optimism" OR "arbitrum" engineer',
    'site:linkedin.com/in "tokamak" OR "titan" blockchain',
    'site:linkedin.com/in "EVM" developer "solidity"',
    'site:linkedin.com/in "blockchain" "rust" engineer open to work',
    'site:linkedin.com/in "solidity" developer "open to work"',
    'site:linkedin.com/in "DeFi" protocol engineer',
    'site:linkedin.com/in "ethereum" developer Korea OR Seoul',
    'site:linkedin.com/in "blockchain" developer Korea OR 한국',
]


def init_linkedin_db():
    """Ensure linkedin_candidates table exists."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS linkedin_candidates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            linkedin_username TEXT UNIQUE,
            full_name TEXT,
            headline TEXT,
            location TEXT,
            profile_url TEXT,
            open_to_work INTEGER DEFAULT 0,
            current_company TEXT,
            search_keyword TEXT,
            raw_data TEXT,
            score REAL DEFAULT 0,
            status TEXT DEFAULT 'discovered',
            created_at TEXT,
            notes TEXT DEFAULT '',
            source TEXT DEFAULT 'search'
        )
    """)
    # Add source column if missing (for existing DBs)
    try:
        conn.execute("ALTER TABLE linkedin_candidates ADD COLUMN source TEXT DEFAULT 'search'")
    except:
        pass
    conn.commit()
    conn.close()


def parse_linkedin_from_search_result(result: dict, search_query: str) -> Optional[Dict]:
    """Parse a search result into a LinkedIn candidate dict."""
    url = result.get("url", "")
    title = result.get("title", "")
    description = result.get("description", result.get("snippet", ""))

    # Extract LinkedIn username from URL
    match = re.search(r'linkedin\.com/in/([a-zA-Z0-9_-]+)', url)
    if not match:
        return None

    username = match.group(1)

    # Parse name from title (usually "Name - Title - LinkedIn")
    name_parts = title.split(" - ")
    full_name = name_parts[0].strip() if name_parts else ""
    headline = name_parts[1].strip() if len(name_parts) > 1 else ""

    # Try to extract location from description
    location = ""
    loc_match = re.search(r'(?:Location|📍|Based in)\s*[:\s]*([^·|•\n]+)', description, re.IGNORECASE)
    if loc_match:
        location = loc_match.group(1).strip()

    # Check for open to work signals
    combined_text = (title + " " + description).lower()
    open_to_work = any(phrase in combined_text for phrase in [
        "open to work", "seeking", "looking for", "available for",
        "actively seeking", "open for opportunities"
    ])

    if not full_name or full_name.lower() == "linkedin":
        return None

    return {
        "linkedin_username": username,
        "full_name": full_name,
        "headline": headline,
        "location": location,
        "profile_url": f"https://www.linkedin.com/in/{username}",
        "open_to_work": open_to_work,
        "search_keyword": search_query,
        "raw_data": json.dumps(result, ensure_ascii=False, default=str)[:2000],
    }


async def search_brave(query: str, count: int = 10) -> List[Dict]:
    """Search using Brave Search API."""
    if not BRAVE_API_KEY:
        return []

    url = "https://api.search.brave.com/res/v1/web/search"
    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": BRAVE_API_KEY,
    }
    params = {
        "q": query,
        "count": count,
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, headers=headers, params=params)
            if resp.status_code != 200:
                print(f"Brave search failed: {resp.status_code}")
                return []
            data = resp.json()
            return data.get("web", {}).get("results", [])
    except Exception as e:
        print(f"Brave search error: {e}")
        return []


async def search_fallback(query: str) -> List[Dict]:
    """Fallback: scrape DuckDuckGo HTML results (no API key needed)."""
    url = "https://html.duckduckgo.com/html/"
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.post(url, data={"q": query}, headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            })
            if resp.status_code != 200:
                return []

            # Simple regex parsing of DuckDuckGo HTML results
            results = []
            # Find result links
            links = re.findall(
                r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>.*?'
                r'<a[^>]+class="result__snippet"[^>]*>(.*?)</a>',
                resp.text,
                re.DOTALL
            )
            for href, title, snippet in links:
                # DuckDuckGo wraps URLs in a redirect
                actual_url = href
                url_match = re.search(r'uddg=([^&]+)', href)
                if url_match:
                    from urllib.parse import unquote
                    actual_url = unquote(url_match.group(1))

                # Strip HTML tags
                clean_title = re.sub(r'<[^>]+>', '', title).strip()
                clean_snippet = re.sub(r'<[^>]+>', '', snippet).strip()

                if "linkedin.com/in/" in actual_url:
                    results.append({
                        "url": actual_url,
                        "title": clean_title,
                        "description": clean_snippet,
                    })

            return results
    except Exception as e:
        print(f"Fallback search error: {e}")
        return []


def score_candidate(candidate: dict) -> float:
    """Score a candidate based on profile info."""
    score = 5.0

    headline = (candidate.get("headline") or "").lower()

    high_value = ["ethereum", "solidity", "layer 2", "l2", "zk", "rollup",
                  "defi", "smart contract", "blockchain protocol"]
    for term in high_value:
        if term in headline:
            score += 1.0

    if any(w in headline for w in ["lead", "senior", "principal", "architect", "founder", "cto"]):
        score += 0.5

    if candidate.get("open_to_work"):
        score += 1.5

    if any(w in headline for w in ["rust", "typescript", "python"]):
        score += 0.3

    if any(w in headline for w in ["audit", "security", "formal verification"]):
        score += 0.5

    return min(score, 10.0)


def save_candidate(candidate: dict, score: float, source: str = "search") -> bool:
    """Save candidate to database."""
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("""
            INSERT OR IGNORE INTO linkedin_candidates
            (linkedin_username, full_name, headline, location, profile_url,
             open_to_work, search_keyword, raw_data, score, created_at, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            candidate["linkedin_username"],
            candidate["full_name"],
            candidate["headline"],
            candidate["location"],
            candidate["profile_url"],
            1 if candidate.get("open_to_work") else 0,
            candidate.get("search_keyword", ""),
            candidate.get("raw_data", ""),
            score,
            datetime.utcnow().isoformat(),
            source,
        ))
        conn.commit()
        return conn.total_changes > 0
    except Exception as e:
        print(f"DB error: {e}")
        return False
    finally:
        conn.close()


async def search_linkedin_candidates(
    keywords: Optional[str] = None,
    queries: Optional[List[str]] = None,
) -> Dict:
    """Main search function. Uses Brave API if available, falls back to DuckDuckGo."""
    init_linkedin_db()

    if queries is None:
        if keywords:
            queries = [f'site:linkedin.com/in "{keywords}" developer']
        else:
            queries = DEFAULT_SEARCH_QUERIES

    total_found = 0
    total_saved = 0
    candidates_list = []

    for query in queries:
        # Try Brave first, then fallback
        if BRAVE_API_KEY:
            results = await search_brave(query)
        else:
            results = await search_fallback(query)

        for result in results:
            candidate = parse_linkedin_from_search_result(result, query)
            if not candidate:
                continue

            score = score_candidate(candidate)
            candidate["score"] = score
            total_found += 1

            saved = save_candidate(candidate, score, source="search")
            if saved:
                total_saved += 1

            candidates_list.append(candidate)

    return {
        "total_found": total_found,
        "total_saved": total_saved,
        "candidates": candidates_list,
        "search_method": "brave" if BRAVE_API_KEY else "duckduckgo_fallback",
    }


def get_linkedin_candidates(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Dict]:
    """Get LinkedIn candidates from DB."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    query = "SELECT * FROM linkedin_candidates"
    params = []
    if status:
        query += " WHERE status = ?"
        params.append(status)
    query += " ORDER BY score DESC, open_to_work DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_candidate_status(candidate_id: int, status: str, notes: str = "") -> bool:
    """Update candidate status."""
    conn = sqlite3.connect(DB_PATH)
    try:
        if notes:
            conn.execute(
                "UPDATE linkedin_candidates SET status = ?, notes = ? WHERE id = ?",
                (status, notes, candidate_id)
            )
        else:
            conn.execute(
                "UPDATE linkedin_candidates SET status = ? WHERE id = ?",
                (status, candidate_id)
            )
        conn.commit()
        return conn.total_changes > 0
    finally:
        conn.close()
