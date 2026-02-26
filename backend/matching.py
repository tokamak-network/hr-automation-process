"""
Team-Candidate Matching Engine.
Calculates match scores between candidates and team members
based on skill overlap and expertise areas.
"""

import json
import sqlite3
import os
import re
from typing import Dict, List, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "hiring.db")

# Skill extraction keywords
SKILL_KEYWORDS = {
    "solidity": ["solidity", "smart contract", "evm"],
    "typescript": ["typescript", "ts"],
    "javascript": ["javascript", "js", "node"],
    "python": ["python"],
    "rust": ["rust"],
    "go": ["go", "golang"],
    "react": ["react", "next.js", "nextjs"],
    "ethereum": ["ethereum", "eth", "eip"],
    "l2": ["layer 2", "l2", "rollup", "optimistic", "zk-rollup"],
    "zk": ["zk", "zero knowledge", "zero-knowledge", "snark", "stark", "plonk", "circom"],
    "defi": ["defi", "dex", "amm", "lending", "staking", "swap"],
    "smart-contracts": ["smart contract", "erc20", "erc721", "erc1155", "openzeppelin"],
    "bridge": ["bridge", "cross-chain", "crosschain"],
    "devops": ["devops", "ci/cd", "docker", "kubernetes", "k8s"],
    "protocol": ["protocol", "consensus", "p2p", "networking"],
    "tokenomics": ["tokenomics", "token", "governance", "dao", "voting"],
    "staking": ["staking", "validator", "delegation"],
    "nft": ["nft", "erc721", "erc1155", "metadata"],
    "ai": ["ai", "machine learning", "ml", "llm", "agent"],
    "fullstack": ["fullstack", "full-stack", "frontend", "backend", "api"],
    "security": ["security", "audit", "vulnerability", "exploit"],
    "docker": ["docker", "container", "dockerfile"],
    "testing": ["test", "testing", "hardhat", "foundry", "forge"],
}


def extract_skills_from_text(text: str) -> Dict[str, float]:
    """Extract skill scores from free text (description, repo analysis, etc.)."""
    if not text:
        return {}
    
    text_lower = text.lower()
    skills = {}
    
    for skill, keywords in SKILL_KEYWORDS.items():
        count = 0
        for kw in keywords:
            count += len(re.findall(r'\b' + re.escape(kw) + r'\b', text_lower))
        if count > 0:
            # Normalize: cap at 1.0
            skills[skill] = min(1.0, count * 0.3)
    
    return skills


def get_team_expertise() -> List[Dict]:
    """Get all team members with their expertise areas."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    
    rows = conn.execute("""
        SELECT tp.github_username, tp.display_name, tp.expertise_areas, 
               tp.top_repos, tp.languages, tp.is_active
        FROM team_profiles tp
        WHERE tp.is_active = 1
    """).fetchall()
    conn.close()
    
    team = []
    for row in rows:
        expertise = {}
        if row["expertise_areas"]:
            try:
                expertise = json.loads(row["expertise_areas"])
            except:
                pass
        
        team.append({
            "github_username": row["github_username"],
            "display_name": row["display_name"],
            "expertise": expertise,
            "top_repos": json.loads(row["top_repos"]) if row["top_repos"] else [],
            "languages": json.loads(row["languages"]) if row["languages"] else {},
        })
    
    return team


def calculate_match_score(candidate_skills: Dict[str, float], team_member_expertise: Dict[str, float]) -> Dict:
    """
    Calculate match score between candidate and team member.
    Returns match percentage and matched skills.
    """
    if not candidate_skills or not team_member_expertise:
        return {"score": 0.0, "matched_skills": [], "details": {}}
    
    # Find overlapping skills
    common_skills = set(candidate_skills.keys()) & set(team_member_expertise.keys())
    
    if not common_skills:
        return {"score": 0.0, "matched_skills": [], "details": {}}
    
    # Weighted overlap: sum of min(candidate_score, team_score) for each common skill
    weighted_sum = 0.0
    max_possible = 0.0
    details = {}
    
    all_skills = set(candidate_skills.keys()) | set(team_member_expertise.keys())
    
    for skill in all_skills:
        c_score = candidate_skills.get(skill, 0.0)
        t_score = team_member_expertise.get(skill, 0.0)
        
        if skill in common_skills:
            # Both have this skill — calculate contribution
            contribution = min(c_score, t_score)
            weighted_sum += contribution
            details[skill] = {
                "candidate": round(c_score, 2),
                "team_member": round(t_score, 2),
                "contribution": round(contribution, 2),
            }
        
        max_possible += max(c_score, t_score)
    
    # Match score as percentage
    match_pct = (weighted_sum / max_possible * 100) if max_possible > 0 else 0.0
    
    return {
        "score": round(match_pct, 1),
        "matched_skills": sorted(common_skills, key=lambda s: details.get(s, {}).get("contribution", 0), reverse=True),
        "details": details,
    }


def match_candidate_to_team(candidate_id: int) -> Dict:
    """
    Match a candidate against all team members.
    Returns ranked list of team members by match score.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    
    candidate = conn.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,)).fetchone()
    conn.close()
    
    if not candidate:
        return {"error": "Candidate not found"}
    
    # Extract candidate skills from all available text
    text_sources = [
        candidate["description"] or "",
        candidate["repo_analysis"] or "",
        candidate["report"] or "",
    ]
    combined_text = " ".join(text_sources)
    candidate_skills = extract_skills_from_text(combined_text)
    
    # Get team expertise
    team = get_team_expertise()
    
    # Calculate matches
    matches = []
    for member in team:
        result = calculate_match_score(candidate_skills, member["expertise"])
        matches.append({
            "github_username": member["github_username"],
            "display_name": member["display_name"],
            "match_score": result["score"],
            "matched_skills": result["matched_skills"],
            "top_repos": member["top_repos"][:3],
        })
    
    # Sort by match score descending
    matches.sort(key=lambda x: x["match_score"], reverse=True)
    
    return {
        "candidate": {
            "id": candidate["id"],
            "name": candidate["name"],
            "repo_url": candidate["repo_url"],
            "description": candidate["description"],
            "extracted_skills": candidate_skills,
        },
        "matches": matches,
        "recommended_reviewers": [m for m in matches[:3] if m["match_score"] > 0],
    }
