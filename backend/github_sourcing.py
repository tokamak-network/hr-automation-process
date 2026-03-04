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
import requests
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


def score_github_candidate(user_data: dict) -> tuple:
    """Score a candidate based on GitHub profile and Tokamak alignment.
    
    Returns (score, breakdown_dict).
    """
    score = 2.5
    breakdown = {"base": 2.5}

    bio = (user_data.get("bio") or "").lower()
    blog = (user_data.get("blog") or "").lower()
    combined = bio + " " + blog

    # --- Tokamak Domain Alignment (max 3.5) ---
    alignment = 0.0
    matched_domains = []
    
    core_terms = ["ethereum", "solidity", "layer 2", "l2", "zk", "zero knowledge",
                  "rollup", "evm", "smart contract", "blockchain", "web3"]
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

    # --- GitHub Activity & Execution (max 2.5) ---
    execution = 0.0
    exec_details = []
    matched_langs = []
    
    if any(w in bio for w in ["lead", "senior", "principal", "architect", "founder", "cto"]):
        execution += 0.5
        exec_details.append("seniority")
    
    followers = user_data.get("followers", 0)
    repos = user_data.get("public_repos", 0)
    execution += min(0.8, followers / 500)
    execution += min(0.4, repos / 50)
    if followers > 0:
        exec_details.append(f"{followers} followers")
    if repos > 0:
        exec_details.append(f"{repos} repos")
    
    tokamak_langs = {"typescript": 0.2, "solidity": 0.3, "rust": 0.2, 
                     "python": 0.2, "go": 0.2, "circom": 0.3}
    for lang, weight in tokamak_langs.items():
        if lang in combined:
            execution += weight
            matched_langs.append(lang)
    execution = min(2.5, execution)
    score += execution
    breakdown["execution"] = round(execution, 1)
    if exec_details:
        breakdown["execution_details"] = exec_details
    if matched_langs:
        breakdown["languages"] = matched_langs

    # --- Contactability (max 1.5) ---
    contact = 0.0
    contact_details = []
    if user_data.get("hireable"):
        contact += 1.0
        contact_details.append("hireable")
    if user_data.get("linkedin_username"):
        contact += 0.5
        contact_details.append("has_linkedin")
    contact = min(1.5, contact)
    score += contact
    breakdown["contactability"] = round(contact, 1)
    if contact_details:
        breakdown["contact_details"] = contact_details

    final_score = min(round(score, 1), 10.0)
    breakdown["total"] = final_score
    return final_score, breakdown


def save_github_candidate(user_data: dict, score: float, search_query: str, score_breakdown: str = "") -> bool:
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
        # Skip if same candidate was found within last 30 days
        existing = conn.execute(
            "SELECT created_at FROM linkedin_candidates WHERE linkedin_username = ? AND created_at >= datetime('now', '-30 days')",
            (db_username,)
        ).fetchone()
        if existing:
            conn.close()
            return False
        
        conn.execute("""
            INSERT OR REPLACE INTO linkedin_candidates
            (linkedin_username, full_name, headline, location, profile_url,
             open_to_work, search_keyword, raw_data, score, created_at, source, github_url, score_breakdown)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            score_breakdown,
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
    saved_ids = []
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
                
                # Check for LinkedIn in bio/blog/social accounts
                blog = user.blog or ""
                bio = user.bio or ""
                combined = blog + " " + bio
                linkedin_match = re.search(r'linkedin\.com/in/([a-zA-Z0-9_-]+)', combined)
                
                # If not found in bio/blog, check GitHub social accounts API
                if not linkedin_match:
                    try:
                        headers = {"Authorization": f"token {os.environ.get('GITHUB_TOKEN', '')}"}
                        social_resp = requests.get(
                            f"https://api.github.com/users/{user.login}/social_accounts",
                            headers=headers, timeout=10
                        )
                        if social_resp.status_code == 200:
                            for acct in social_resp.json():
                                if acct.get("provider") == "linkedin" or "linkedin.com/in/" in (acct.get("url") or ""):
                                    lm = re.search(r'linkedin\.com/in/([a-zA-Z0-9_-]+)', acct["url"])
                                    if lm:
                                        linkedin_match = lm
                                        break
                    except Exception:
                        pass
                
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
                
                score, breakdown = score_github_candidate(user_data)
                total_found += 1
                
                saved = save_github_candidate(user_data, score, query, score_breakdown=json.dumps(breakdown, ensure_ascii=False))
                if saved:
                    total_saved += 1
                    # Retrieve saved candidate ID using same db_username logic
                    linkedin_un = user_data.get("linkedin_username", "")
                    db_un = linkedin_un if linkedin_un else f"gh_{user.login}"
                    conn2 = sqlite3.connect(DB_PATH)
                    row = conn2.execute(
                        "SELECT id FROM linkedin_candidates WHERE linkedin_username = ?",
                        (db_un,)
                    ).fetchone()
                    conn2.close()
                    if row:
                        saved_ids.append(row[0])
                
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
        "saved_ids": saved_ids,
        "candidates": candidates_list,
        "search_method": "github_api",
        "queries_searched": len(queries),
    }
