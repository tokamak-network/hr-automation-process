"""
LinkedIn Candidate Scraper for Tokamak Network hiring.
Scrapes LinkedIn search results using session cookie (li_at).
"""

import os
import json
import time
import random
import sqlite3
import httpx
from urllib.parse import quote
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

LINKEDIN_COOKIE = os.getenv("LINKEDIN_COOKIE", "")
DB_PATH = os.path.join(os.path.dirname(__file__), "hiring.db")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "application/vnd.linkedin.normalized+json+2.1",
    "Accept-Language": "en-US,en;q=0.9",
    "x-li-lang": "en_US",
    "x-restli-protocol-version": "2.0.0",
    "x-li-track": '{"clientVersion":"1.13.8860","mpVersion":"1.13.8860","osName":"web","timezoneOffset":9,"timezone":"Asia/Seoul","deviceFormFactor":"DESKTOP","mpName":"voyager-web","displayDensity":2}',
    "csrf-token": "ajax:0",
    "cookie": f"li_at={LINKEDIN_COOKIE}; JSESSIONID=\"ajax:0\"",
}

SEARCH_KEYWORDS = [
    "Ethereum developer",
    "Layer 2 engineer",
    "Solidity developer",
    "ZK engineer",
    "Rollup developer",
    "Smart contract auditor",
    "Blockchain protocol engineer",
    "DeFi developer",
]

# LinkedIn Voyager API for people search
SEARCH_URL = "https://www.linkedin.com/voyager/api/graphql?variables=(start:{start},origin:GLOBAL_SEARCH_HEADER,query:(keywords:{keywords},flagshipSearchIntent:SEARCH_SRP,queryParameters:List((key:resultType,value:List(PEOPLE)){open_to_work}),includeFiltersInResponse:false))&queryId=voyagerSearchDashClusters.7e12b8e5fb86d1a01237d82e83e1bc67"

PROFILE_URL = "https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity={username}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.WebTopCardCore-21"


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
            notes TEXT DEFAULT ''
        )
    """)
    conn.commit()
    conn.close()


def search_linkedin(keyword: str, start: int = 0) -> list:
    """Search LinkedIn for people matching keyword."""
    open_to_work_filter = ""  # Can add filter later
    
    url = SEARCH_URL.format(
        start=start,
        keywords=quote(keyword),
        open_to_work=open_to_work_filter
    )
    
    try:
        with httpx.Client(timeout=30, follow_redirects=True) as client:
            resp = client.get(url, headers=HEADERS)
            if resp.status_code == 429:
                print(f"  ⚠️ Rate limited. Waiting 60s...")
                time.sleep(60)
                return []
            if resp.status_code != 200:
                print(f"  ❌ Search failed: {resp.status_code}")
                return []
            
            data = resp.json()
            return parse_search_results(data, keyword)
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return []


def parse_search_results(data: dict, keyword: str) -> list:
    """Parse LinkedIn Voyager search response."""
    candidates = []
    
    included = data.get("included", [])
    
    for item in included:
        # Look for profile entities
        if item.get("$type") == "com.linkedin.voyager.dash.search.EntityResultViewModel":
            title = item.get("title", {})
            name = title.get("text", "")
            
            primary_subtitle = item.get("primarySubtitle", {})
            headline = primary_subtitle.get("text", "")
            
            secondary_subtitle = item.get("secondarySubtitle", {})
            location = secondary_subtitle.get("text", "")
            
            # Extract username from navigation URL
            nav_url = item.get("navigationUrl", "")
            username = ""
            if "/in/" in nav_url:
                username = nav_url.split("/in/")[1].split("?")[0].split("/")[0]
            
            if not username or not name:
                continue
            
            # Check for "Open to Work" badge
            open_to_work = False
            badge_text = item.get("badgeText", {})
            if badge_text and "open" in str(badge_text).lower():
                open_to_work = True
            
            # Also check insightText for open to work
            insight = item.get("insightText", {})
            if insight and "open" in str(insight).lower():
                open_to_work = True
            
            candidates.append({
                "linkedin_username": username,
                "full_name": name,
                "headline": headline,
                "location": location,
                "profile_url": f"https://www.linkedin.com/in/{username}",
                "open_to_work": open_to_work,
                "search_keyword": keyword,
                "raw_data": json.dumps(item, ensure_ascii=False, default=str)[:2000],
            })
    
    return candidates


def score_candidate(candidate: dict) -> float:
    """Simple scoring based on profile info."""
    score = 5.0  # Base score
    
    headline = (candidate.get("headline") or "").lower()
    
    # Blockchain/Ethereum relevance
    high_value_terms = ["ethereum", "solidity", "layer 2", "l2", "zk", "rollup", "defi", "smart contract", "blockchain protocol"]
    for term in high_value_terms:
        if term in headline:
            score += 1.0
    
    # Leadership/senior signals
    if any(w in headline for w in ["lead", "senior", "principal", "architect", "founder", "cto"]):
        score += 0.5
    
    # Open to work bonus
    if candidate.get("open_to_work"):
        score += 1.5
    
    # Specific tech signals
    if any(w in headline for w in ["rust", "typescript", "python"]):
        score += 0.3
    
    if any(w in headline for w in ["audit", "security", "formal verification"]):
        score += 0.5
    
    return min(score, 10.0)


def save_candidate(candidate: dict, score: float):
    """Save candidate to database."""
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("""
            INSERT OR IGNORE INTO linkedin_candidates 
            (linkedin_username, full_name, headline, location, profile_url, 
             open_to_work, search_keyword, raw_data, score, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            candidate["linkedin_username"],
            candidate["full_name"],
            candidate["headline"],
            candidate["location"],
            candidate["profile_url"],
            1 if candidate["open_to_work"] else 0,
            candidate["search_keyword"],
            candidate.get("raw_data", ""),
            score,
            datetime.utcnow().isoformat(),
        ))
        conn.commit()
        return True
    except Exception as e:
        print(f"  DB error: {e}")
        return False
    finally:
        conn.close()


def get_top_candidates(limit: int = 10) -> list:
    """Get top candidates sorted by score."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT * FROM linkedin_candidates ORDER BY open_to_work DESC, score DESC LIMIT ?",
        (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def run_scraper():
    """Main scraper function."""
    print("🚀 Tokamak LinkedIn Candidate Scraper")
    print("=" * 50)
    
    if not LINKEDIN_COOKIE:
        print("❌ LINKEDIN_COOKIE not set in .env")
        return
    
    init_linkedin_db()
    
    total_found = 0
    total_saved = 0
    
    for keyword in SEARCH_KEYWORDS:
        print(f"\n🔍 Searching: '{keyword}'")
        
        candidates = search_linkedin(keyword, start=0)
        print(f"  Found {len(candidates)} profiles")
        
        for c in candidates:
            score = score_candidate(c)
            saved = save_candidate(c, score)
            if saved:
                total_saved += 1
                otw = "🟢 Open to Work" if c["open_to_work"] else ""
                print(f"  ✅ {c['full_name']} ({c['headline'][:60]}) — Score: {score:.1f} {otw}")
            total_found += 1
        
        # Rate limiting: 7-12 seconds between searches
        wait = random.uniform(7, 12)
        print(f"  ⏳ Waiting {wait:.0f}s...")
        time.sleep(wait)
    
    print(f"\n{'=' * 50}")
    print(f"📊 Total found: {total_found}, New saved: {total_saved}")
    
    # Print top 10
    print(f"\n🏆 Top 10 Candidates:")
    print("-" * 80)
    top = get_top_candidates(10)
    for i, c in enumerate(top, 1):
        otw = "🟢" if c["open_to_work"] else "  "
        print(f"{i:2}. {otw} [{c['score']:.1f}] {c['full_name']}")
        print(f"     {c['headline'][:70]}")
        print(f"     📍 {c['location']} | {c['profile_url']}")
        print()


if __name__ == "__main__":
    run_scraper()
