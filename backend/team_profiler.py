"""
Team Profiler — auto-detect expertise from GitHub activity.
Scans tokamak-network org repos and builds skill profiles for team members.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from collections import Counter, defaultdict
from typing import Dict, List, Any, Optional, Set, Tuple

from github import Github, GithubException

logger = logging.getLogger(__name__)

# Repo name / topic keywords → expertise areas
REPO_DOMAIN_MAP = {
    "titan": ["l2", "protocol", "rollup"],
    "optimism": ["l2", "protocol", "rollup"],
    "tokamak-optimism": ["l2", "protocol", "rollup"],
    "rollup": ["l2", "rollup"],
    "bridge": ["bridge", "cross-chain"],
    "token": ["tokenomics", "smart-contracts"],
    "ton": ["tokenomics", "ton"],
    "staking": ["staking", "defi", "smart-contracts"],
    "plasma": ["plasma", "l2", "protocol"],
    "dao": ["dao", "governance"],
    "vault": ["defi", "smart-contracts"],
    "swap": ["defi", "dex"],
    "nft": ["nft"],
    "sdk": ["sdk", "tooling"],
    "cli": ["tooling", "devops"],
    "dashboard": ["frontend", "dashboard"],
    "explorer": ["frontend", "explorer"],
    "interface": ["frontend", "ui"],
    "contracts": ["smart-contracts", "solidity"],
    "audit": ["security", "audit"],
    "security": ["security", "audit"],
}

# Language → expertise areas
LANG_EXPERTISE_MAP = {
    "Solidity": ["solidity", "smart-contracts", "ethereum"],
    "TypeScript": ["typescript", "fullstack"],
    "JavaScript": ["javascript", "fullstack"],
    "Python": ["python"],
    "Go": ["go", "protocol"],
    "Rust": ["rust", "protocol"],
    "C++": ["cpp", "low-level"],
    "Java": ["java"],
    "Shell": ["devops", "ops"],
    "Dockerfile": ["devops", "docker"],
}

# Topic keywords from repo topics
TOPIC_EXPERTISE_MAP = {
    "ethereum": ["ethereum"],
    "solidity": ["solidity", "smart-contracts"],
    "l2": ["l2"],
    "layer2": ["l2"],
    "rollup": ["rollup", "l2"],
    "bridge": ["bridge", "cross-chain"],
    "defi": ["defi"],
    "nft": ["nft"],
    "react": ["frontend", "react"],
    "nextjs": ["frontend", "react"],
    "typescript": ["typescript"],
    "smart-contract": ["smart-contracts"],
    "security": ["security"],
}


def _match_repo_domains(repo_name: str, topics: List[str], description: str) -> List[str]:
    """Infer expertise domains from repo name, topics, and description."""
    domains = []
    name_lower = repo_name.lower()

    for keyword, areas in REPO_DOMAIN_MAP.items():
        if keyword in name_lower:
            domains.extend(areas)

    for topic in topics:
        t = topic.lower()
        if t in TOPIC_EXPERTISE_MAP:
            domains.extend(TOPIC_EXPERTISE_MAP[t])

    desc_lower = (description or "").lower()
    for keyword, areas in REPO_DOMAIN_MAP.items():
        if keyword in desc_lower:
            domains.extend(areas)

    return domains


def _langs_to_expertise(languages: Dict[str, int]) -> Dict[str, float]:
    """Convert language commit counts to expertise scores."""
    if not languages:
        return {}
    total = sum(languages.values())
    if total == 0:
        return {}

    expertise = defaultdict(float)
    for lang, count in languages.items():
        weight = count / total
        for area in LANG_EXPERTISE_MAP.get(lang, []):
            expertise[area] = max(expertise[area], weight)
    return dict(expertise)


async def scan_org_profiles(db) -> Dict[str, Any]:
    """Scan tokamak-network org and build team profiles."""
    token = os.getenv("GITHUB_TOKEN", "")
    if not token:
        return {"error": "GITHUB_TOKEN not configured"}

    g = Github(token, per_page=100)

    try:
        org = g.get_organization("tokamak-network")
    except GithubException as e:
        return {"error": "Failed to access org: {}".format(str(e))}

    # Collect all org members + known team members
    from analyzer import TEAM_MEMBERS
    known_members = set(TEAM_MEMBERS)

    try:
        for member in org.get_members():
            known_members.add(member.login)
    except Exception:
        pass

    # Scan repos and collect per-member activity
    member_data = defaultdict(lambda: {
        "commits": Counter(),       # repo_name -> commit count
        "languages": Counter(),     # language -> file count
        "repo_languages": defaultdict(Counter),  # repo -> lang -> count
        "review_count": 0,
        "domains": Counter(),       # expertise domain -> weight
        "last_active": None,
        "repos_detail": [],
    })

    six_months_ago = datetime.utcnow() - timedelta(days=180)
    repos_scanned = 0

    try:
        all_repos = list(org.get_repos(sort="updated", type="all"))[:50]  # Limit to 50 most recent repos for speed
    except Exception as e:
        return {"error": "Failed to list repos: {}".format(str(e))}
    
    logger.info("Scanning {} repos for team profiles".format(len(all_repos)))

    for repo in all_repos:
        repos_scanned += 1
        repo_name = repo.name
        topics = []
        try:
            topics = repo.get_topics()
        except Exception:
            pass
        description = repo.description or ""
        repo_domains = _match_repo_domains(repo_name, topics, description)

        # Get repo languages
        try:
            repo_langs = repo.get_languages()  # {lang: bytes}
        except Exception:
            repo_langs = {}

        primary_lang = repo.language or ""

        # Scan contributors
        try:
            for contrib in repo.get_contributors():
                login = contrib.login
                if login not in known_members:
                    continue
                count = contrib.contributions
                member_data[login]["commits"][repo_name] += count

                # Attribute repo languages weighted by contribution
                for lang in repo_langs:
                    member_data[login]["languages"][lang] += count
                    member_data[login]["repo_languages"][repo_name][lang] += count

                # Domain inference
                for domain in repo_domains:
                    member_data[login]["domains"][domain] += count

                # Also add language-based domains
                for lang in repo_langs:
                    for area in LANG_EXPERTISE_MAP.get(lang, []):
                        member_data[login]["domains"][area] += count
        except Exception as e:
            logger.warning("Failed to get contributors for {}: {}".format(repo_name, e))

        # Skip PR review scanning for speed (too many API calls)
        # Reviews can be added in a separate background job later

    # Now build profiles and store in DB
    profiles_created = 0
    now = datetime.utcnow().isoformat()

    for username, data in member_data.items():
        if not data["commits"]:
            continue

        # Get user info
        try:
            user = g.get_user(username)
            display_name = user.name or username
            avatar_url = user.avatar_url or ""
        except Exception:
            display_name = username
            avatar_url = ""

        # Build expertise_areas with normalized scores
        domain_counts = data["domains"]
        if domain_counts:
            max_count = max(domain_counts.values())
            expertise_areas = {}
            for domain, count in domain_counts.most_common(15):
                expertise_areas[domain] = round(count / max_count, 2)
        else:
            expertise_areas = {}

        # Top repos
        top_repos = []
        for repo_name, commit_count in data["commits"].most_common(10):
            repo_langs = data["repo_languages"].get(repo_name, {})
            primary = max(repo_langs, key=repo_langs.get) if repo_langs else ""
            top_repos.append({
                "name": repo_name,
                "commits": commit_count,
                "language": primary,
            })

        # Languages
        languages = dict(data["languages"].most_common(10))

        # Last active: use most recent commit info (approximate)
        last_active = now  # We don't have exact dates without expensive API calls

        await db.execute("""
            INSERT INTO team_profiles (github_username, display_name, avatar_url, expertise_areas, top_repos, languages, review_count, last_active, last_profiled, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            ON CONFLICT(github_username) DO UPDATE SET
                display_name=excluded.display_name,
                avatar_url=excluded.avatar_url,
                expertise_areas=excluded.expertise_areas,
                top_repos=excluded.top_repos,
                languages=excluded.languages,
                review_count=excluded.review_count,
                last_active=excluded.last_active,
                last_profiled=excluded.last_profiled,
                is_active=excluded.is_active
        """, (
            username, display_name, avatar_url,
            json.dumps(expertise_areas),
            json.dumps(top_repos),
            json.dumps(languages),
            data["review_count"],
            last_active, now,
        ))
        profiles_created += 1

    await db.commit()

    return {
        "repos_scanned": repos_scanned,
        "members_found": len(known_members),
        "profiles_created": profiles_created,
    }
