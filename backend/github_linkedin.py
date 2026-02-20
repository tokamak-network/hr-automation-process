"""
GitHub-to-LinkedIn Bridge.
Finds LinkedIn profiles for GitHub candidates by searching their real name + skills.
"""

import os
import re
import json
import sqlite3
import httpx
from typing import Optional, Dict, List
from dotenv import load_dotenv

load_dotenv()

DB_PATH = os.path.join(os.path.dirname(__file__), "hiring.db")
BRAVE_API_KEY = os.getenv("BRAVE_API_KEY", "")


async def find_linkedin_for_github_user(name: str, location: str = "", bio: str = "") -> Optional[Dict]:
    """Search for a LinkedIn profile matching a GitHub user's name."""
    if not name or name.strip() == "":
        return None

    # Build search query
    query_parts = [f'site:linkedin.com/in "{name}"']
    if location:
        query_parts.append(f'"{location}"')
    if bio:
        # Extract key terms from bio
        for term in ["developer", "engineer", "blockchain", "ethereum", "solidity"]:
            if term.lower() in bio.lower():
                query_parts.append(term)
                break

    query = " ".join(query_parts)

    # Search
    results = await _search(query)

    for result in results:
        url = result.get("url", "")
        title = result.get("title", "")

        match = re.search(r'linkedin\.com/in/([a-zA-Z0-9_-]+)', url)
        if not match:
            continue

        username = match.group(1)

        # Check if name matches (fuzzy)
        result_name = title.split(" - ")[0].strip().lower()
        search_name = name.lower()

        # Simple name matching: check if any part of the name matches
        name_words = set(search_name.split())
        result_words = set(result_name.split())
        overlap = name_words & result_words

        if len(overlap) >= 1 or search_name in result_name or result_name in search_name:
            headline = ""
            parts = title.split(" - ")
            if len(parts) > 1:
                headline = parts[1].strip()

            return {
                "linkedin_username": username,
                "profile_url": f"https://www.linkedin.com/in/{username}",
                "full_name": title.split(" - ")[0].strip(),
                "headline": headline,
            }

    return None


async def _search(query: str) -> List[Dict]:
    """Search using Brave or DuckDuckGo."""
    if BRAVE_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(
                    "https://api.search.brave.com/res/v1/web/search",
                    headers={
                        "Accept": "application/json",
                        "X-Subscription-Token": BRAVE_API_KEY,
                    },
                    params={"q": query, "count": 5},
                )
                if resp.status_code == 200:
                    return resp.json().get("web", {}).get("results", [])
        except:
            pass

    # DuckDuckGo fallback
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.post(
                "https://html.duckduckgo.com/html/",
                data={"q": query},
                headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"},
            )
            if resp.status_code != 200:
                return []

            results = []
            links = re.findall(
                r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
                resp.text, re.DOTALL
            )
            for href, title in links:
                from urllib.parse import unquote
                actual_url = href
                url_match = re.search(r'uddg=([^&]+)', href)
                if url_match:
                    actual_url = unquote(url_match.group(1))

                clean_title = re.sub(r'<[^>]+>', '', title).strip()
                if "linkedin.com/in/" in actual_url:
                    results.append({"url": actual_url, "title": clean_title})

            return results
    except:
        return []


async def bridge_github_candidates() -> Dict:
    """Find LinkedIn profiles for existing GitHub monitor candidates."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # Get GitHub candidates that don't have a linked LinkedIn yet
    rows = conn.execute("""
        SELECT mc.github_username, mc.bio, mc.profile_url
        FROM monitor_candidates mc
        WHERE mc.github_username NOT IN (
            SELECT COALESCE(linkedin_username, '') FROM linkedin_candidates
        )
        LIMIT 20
    """).fetchall()
    conn.close()

    linked = 0
    for row in rows:
        username = row["github_username"]
        bio = row["bio"] or ""

        # Try to get real name from GitHub API
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                token = os.getenv("GITHUB_TOKEN", "")
                headers = {}
                if token:
                    headers["Authorization"] = f"token {token}"
                resp = await client.get(
                    f"https://api.github.com/users/{username}",
                    headers=headers,
                )
                if resp.status_code == 200:
                    user_data = resp.json()
                    real_name = user_data.get("name", "")
                    location = user_data.get("location", "")
                else:
                    continue
        except:
            continue

        if not real_name:
            continue

        result = await find_linkedin_for_github_user(real_name, location, bio)
        if result:
            from linkedin_google import save_candidate, score_candidate, init_linkedin_db
            init_linkedin_db()

            candidate = {
                "linkedin_username": result["linkedin_username"],
                "full_name": result["full_name"],
                "headline": result.get("headline", ""),
                "location": location,
                "profile_url": result["profile_url"],
                "open_to_work": False,
                "search_keyword": f"github:{username}",
            }
            score = score_candidate(candidate)
            save_candidate(candidate, score, source="github_bridge")
            linked += 1

    return {"candidates_checked": len(rows), "linkedin_profiles_found": linked}
