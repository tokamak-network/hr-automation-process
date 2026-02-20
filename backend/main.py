import os
import json
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from database import init_db, get_db
from analyzer import analyze_repo, ai_analyze, analyze_github_profile, TEAM_MEMBERS, recommend_reviewers, calculate_weighted_score
from team_profiler import scan_org_profiles
from linkedin_google import search_linkedin_candidates, get_linkedin_candidates, update_candidate_status as update_linkedin_status, init_linkedin_db
from github_linkedin import bridge_github_candidates
from github_sourcing import search_github_developers

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    init_linkedin_db()
    yield

app = FastAPI(title="Tokamak Hiring Framework", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def get_user_email(request: Request) -> Optional[str]:
    return request.headers.get("X-User-Email")


class CandidateSubmission(BaseModel):
    name: str
    email: str
    repo_url: str
    description: str = ""


# ---- User endpoints ----

@app.get("/api/users")
async def list_users():
    db = await get_db()
    rows = await db.execute("SELECT id, name, email, role FROM users ORDER BY name")
    users = [dict(r) for r in await rows.fetchall()]
    await db.close()
    return users


@app.get("/api/users/me")
async def get_current_user(request: Request):
    email = get_user_email(request)
    if not email:
        return {"user": None}
    db = await get_db()
    row = await db.execute("SELECT id, name, email, role FROM users WHERE email = ?", (email,))
    user = await row.fetchone()
    await db.close()
    if not user:
        return {"user": None}
    return {"user": dict(user)}


# ---- Candidate endpoints ----

@app.post("/api/candidates/submit")
async def submit_candidate(data: CandidateSubmission):
    db = await get_db()
    cursor = await db.execute(
        "INSERT INTO candidates (name, email, repo_url, description) VALUES (?, ?, ?, ?)",
        (data.name, data.email, data.repo_url, data.description)
    )
    await db.commit()
    cid = cursor.lastrowid
    await db.close()
    return {"id": cid, "status": "submitted"}


@app.post("/api/candidates/{candidate_id}/analyze")
async def analyze_candidate(candidate_id: int, request: Request):
    user_email = get_user_email(request)
    db = await get_db()
    row = await db.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,))
    candidate = await row.fetchone()
    if not candidate:
        await db.close()
        raise HTTPException(404, "Candidate not found")

    repo_analysis = await analyze_repo(candidate["repo_url"])
    if "error" in repo_analysis:
        await db.close()
        raise HTTPException(400, repo_analysis["error"])

    ai_result = await ai_analyze(repo_analysis, candidate["description"])

    track_b = ai_result.get("track_b", {})
    weighted_score = ai_result.get("weighted_score", 0)

    await db.execute(
        """UPDATE candidates SET status='analyzed', scores=?, report=?, recommendation=?,
           repo_analysis=?, track_b_evaluation=?, weighted_score=?, analyzed_by=?, analyzed_at=? WHERE id=?""",
        (
            json.dumps(ai_result.get("scores", {})),
            ai_result.get("report", ""),
            ai_result.get("recommendation", "Maybe"),
            json.dumps({k: v for k, v in repo_analysis.items() if k != "sample_code"}),
            json.dumps(track_b),
            weighted_score,
            user_email or "",
            datetime.utcnow().isoformat(),
            candidate_id
        )
    )
    await db.commit()
    await db.close()
    return {
        "id": candidate_id,
        "status": "analyzed",
        "scores": ai_result.get("scores"),
        "weighted_score": weighted_score,
        "track_b": track_b,
        "recommendation": ai_result.get("recommendation"),
    }


@app.get("/api/candidates")
async def list_candidates():
    db = await get_db()
    rows = await db.execute(
        "SELECT id, name, email, repo_url, status, scores, recommendation, weighted_score, reviewed_by, analyzed_by, created_at FROM candidates ORDER BY created_at DESC"
    )
    candidates = []
    for r in await rows.fetchall():
        c = dict(r)
        if c["scores"]:
            c["scores"] = json.loads(c["scores"])
        candidates.append(c)
    await db.close()
    return candidates


@app.get("/api/candidates/{candidate_id}")
async def get_candidate(candidate_id: int):
    db = await get_db()
    row = await db.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,))
    candidate = await row.fetchone()
    await db.close()
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    c = dict(candidate)
    for field in ["scores", "repo_analysis", "track_b_evaluation"]:
        if c.get(field):
            c[field] = json.loads(c[field])
    return c


@app.get("/api/candidates/{candidate_id}/report")
async def get_report(candidate_id: int):
    db = await get_db()
    row = await db.execute("SELECT report, scores, recommendation, name, weighted_score, track_b_evaluation FROM candidates WHERE id = ?", (candidate_id,))
    candidate = await row.fetchone()
    await db.close()
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    c = dict(candidate)
    if c.get("scores"):
        c["scores"] = json.loads(c["scores"])
    if c.get("track_b_evaluation"):
        c["track_b_evaluation"] = json.loads(c["track_b_evaluation"])
    return c


@app.get("/api/candidates/{candidate_id}/recommended-reviewers")
async def get_recommended_reviewers(candidate_id: int, request: Request):
    user_email = get_user_email(request)
    db = await get_db()
    row = await db.execute("SELECT scores, repo_analysis FROM candidates WHERE id = ?", (candidate_id,))
    candidate = await row.fetchone()
    if not candidate:
        await db.close()
        raise HTTPException(404, "Candidate not found")

    scores = json.loads(candidate["scores"]) if candidate["scores"] else {}
    repo_analysis = json.loads(candidate["repo_analysis"]) if candidate["repo_analysis"] else {}

    reviewers = await recommend_reviewers(scores, repo_analysis, db, exclude_email=user_email)
    await db.close()
    return {"reviewers": reviewers}


@app.post("/api/candidates/{candidate_id}/review")
async def mark_reviewed(candidate_id: int, request: Request):
    user_email = get_user_email(request)
    if not user_email:
        raise HTTPException(400, "X-User-Email header required")
    db = await get_db()
    row = await db.execute("SELECT id FROM candidates WHERE id = ?", (candidate_id,))
    if not await row.fetchone():
        await db.close()
        raise HTTPException(404, "Candidate not found")
    await db.execute("UPDATE candidates SET reviewed_by = ? WHERE id = ?", (user_email, candidate_id))
    await db.commit()
    await db.close()
    return {"status": "reviewed", "reviewed_by": user_email}


# ---- Monitor endpoints ----

@app.post("/api/monitor/scan")
async def scan_github():
    token = os.getenv("GITHUB_TOKEN", "")
    if not token:
        raise HTTPException(400, "GITHUB_TOKEN not configured")

    from github import Github
    g = Github(token)

    try:
        org = g.get_organization("tokamak-network")
    except Exception as e:
        raise HTTPException(400, "Failed to access org: {}".format(e))

    # Track external users with their last activity date on tokamak-network
    external_users = {}  # username -> last_activity_date (ISO string)
    repos_scanned = 0

    def _update_activity(login, activity_date):
        """Track the most recent activity date per user."""
        if login in TEAM_MEMBERS:
            return
        dt_str = activity_date.isoformat() if activity_date else None
        if dt_str and (login not in external_users or dt_str > external_users[login]):
            external_users[login] = dt_str

    for repo in org.get_repos(sort="updated")[:30]:
        repos_scanned += 1
        # Stargazers (no date available from API, use repo updated_at as proxy)
        try:
            for stargazer in repo.get_stargazers()[:50]:
                _update_activity(stargazer.login, repo.updated_at)
        except:
            pass
        # Forks
        try:
            for fork in repo.get_forks()[:20]:
                _update_activity(fork.owner.login, fork.created_at)
        except:
            pass
        # PRs (use created_at or updated_at)
        try:
            for pr in repo.get_pulls(state="all", sort="updated", direction="desc")[:20]:
                _update_activity(pr.user.login, pr.updated_at or pr.created_at)
        except:
            pass
        # Issues
        try:
            for issue in repo.get_issues(state="all", sort="updated", direction="desc")[:20]:
                if not issue.pull_request:  # skip PRs listed as issues
                    _update_activity(issue.user.login, issue.updated_at or issue.created_at)
        except:
            pass

    db = await get_db()
    analyzed = 0
    for username in list(external_users.keys())[:50]:
        profile = await analyze_github_profile(g, username)
        if "error" in profile:
            continue

        langs = profile.get("languages", {})
        interest = min(10, 3 + len([r for r in profile.get("recent_repos", []) if r.get("language") in {"Solidity", "TypeScript", "Rust"}]))
        tech_skill = min(10, 2 + profile.get("public_repos", 0) // 5 + profile.get("followers", 0) // 10)
        activity = min(10, 3 + len(profile.get("recent_repos", [])) // 2)
        eco_rel = 5 if any(l in langs for l in ["Solidity", "Rust", "TypeScript"]) else 3

        scores = {
            "tokamak_interest": interest,
            "technical_skill": tech_skill,
            "activity_level": activity,
            "ecosystem_relevance": eco_rel,
        }

        await db.execute("""
            INSERT INTO monitor_candidates (github_username, profile_url, bio, public_repos, followers, languages, contributions, scores, last_scanned)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(github_username) DO UPDATE SET
                bio=excluded.bio, public_repos=excluded.public_repos, followers=excluded.followers,
                languages=excluded.languages, scores=excluded.scores, last_scanned=excluded.last_scanned
        """, (
            username, profile.get("profile_url", ""), profile.get("bio", ""),
            profile.get("public_repos", 0), profile.get("followers", 0),
            json.dumps(langs), json.dumps(profile.get("recent_repos", [])),
            json.dumps(scores), external_users.get(username, datetime.utcnow().isoformat())
        ))
        analyzed += 1

    await db.commit()
    await db.close()
    return {"repos_scanned": repos_scanned, "external_users_found": len(external_users), "profiles_analyzed": analyzed}


@app.get("/api/monitor/candidates")
async def list_monitor_candidates(activity_within: str = ""):
    """List monitor candidates. activity_within: 1w, 1m, 3m to filter by last_scanned."""
    db = await get_db()
    query = "SELECT * FROM monitor_candidates"
    params = []
    if activity_within in ("1w", "1m", "3m"):
        days_map = {"1w": 7, "1m": 30, "3m": 90}
        query += " WHERE last_scanned >= datetime('now', ?)"
        params.append(f"-{days_map[activity_within]} days")
    query += " ORDER BY last_scanned DESC"
    rows = await db.execute(query, params)
    candidates = []
    for r in await rows.fetchall():
        c = dict(r)
        for f in ["languages", "contributions", "scores"]:
            if c.get(f):
                c[f] = json.loads(c[f])
        candidates.append(c)
    await db.close()
    return candidates


@app.get("/api/monitor/candidates/{github_username}")
async def get_monitor_candidate(github_username: str):
    db = await get_db()
    row = await db.execute("SELECT * FROM monitor_candidates WHERE github_username = ?", (github_username,))
    candidate = await row.fetchone()
    await db.close()
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    c = dict(candidate)
    for f in ["languages", "contributions", "scores"]:
        if c.get(f):
            c[f] = json.loads(c[f])
    return c


# ── Team Profile Endpoints ────────────────────────────────────────────────


@app.post("/api/team/profile-scan")
async def team_profile_scan():
    """Trigger a full org scan and profile generation."""
    db = await get_db()
    try:
        result = await scan_org_profiles(db)
        if "error" in result:
            raise HTTPException(400, result["error"])
        return result
    finally:
        await db.close()


@app.get("/api/team/profiles")
async def list_team_profiles():
    """List all team member profiles with expertise."""
    db = await get_db()
    rows = await db.execute("SELECT * FROM team_profiles WHERE is_active = 1 ORDER BY review_count DESC, github_username")
    profiles = []
    for r in await rows.fetchall():
        p = dict(r)
        for f in ["expertise_areas", "top_repos", "languages"]:
            if p.get(f):
                p[f] = json.loads(p[f])
        profiles.append(p)
    await db.close()
    return profiles


@app.get("/api/team/profiles/{github_username}")
async def get_team_profile(github_username: str):
    """Get individual team member profile."""
    db = await get_db()
    row = await db.execute("SELECT * FROM team_profiles WHERE github_username = ?", (github_username,))
    profile = await row.fetchone()
    await db.close()
    if not profile:
        raise HTTPException(404, "Profile not found")
    p = dict(profile)
    for f in ["expertise_areas", "top_repos", "languages"]:
        if p.get(f):
            p[f] = json.loads(p[f])
    return p


# ── LinkedIn Sourcing Endpoints ──────────────────────────────────────────────


class LinkedInSearchRequest(BaseModel):
    keywords: str = ""
    queries: list = []


@app.post("/api/linkedin/search")
async def linkedin_search(data: LinkedInSearchRequest):
    """Trigger candidate sourcing. Tries web search first, falls back to GitHub API."""
    result = await search_linkedin_candidates(
        keywords=data.keywords or None,
        queries=data.queries or None,
    )
    # If web search found nothing, fall back to GitHub API search
    if result.get("total_found", 0) == 0:
        github_result = await search_github_developers(
            keywords=data.keywords or None,
            max_per_query=15,
        )
        return github_result
    return result


@app.post("/api/github/search")
async def github_search(data: LinkedInSearchRequest):
    """Search GitHub directly for developer candidates."""
    result = await search_github_developers(
        keywords=data.keywords or None,
        queries=data.queries if data.queries else None,
        max_per_query=20,
    )
    return result


@app.get("/api/linkedin/candidates")
async def linkedin_candidates(status: str = "", limit: int = 50, offset: int = 0):
    """List LinkedIn candidates with scores."""
    candidates = get_linkedin_candidates(
        status=status or None,
        limit=limit,
        offset=offset,
    )
    return candidates


class OutreachRequest(BaseModel):
    status: str = "outreach"
    notes: str = ""


@app.post("/api/linkedin/candidates/{candidate_id}/outreach")
async def linkedin_outreach(candidate_id: int, data: OutreachRequest):
    """Mark candidate for outreach (status update)."""
    success = update_linkedin_status(candidate_id, data.status, data.notes)
    if not success:
        raise HTTPException(404, "Candidate not found")
    return {"id": candidate_id, "status": data.status}


@app.post("/api/linkedin/bridge")
async def linkedin_bridge():
    """Find LinkedIn profiles for GitHub monitor candidates."""
    result = await bridge_github_candidates()
    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
