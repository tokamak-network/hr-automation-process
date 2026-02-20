"""
GitHub-based developer sourcing.
Searches GitHub for blockchain/Ethereum developers and adds them as candidates.
More reliable than web scraping search engines.
"""

import os
import re
import json
import sqlite3
import time
from datetime import datetime
from typing import Dict, List, Optional
from dotenv import load_dotenv

load_dotenv()

DB_PATH = os.path.join(os.path.dirname(__file__), "hiring.db")

GITHUB_SEARCH_QUERIES = [
    "solidity ethereum developer",
    "layer 2 rollup engineer",
    "ZK proof blockchain",
    "smart contract security audit",
    "DeFi protocol developer",
    "ethereum rust developer",
    "EVM blockchain developer",
    "solidity developer open to work",
    "blockchain protocol engineer",
    "web3 fullstack developer",
    "optimistic rollup developer",
    "ethereum typescript developer",
]


def _init_db():
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
    try:
        conn.execute("ALTER TABLE linkedin_candidates ADD COLUMN github_url TEXT DEFAULT ''")
    except:
        pass
    conn.commit()
    conn.close()


def score_github_candidate(user_data: dict) -> float:
    """Score a candidate based on GitHub profile."""
    score = 4.0  # base

    bio = (user_data.get("bio") or "").lower()
    
    # Blockchain keywords in bio
    high_value = ["ethereum", "solidity", "layer 2", "l2", "zk", "rollup",
                  "defi", "smart contract", "blockchain", "web3", "evm"]
    keyword_hits = sum(1 for term in high_value if term in bio)
    score += min(2.0, keyword_hits * 0.5)  # Cap keyword bonus at 2.0

    # Seniority signals
    if any(w in bio for w in ["lead", "senior", "principal", "architect", "founder", "cto"]):
        score += 0.5

    # Hireable flag
    if user_data.get("hireable"):
        score += 1.5

    # Activity/reputation
    followers = user_data.get("followers", 0)
    repos = user_data.get("public_repos", 0)
    score += min(1.0, followers / 500)
    score += min(0.5, repos / 50)

    # Language signals
    if any(w in bio for w in ["rust", "typescript", "python", "go"]):
        score += 0.3

    return min(round(score, 1), 10.0)


def save_github_candidate(user_data: dict, score: float, search_query: str) -> bool:
    """Save a GitHub-discovered candidate to linkedin_candidates table."""
    conn = sqlite3.connect(DB_PATH)
    
    # Use GitHub username as linkedin_username if no LinkedIn found
    github_login = user_data["login"]
    linkedin_username = user_data.get("linkedin_username", "")
    
    # Use linkedin username if available, otherwise prefix with "gh_"
    db_username = linkedin_username if linkedin_username else f"gh_{github_login}"
    profile_url = f"https://www.linkedin.com/in/{linkedin_username}" if linkedin_username else f"https://github.com/{github_login}"
    
    headline = user_data.get("bio") or f"GitHub: {user_data.get('public_repos', 0)} repos, {user_data.get('followers', 0)} followers"
    
    try:
        conn.execute("""
            INSERT OR IGNORE INTO linkedin_candidates
            (linkedin_username, full_name, headline, location, profile_url,
             open_to_work, search_keyword, raw_data, score, created_at, source, github_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            db_username,
            user_data.get("name") or github_login,
            headline[:200],
            user_data.get("location") or "",
            profile_url,
            1 if user_data.get("hireable") else 0,
            search_query,
            json.dumps({
                "github": github_login,
                "followers": user_data.get("followers", 0),
                "repos": user_data.get("public_repos", 0),
                "blog": user_data.get("blog", ""),
                "twitter": user_data.get("twitter_username", ""),
            }, ensure_ascii=False)[:2000],
            score,
            datetime.utcnow().isoformat(),
            "github",
            f"https://github.com/{github_login}",
        ))
        conn.commit()
        return conn.total_changes > 0
    except Exception as e:
        print(f"DB save error: {e}")
        return False
    finally:
        conn.close()


async def search_github_developers(
    keywords: Optional[str] = None,
    queries: Optional[List[str]] = None,
    max_per_query: int = 20,
) -> Dict:
    """Search GitHub for blockchain developers."""
    from github import Github
    
    token = os.getenv("GITHUB_TOKEN", "")
    if not token:
        return {"error": "GITHUB_TOKEN not configured"}
    
    _init_db()
    g = Github(token, per_page=max_per_query)
    
    if queries is None:
        if keywords:
            queries = [keywords]
        else:
            queries = GITHUB_SEARCH_QUERIES
    
    total_found = 0
    total_saved = 0
    candidates_list = []
    
    # Track known team members to exclude
    from analyzer import TEAM_MEMBERS
    
    for query in queries:
        try:
            users = g.search_users(query, sort="followers")
            count = 0
            for user in users:
                if count >= max_per_query:
                    break
                if user.login in TEAM_MEMBERS:
                    continue
                
                # Check for LinkedIn in bio/blog
                blog = user.blog or ""
                bio = user.bio or ""
                combined = blog + " " + bio
                linkedin_match = re.search(r'linkedin\.com/in/([a-zA-Z0-9_-]+)', combined)
                
                user_data = {
                    "login": user.login,
                    "name": user.name,
                    "bio": user.bio,
                    "location": user.location,
                    "followers": user.followers,
                    "public_repos": user.public_repos,
                    "hireable": user.hireable,
                    "blog": user.blog,
                    "twitter_username": user.raw_data.get("twitter_username", ""),
                    "linkedin_username": linkedin_match.group(1) if linkedin_match else "",
                }
                
                score = score_github_candidate(user_data)
                total_found += 1
                
                saved = save_github_candidate(user_data, score, query)
                if saved:
                    total_saved += 1
                
                candidates_list.append({
                    "github": user.login,
                    "name": user_data["name"] or user.login,
                    "score": score,
                    "hireable": user.hireable,
                    "linkedin": user_data["linkedin_username"],
                    "followers": user.followers,
                })
                count += 1
                
        except Exception as e:
            print(f"GitHub search error for '{query}': {e}")
            # Rate limit - wait and continue
            if "rate limit" in str(e).lower():
                time.sleep(30)
                continue
    
    return {
        "total_found": total_found,
        "total_saved": total_saved,
        "candidates": candidates_list,
        "search_method": "github_api",
        "queries_searched": len(queries),
    }
