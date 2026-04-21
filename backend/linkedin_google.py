"""
LinkedIn candidate sourcing via web search (Brave Search API / httpx fallback).
Replaces broken Voyager API scraper with Google/Brave search-based approach.
"""

import os
import re
import json
import sqlite3
import httpx
from datetime import datetime, timedelta
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
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")
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
    # Add columns if missing (for existing DBs)
    for col, default in [("source", "'search'"), ("first_seen_at", "NULL"), ("last_searched_at", "NULL"), ("search_count", "'1'"), ("score_breakdown", "NULL")]:
        try:
            conn.execute(f"ALTER TABLE linkedin_candidates ADD COLUMN {col} TEXT DEFAULT {default}")
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
    """Fallback: try DuckDuckGo HTML, then Google scrape."""
    results = await _search_duckduckgo(query)
    if not results:
        results = await _search_google(query)
    return results


async def _search_duckduckgo(query: str) -> List[Dict]:
    """Scrape DuckDuckGo HTML results."""
    url = "https://html.duckduckgo.com/html/"
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.post(url, data={"q": query}, headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
            })
            if resp.status_code not in (200, 202):
                return []

            results = []
            # Try multiple regex patterns for DuckDuckGo HTML
            # Pattern 1: result__a + result__snippet
            links = re.findall(
                r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>.*?'
                r'<a[^>]+class="result__snippet"[^>]*>(.*?)</a>',
                resp.text,
                re.DOTALL
            )
            # Pattern 2: result-link (newer DDG layout)
            if not links:
                links = re.findall(
                    r'<a[^>]+href="([^"]+)"[^>]*class="[^"]*result-link[^"]*"[^>]*>(.*?)</a>.*?'
                    r'<div[^>]*class="[^"]*result-snippet[^"]*"[^>]*>(.*?)</div>',
                    resp.text,
                    re.DOTALL
                )
            # Pattern 3: generic anchor + uddg param
            if not links:
                for m in re.finditer(r'<a[^>]+href="([^"]*uddg=[^"]+)"[^>]*>(.*?)</a>', resp.text, re.DOTALL):
                    href, title = m.group(1), m.group(2)
                    links.append((href, title, ""))

            for href, title, snippet in links:
                from urllib.parse import unquote
                actual_url = href
                url_match = re.search(r'uddg=([^&]+)', href)
                if url_match:
                    actual_url = unquote(url_match.group(1))

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
        print(f"DuckDuckGo search error: {e}")
        return []


async def _search_google(query: str) -> List[Dict]:
    """Scrape Google search results as last resort."""
    try:
        encoded_q = quote_plus(query)
        url = f"https://www.google.com/search?q={encoded_q}&num=10"
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9",
            })
            if resp.status_code != 200:
                return []

            results = []
            # Extract URLs from Google results
            for m in re.finditer(r'<a[^>]+href="(https?://[^"]*linkedin\.com/in/[^"&]+)"', resp.text):
                profile_url = m.group(1).split("&")[0]
                if profile_url not in [r["url"] for r in results]:
                    # Try to get the title nearby
                    title_match = re.search(
                        r'<h3[^>]*>(.*?)</h3>',
                        resp.text[max(0, m.start()-500):m.end()+200],
                        re.DOTALL
                    )
                    title = re.sub(r'<[^>]+>', '', title_match.group(1)).strip() if title_match else ""
                    results.append({
                        "url": profile_url,
                        "title": title,
                        "description": "",
                    })

            return results
    except Exception as e:
        print(f"Google search error: {e}")
        return []


def score_candidate(candidate: dict) -> tuple:
    """Score a candidate based on profile info and Tokamak alignment.
    
    Returns (score, breakdown_dict).
    Scoring breakdown (max 10.0):
    - Base: 3.0
    - Tokamak domain alignment: up to 3.5 (core blockchain + Tokamak-specific areas)
    - Execution signals: up to 2.0 (experience level, languages)
    - Contactability: up to 1.5 (open to work, hireable)
    """
    score = 3.0
    breakdown = {"base": 3.0}

    headline = (candidate.get("headline") or "").lower()
    bio = (candidate.get("raw_data") or "").lower()
    combined = headline + " " + bio

    # --- Tokamak Domain Alignment (max 3.5) ---
    alignment = 0.0
    matched_domains = []
    
    core_terms = ["layer 2", "l2", "rollup", "zk", "zero knowledge", "evm",
                  "ethereum", "smart contract", "solidity"]
    core_hits = [t for t in core_terms if t in combined]
    alignment += min(2.0, len(core_hits) * 0.5)
    matched_domains.extend(core_hits)
    
    domain_terms = {
        "staking": 0.3, "defi": 0.3, "dao": 0.3, "governance": 0.3,
        "bridge": 0.3, "cross-chain": 0.3, "nft": 0.2,
        "ai agent": 0.3, "ai tooling": 0.3,
        "protocol": 0.2, "node": 0.2, "validator": 0.2,
    }
    for term, weight in domain_terms.items():
        if term in combined:
            alignment += weight
            matched_domains.append(term)
    alignment = min(3.5, alignment)
    score += alignment
    breakdown["alignment"] = round(alignment, 1)
    breakdown["alignment_terms"] = matched_domains

    # --- Execution Signals (max 2.0) ---
    execution = 0.0
    exec_details = []
    
    if any(w in headline for w in ["lead", "senior", "principal", "architect", "founder", "cto"]):
        execution += 0.5
        exec_details.append("seniority")
    
    tokamak_langs = {"typescript": 0.2, "javascript": 0.1, "solidity": 0.3, 
                     "rust": 0.2, "python": 0.2, "go": 0.2, "circom": 0.3}
    matched_langs = []
    for lang, weight in tokamak_langs.items():
        if lang in combined:
            execution += weight
            matched_langs.append(lang)
    execution = min(2.0, execution)
    score += execution
    breakdown["execution"] = round(execution, 1)
    if exec_details:
        breakdown["execution_details"] = exec_details
    if matched_langs:
        breakdown["languages"] = matched_langs

    # --- Contactability (max 1.5) ---
    contact = 0.0
    contact_details = []
    if candidate.get("open_to_work"):
        contact += 1.0
        contact_details.append("open_to_work")
    
    if any(w in headline for w in ["audit", "security", "formal verification"]):
        contact += 0.5
        contact_details.append("security_niche")
    contact = min(1.5, contact)
    score += contact
    breakdown["contactability"] = round(contact, 1)
    if contact_details:
        breakdown["contact_details"] = contact_details

    final_score = min(round(score, 1), 10.0)
    breakdown["total"] = final_score
    return final_score, breakdown


def save_candidate(candidate: dict, score: float, source: str = "search", score_breakdown: str = "") -> bool:
    """Save candidate to database. Preserves status/notes/outreach history on re-search."""
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    try:
        existing = conn.execute(
            "SELECT id, status, notes, created_at, first_seen_at, search_count FROM linkedin_candidates WHERE linkedin_username = ?",
            (candidate["linkedin_username"],)
        ).fetchone()

        now = datetime.utcnow().isoformat()

        if existing:
            # Skip if searched within last 30 days
            last_search = conn.execute(
                "SELECT last_searched_at FROM linkedin_candidates WHERE id = ?", (existing[0],)
            ).fetchone()
            last_ts = last_search[0] if last_search and last_search[0] else existing[3]
            if last_ts and last_ts >= (datetime.utcnow() - timedelta(days=30)).isoformat():
                conn.close()
                return False

            # Re-search after 30 days: update profile info but PRESERVE status/notes/history
            old_status = existing[1] or "discovered"
            old_notes = existing[2] or ""
            first_seen = existing[4] or existing[3] or now
            count = int(existing[5] or 1) + 1

            conn.execute("""
                UPDATE linkedin_candidates SET
                    full_name=?, headline=?, location=?, profile_url=?,
                    open_to_work=?, search_keyword=?, raw_data=?, score=?,
                    source=?, score_breakdown=?, last_searched_at=?, search_count=?
                WHERE id=?
            """, (
                candidate["full_name"], candidate["headline"], candidate["location"],
                candidate["profile_url"], 1 if candidate.get("open_to_work") else 0,
                candidate.get("search_keyword", ""), candidate.get("raw_data", ""),
                score, source, score_breakdown, now, str(count), existing[0],
            ))
            conn.commit()
            return True
        else:
            # New candidate
            conn.execute("""
                INSERT INTO linkedin_candidates
                (linkedin_username, full_name, headline, location, profile_url,
                 open_to_work, search_keyword, raw_data, score, status, created_at,
                 source, score_breakdown, first_seen_at, last_searched_at, search_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'discovered', ?, ?, ?, ?, ?, '1')
            """, (
                candidate["linkedin_username"], candidate["full_name"],
                candidate["headline"], candidate["location"], candidate["profile_url"],
                1 if candidate.get("open_to_work") else 0,
                candidate.get("search_keyword", ""), candidate.get("raw_data", ""),
                score, now, source, score_breakdown, now, now,
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
    saved_ids = []
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

            score, breakdown = score_candidate(candidate)
            candidate["score"] = score
            candidate["score_breakdown"] = json.dumps(breakdown, ensure_ascii=False)
            total_found += 1

            saved = save_candidate(candidate, score, source="search", score_breakdown=json.dumps(breakdown, ensure_ascii=False))
            if saved:
                total_saved += 1
                # Retrieve the saved candidate's ID
                conn = sqlite3.connect(DB_PATH)
                row = conn.execute(
                    "SELECT id FROM linkedin_candidates WHERE linkedin_username = ?",
                    (candidate["linkedin_username"],)
                ).fetchone()
                conn.close()
                if row:
                    saved_ids.append(row[0])

            candidates_list.append(candidate)

    return {
        "total_found": total_found,
        "total_saved": total_saved,
        "saved_ids": saved_ids,
        "candidates": candidates_list,
        "search_method": "brave" if BRAVE_API_KEY else "duckduckgo_fallback",
    }


def get_linkedin_candidates(
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> List[Dict]:
    """Get LinkedIn candidates from DB."""
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")
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
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")
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
