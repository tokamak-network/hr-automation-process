import os
import json
import asyncio
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

import sqlite3
from database import init_db, get_db, DB_PATH
from analyzer import analyze_repo, ai_analyze, analyze_github_profile, TEAM_MEMBERS, recommend_reviewers, calculate_weighted_score
from team_profiler import scan_org_profiles
from linkedin_google import search_linkedin_candidates, get_linkedin_candidates, update_candidate_status as update_linkedin_status, init_linkedin_db
from github_linkedin import bridge_github_candidates
from github_sourcing import search_github_developers
from matching import match_candidate_to_team

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    init_linkedin_db()
    yield

app = FastAPI(title="Tokamak Hiring Framework", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}


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

# Background scan state
_scan_status = {"running": False, "last_result": None, "last_error": None, "started_at": None}

@app.get("/api/monitor/scan/status")
async def scan_status():
    return _scan_status

@app.post("/api/monitor/scan")
async def scan_github(background_tasks: BackgroundTasks):
    token = os.getenv("GITHUB_TOKEN", "")
    if not token:
        raise HTTPException(400, "GITHUB_TOKEN not configured")
    if _scan_status["running"]:
        return {"status": "already_running", "started_at": _scan_status["started_at"]}
    _scan_status["running"] = True
    _scan_status["started_at"] = datetime.utcnow().isoformat()
    _scan_status["last_error"] = None
    background_tasks.add_task(_do_scan_github, token)
    return {"status": "started", "message": "Scan started in background. Check /api/monitor/scan/status for progress."}

async def _do_scan_github(token: str):
    try:
        result = await asyncio.to_thread(_scan_github_sync, token)
        _scan_status["last_result"] = result
    except Exception as e:
        _scan_status["last_error"] = str(e)
    finally:
        _scan_status["running"] = False

def _scan_github_sync(token: str):
    """Synchronous scan — runs in a separate thread via asyncio.to_thread."""
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger("monitor")

    from github import Github
    g = Github(token)

    try:
        org = g.get_organization("tokamak-network")
    except Exception as e:
        raise RuntimeError("Failed to access org: {}".format(e))

    activities = []
    external_users = {}
    repos_scanned = 0

    def _add_activity(login, activity_type, repo_name, url, activity_date, details=""):
        if login in TEAM_MEMBERS:
            return
        dt_str = activity_date.isoformat() if activity_date else None
        activities.append((login, activity_type, repo_name, url, dt_str, details))
        if dt_str and (login not in external_users or dt_str > external_users[login]):
            external_users[login] = dt_str

    for repo in org.get_repos(sort="updated")[:30]:
        repos_scanned += 1
        repo_full = repo.full_name
        try:
            for sg in repo.get_stargazers_with_dates()[:50]:
                _add_activity(sg.user.login, "star", repo_full, "https://github.com/" + repo_full, sg.starred_at, "Starred " + repo_full)
        except Exception:
            pass
        try:
            for fork in repo.get_forks()[:20]:
                _add_activity(fork.owner.login, "fork", repo_full, fork.html_url, fork.created_at, "Forked " + repo_full)
        except Exception:
            pass
        try:
            for pr in repo.get_pulls(state="all", sort="updated", direction="desc")[:20]:
                _add_activity(pr.user.login, "pr", repo_full, pr.html_url, pr.created_at, pr.title)
        except Exception:
            pass
        try:
            for issue in repo.get_issues(state="all", sort="updated", direction="desc")[:20]:
                if not issue.pull_request:
                    _add_activity(issue.user.login, "issue", repo_full, issue.html_url, issue.created_at, issue.title)
        except Exception:
            pass

    # Save to DB synchronously
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")

    logger.info("Total activities collected: %d", len(activities))
    saved_acts = 0
    for login, atype, repo_name, url, dt_str, details in activities:
        try:
            conn.execute("""
                INSERT OR IGNORE INTO monitor_activities
                (github_username, activity_type, repo_name, activity_url, activity_date, details)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (login, atype, repo_name, url, dt_str, details))
            saved_acts += 1
        except Exception as e:
            logger.error("Failed to save activity: %s %s %s - %s", login, atype, url, e)
    conn.commit()
    logger.info("Activities saved: %d", saved_acts)

    # Analyze profiles synchronously
    analyzed = 0
    for username in list(external_users.keys())[:50]:
        try:
            user_obj = g.get_user(username)
            repos = list(user_obj.get_repos(sort="updated")[:10])
            langs = {}
            for r in repos:
                if r.language:
                    langs[r.language] = langs.get(r.language, 0) + 1

            interest = min(10, 3 + len([r for r in repos if r.language in {"Solidity", "TypeScript", "Rust"}]))
            tech_skill = min(10, 2 + user_obj.public_repos // 5 + user_obj.followers // 10)
            activity = min(10, 3 + len(repos) // 2)
            eco_rel = 5 if any(l in langs for l in ["Solidity", "Rust", "TypeScript"]) else 3

            scores = {
                "tokamak_interest": interest,
                "technical_skill": tech_skill,
                "activity_level": activity,
                "ecosystem_relevance": eco_rel,
            }

            last_active = external_users.get(username, datetime.utcnow().isoformat())
            recent_repos = [{"name": r.name, "language": r.language, "stars": r.stargazers_count} for r in repos]

            conn.execute("""
                INSERT INTO monitor_candidates (github_username, profile_url, bio, public_repos, followers, languages, contributions, scores, last_scanned)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(github_username) DO UPDATE SET
                    bio=excluded.bio, public_repos=excluded.public_repos, followers=excluded.followers,
                    languages=excluded.languages, scores=excluded.scores, last_scanned=excluded.last_scanned
            """, (
                username, f"https://github.com/{username}", user_obj.bio or "",
                user_obj.public_repos, user_obj.followers,
                json.dumps(langs), json.dumps(recent_repos),
                json.dumps(scores), last_active
            ))
            analyzed += 1
        except Exception as e:
            logger.error("Failed to analyze %s: %s", username, e)
            continue

    conn.commit()
    conn.close()
    return {"repos_scanned": repos_scanned, "external_users_found": len(external_users), "profiles_analyzed": analyzed}


@app.get("/api/monitor/candidates")
async def list_monitor_candidates(activity_within: str = ""):
    """List monitor candidates. activity_within: 1w, 1m, 3m to filter by last_scanned."""
    db = await get_db()
    query = "SELECT * FROM monitor_candidates"
    params = []  # type: list
    if activity_within in ("1w", "1m", "3m"):
        days_map = {"1w": 7, "1m": 30, "3m": 90}
        query += " WHERE last_scanned >= datetime('now', ?)"
        params.append("-{} days".format(days_map[activity_within]))
    query += " ORDER BY last_scanned DESC"
    rows = await db.execute(query, params)
    candidates = []
    for r in await rows.fetchall():
        c = dict(r)
        for f in ["languages", "contributions", "scores"]:
            if c.get(f):
                c[f] = json.loads(c[f])

        # Fetch recent activities
        act_rows = await db.execute(
            "SELECT activity_type, repo_name, activity_url, activity_date, details FROM monitor_activities WHERE github_username = ? ORDER BY activity_date DESC LIMIT 5",
            (c["github_username"],)
        )
        c["recent_activities"] = [dict(a) for a in await act_rows.fetchall()]

        # Activity type summary
        summary_rows = await db.execute(
            "SELECT activity_type, COUNT(*) as cnt FROM monitor_activities WHERE github_username = ? GROUP BY activity_type",
            (c["github_username"],)
        )
        c["activity_types"] = {row["activity_type"]: row["cnt"] for row in await summary_rows.fetchall()}

        candidates.append(c)
    await db.close()
    return candidates


@app.get("/api/monitor/candidates/{github_username}/activities")
async def get_monitor_activities(github_username: str):
    """Get all activities for a monitor candidate."""
    db = await get_db()
    rows = await db.execute(
        "SELECT activity_type, repo_name, activity_url, activity_date, details FROM monitor_activities WHERE github_username = ? ORDER BY activity_date DESC",
        (github_username,)
    )
    activities = [dict(r) for r in await rows.fetchall()]
    await db.close()
    return activities


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


@app.delete("/api/team/profiles/{github_username}")
async def delete_team_profile(github_username: str):
    """Delete a team member profile."""
    db = await get_db()
    row = await db.execute("SELECT id FROM team_profiles WHERE github_username = ?", (github_username,))
    if not await row.fetchone():
        await db.close()
        raise HTTPException(404, "Profile not found")
    await db.execute("DELETE FROM team_profiles WHERE github_username = ?", (github_username,))
    await db.commit()
    await db.close()
    return {"deleted": github_username}


class AddTeamMemberRequest(BaseModel):
    github_username: str


@app.post("/api/team/profiles")
async def add_team_profile(req: AddTeamMemberRequest):
    """Add a team member by GitHub username. Fetches profile from GitHub API and scans their activity."""
    import os
    from github import Github, GithubException
    from collections import Counter, defaultdict
    from datetime import datetime, timedelta
    from team_profiler import _repo_to_domains, _langs_to_expertise

    token = os.getenv("GITHUB_TOKEN", "")
    if not token:
        raise HTTPException(400, "GITHUB_TOKEN not configured")

    g = Github(token, per_page=100)
    username = req.github_username.strip().lstrip("@")

    # Fetch user info
    try:
        user = g.get_user(username)
    except GithubException:
        raise HTTPException(404, f"GitHub user '{username}' not found")

    # Check if already exists
    db = await get_db()
    row = await db.execute("SELECT id FROM team_profiles WHERE github_username = ?", (username,))
    if await row.fetchone():
        await db.close()
        raise HTTPException(409, f"'{username}' already exists in team profiles")

    # Scan tokamak-network org repos for this user's activity
    try:
        org = g.get_organization("tokamak-network")
        all_repos = list(org.get_repos(sort="updated", type="all"))[:50]
    except Exception as e:
        await db.close()
        raise HTTPException(500, f"Failed to access org repos: {e}")

    six_months_ago = datetime.utcnow() - timedelta(days=180)
    commits_per_repo = Counter()
    languages = Counter()
    domains = Counter()
    repos_detail = []

    for repo in all_repos:
        try:
            commits = list(repo.get_commits(author=username, since=six_months_ago))
            if not commits:
                continue
            count = len(commits)
            commits_per_repo[repo.name] = count

            repo_domains = _repo_to_domains(repo.name, getattr(repo, "topics", []) or [], repo.description)
            for d in repo_domains:
                domains[d] += count

            try:
                repo_langs = repo.get_languages()
                for lang, bytes_count in repo_langs.items():
                    languages[lang] += bytes_count
            except Exception:
                pass

            repos_detail.append({"name": repo.name, "commits": count, "language": max(repo.get_languages() or {"Unknown": 0}, key=lambda k: repo.get_languages().get(k, 0), default="Unknown")})
        except Exception:
            continue

    # Build expertise
    lang_expertise = _langs_to_expertise(dict(languages))
    domain_total = sum(domains.values()) or 1
    expertise = {**lang_expertise}
    for d, c in domains.items():
        expertise[d] = max(expertise.get(d, 0), min(c / domain_total, 1.0))

    review_count = sum(commits_per_repo.values())
    top_repos = sorted(repos_detail, key=lambda r: -r["commits"])[:5]
    top_languages = dict(Counter(languages).most_common(10))
    now = datetime.utcnow().isoformat()

    await db.execute("""
        INSERT INTO team_profiles (github_username, display_name, avatar_url, expertise_areas, top_repos, languages, review_count, last_active, last_profiled, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    """, (
        username,
        user.name or username,
        user.avatar_url or "",
        json.dumps(expertise),
        json.dumps(top_repos),
        json.dumps(top_languages),
        review_count,
        now, now,
    ))
    await db.commit()
    await db.close()

    return {"added": username, "display_name": user.name or username, "repos_scanned": len(all_repos), "commits_found": review_count}


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
        result = await search_github_developers(
            keywords=data.keywords or None,
            max_per_query=15,
        )
    # Always attach saved_ids from DB if candidates were saved
    if result.get("total_saved", 0) > 0:
        conn = sqlite3.connect(DB_PATH, timeout=10)
        rows = conn.execute(
            "SELECT id FROM linkedin_candidates WHERE created_at >= datetime('now', '-2 minutes') ORDER BY id DESC"
        ).fetchall()
        conn.close()
        result["saved_ids"] = [r[0] for r in rows]
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
    template_id: str = ""
    message_sent: str = ""
    channel: str = "linkedin_dm"


@app.get("/api/templates/outreach")
async def get_outreach_templates():
    """Parse outreach_templates.md and return structured JSON."""
    import re
    templates_path = os.path.join(os.path.dirname(__file__), "..", "templates", "outreach_templates.md")
    if not os.path.exists(templates_path):
        raise HTTPException(404, "Templates file not found")
    with open(templates_path, "r", encoding="utf-8") as f:
        content = f.read()

    templates = []
    # Split by ## N. Title — produces ['preamble', '1', 'Title1', 'content1', '2', 'Title2', 'content2', ...]
    sections = re.split(r'^## (\d+)\.\s+(.+)$', content, flags=re.MULTILINE)
    i = 1
    while i + 2 < len(sections):
        tid = sections[i].strip()
        name = sections[i + 1].strip()
        rest = sections[i + 2]

        # Parse English and Korean blocks
        langs = {}
        subjects = {}
        for lang_label, lang_key in [("### English", "en"), ("### 한국어", "kr")]:
            if lang_label in rest:
                after = rest.split(lang_label, 1)[1]
                # Extract subject line if present
                subj_match = re.search(r'\*\*Subject:\*\*\s*(.+)', after)
                if subj_match:
                    subjects[lang_key] = subj_match.group(1).strip()
                code_match = re.search(r'```\n?(.*?)```', after, re.DOTALL)
                if code_match:
                    langs[lang_key] = code_match.group(1).strip()

        # If no language subsections, grab first code block as English
        if not langs:
            code_match = re.search(r'```\n?(.*?)```', rest, re.DOTALL)
            if code_match:
                langs["en"] = code_match.group(1).strip()

        # Extract variables from template text
        all_text = " ".join(langs.values())
        variables = sorted(set(re.findall(r'\{([^}]+)\}', all_text)))

        for lang_key, body in langs.items():
            templates.append({
                "id": "{}_{}".format(tid, lang_key),
                "name": name,
                "language": lang_key,
                "subject": subjects.get(lang_key, ""),
                "body": body,
                "variables": variables,
            })

        i += 3

    return templates


@app.post("/api/linkedin/candidates/{candidate_id}/outreach")
async def linkedin_outreach(candidate_id: int, data: OutreachRequest):
    """Mark candidate for outreach (status update) and optionally save outreach history."""
    success = update_linkedin_status(candidate_id, data.status, data.notes)
    if not success:
        raise HTTPException(404, "Candidate not found")

    # Save to outreach_history if message was sent
    if data.message_sent:
        db = await get_db()
        await db.execute(
            "INSERT INTO outreach_history (candidate_id, candidate_type, template_used, message_sent, channel, status, sent_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (candidate_id, "linkedin", data.template_id, data.message_sent, data.channel, "sent", data.notes or "")
        )
        await db.commit()
        await db.close()

    return {"id": candidate_id, "status": data.status}


@app.get("/api/linkedin/candidates/{candidate_id}/outreach-history")
async def get_outreach_history(candidate_id: int):
    """Returns outreach history for a candidate."""
    db = await get_db()
    rows = await db.execute(
        "SELECT * FROM outreach_history WHERE candidate_id = ? ORDER BY sent_at DESC",
        (candidate_id,)
    )
    history = [dict(r) for r in await rows.fetchall()]
    await db.close()
    return history


# ── Monitor LinkedIn Lookup ───────────────────────────────────────────────


async def _find_linkedin_for_monitor_candidate(username: str, db) -> Optional[str]:
    """Find LinkedIn URL for a single monitor candidate. Returns URL or None."""
    import httpx
    import re

    token = os.getenv("GITHUB_TOKEN", "")
    headers = {}
    if token:
        headers["Authorization"] = "token {}".format(token)

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://api.github.com/users/{}".format(username),
                headers=headers,
            )
            if resp.status_code != 200:
                return None
            user_data = resp.json()
    except Exception:
        return None

    real_name = user_data.get("name", "") or ""
    location = user_data.get("location", "") or ""
    bio = user_data.get("bio", "") or ""
    blog = user_data.get("blog", "") or ""

    # 1. Check profile fields for LinkedIn URL
    for field in [blog, bio]:
        match = re.search(r'linkedin\.com/in/([a-zA-Z0-9_-]+)', field)
        if match:
            url = "https://www.linkedin.com/in/{}".format(match.group(1))
            await db.execute("UPDATE monitor_candidates SET linkedin_url = ? WHERE github_username = ?", (url, username))
            await db.commit()
            return url

    # 2. Check GitHub social accounts API
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://api.github.com/users/{}/social_accounts".format(username),
                headers=headers,
            )
            if resp.status_code == 200:
                for account in resp.json():
                    if "linkedin" in account.get("url", ""):
                        url = account["url"]
                        if not url.startswith("https://"):
                            url = "https://" + url.lstrip("/")
                        await db.execute("UPDATE monitor_candidates SET linkedin_url = ? WHERE github_username = ?", (url, username))
                        await db.commit()
                        return url
    except Exception:
        pass

    if not real_name:
        return None

    # Use existing search function
    from github_linkedin import find_linkedin_for_github_user
    result = await find_linkedin_for_github_user(real_name, location, bio)
    if result:
        url = result["profile_url"]
        await db.execute("UPDATE monitor_candidates SET linkedin_url = ? WHERE github_username = ?", (url, username))
        await db.commit()
        return url

    return None


@app.post("/api/monitor/find-linkedin")
async def monitor_find_linkedin_all():
    """Find LinkedIn profiles for all monitor candidates missing linkedin_url."""
    db = await get_db()
    rows = await db.execute(
        "SELECT github_username FROM monitor_candidates WHERE linkedin_url IS NULL OR linkedin_url = ''"
    )
    candidates = [dict(r) for r in await rows.fetchall()]

    found_list = []
    for c in candidates:
        username = c["github_username"]
        url = await _find_linkedin_for_monitor_candidate(username, db)
        if url:
            found_list.append({"username": username, "linkedin_url": url})

    await db.close()
    return {"checked": len(candidates), "found": len(found_list), "candidates": found_list}


@app.post("/api/monitor/find-linkedin/{username}")
async def monitor_find_linkedin_single(username: str):
    """Find LinkedIn profile for a single monitor candidate."""
    db = await get_db()
    row = await db.execute("SELECT id FROM monitor_candidates WHERE github_username = ?", (username,))
    if not await row.fetchone():
        await db.close()
        raise HTTPException(404, "Candidate not found")

    url = await _find_linkedin_for_monitor_candidate(username, db)
    await db.close()
    if url:
        return {"username": username, "linkedin_url": url}
    return {"username": username, "linkedin_url": None, "message": "LinkedIn profile not found"}


@app.post("/api/linkedin/bridge")
async def linkedin_bridge():
    """Find LinkedIn profiles for GitHub monitor candidates."""
    result = await bridge_github_candidates()
    return result


@app.get("/api/candidates/{candidate_id}/match")
async def get_candidate_match(candidate_id: int):
    """Get team matching scores for a candidate."""
    result = match_candidate_to_team(candidate_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


# ══════════════════════════════════════════════════════════════════════════════
# HR / Payroll Endpoints
# ══════════════════════════════════════════════════════════════════════════════

from tax_calculator import simulate_annual_tax, monthly_tax_burden
import calendar as _calendar
from pydantic import BaseModel as _BM


class HRMemberCreate(BaseModel):
    name: str
    github: str = ""
    role: str
    monthly_usdt: float
    wallet_address: str = ""
    contract_start: str = ""

class HRMemberUpdate(BaseModel):
    name: Optional[str] = None
    github: Optional[str] = None
    role: Optional[str] = None
    monthly_usdt: Optional[float] = None
    wallet_address: Optional[str] = None
    contract_start: Optional[str] = None
    is_active: Optional[int] = None

class PayrollConfirm(BaseModel):
    year: int
    month: int


# ── HR Members ──

@app.get("/api/hr/members")
async def list_hr_members():
    db = await get_db()
    rows = await db.execute("SELECT * FROM hr_members WHERE is_active=1 ORDER BY id")
    result = [dict(r) for r in await rows.fetchall()]
    await db.close()
    return result

@app.get("/api/hr/members/{member_id}")
async def get_hr_member(member_id: int):
    db = await get_db()
    row = await db.execute("SELECT * FROM hr_members WHERE id=?", (member_id,))
    member = await row.fetchone()
    if not member:
        await db.close()
        raise HTTPException(404, "Member not found")
    m = dict(member)
    payrolls = await db.execute("SELECT * FROM payrolls WHERE member_id=? ORDER BY year DESC, month DESC", (member_id,))
    m["payrolls"] = [dict(p) for p in await payrolls.fetchall()]
    incentives = await db.execute("SELECT * FROM incentives WHERE member_id=? ORDER BY year DESC, quarter DESC", (member_id,))
    m["incentives"] = [dict(i) for i in await incentives.fetchall()]
    await db.close()
    return m

@app.post("/api/hr/members")
async def create_hr_member(data: HRMemberCreate):
    db = await get_db()
    cursor = await db.execute(
        "INSERT INTO hr_members (name, github, role, monthly_usdt, wallet_address, contract_start) VALUES (?,?,?,?,?,?)",
        (data.name, data.github, data.role, data.monthly_usdt, data.wallet_address, data.contract_start))
    await db.commit()
    mid = cursor.lastrowid
    await db.close()
    return {"id": mid, "message": "Member created"}

@app.put("/api/hr/members/{member_id}")
async def update_hr_member(member_id: int, data: HRMemberUpdate):
    db = await get_db()
    row = await db.execute("SELECT * FROM hr_members WHERE id=?", (member_id,))
    if not await row.fetchone():
        await db.close()
        raise HTTPException(404, "Member not found")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if updates:
        set_clause = ", ".join(f"{k}=?" for k in updates)
        await db.execute(f"UPDATE hr_members SET {set_clause} WHERE id=?", list(updates.values()) + [member_id])
        await db.commit()
    await db.close()
    return {"message": "Updated"}

@app.delete("/api/hr/members/{member_id}")
async def delete_hr_member(member_id: int):
    db = await get_db()
    await db.execute("UPDATE hr_members SET is_active=0 WHERE id=?", (member_id,))
    await db.commit()
    await db.close()
    return {"message": "Deactivated"}


# ── Payroll ──

@app.get("/api/hr/payroll")
async def list_payroll(year: int = 2026, month: Optional[int] = None):
    db = await get_db()
    if month:
        rows = await db.execute("""
            SELECT p.*, m.name, m.role, m.wallet_address FROM payrolls p
            JOIN hr_members m ON p.member_id = m.id
            WHERE p.year=? AND p.month=? ORDER BY m.name
        """, (year, month))
    else:
        rows = await db.execute("""
            SELECT p.*, m.name, m.role, m.wallet_address FROM payrolls p
            JOIN hr_members m ON p.member_id = m.id
            WHERE p.year=? ORDER BY p.month DESC, m.name
        """, (year,))
    result = [dict(r) for r in await rows.fetchall()]
    await db.close()
    return result

@app.post("/api/hr/payroll/confirm")
async def confirm_payroll(data: PayrollConfirm):
    db = await get_db()
    await db.execute("UPDATE payrolls SET status='confirmed', confirmed_at=datetime('now') WHERE year=? AND month=? AND status='estimated'", (data.year, data.month))
    await db.commit()
    await db.close()
    return {"message": "Confirmed"}

@app.post("/api/hr/payroll/pay")
async def pay_payroll(data: PayrollConfirm):
    db = await get_db()
    await db.execute("UPDATE payrolls SET status='paid', paid_at=datetime('now') WHERE year=? AND month=? AND status='confirmed'", (data.year, data.month))
    await db.commit()
    await db.close()
    return {"message": "Marked as paid"}


# ── Dashboard ──

@app.get("/api/hr/dashboard")
async def hr_dashboard():
    db = await get_db()
    year, month = 2026, 3
    rows = await db.execute("SELECT * FROM payrolls WHERE year=? AND month=?", (year, month))
    payrolls = [dict(r) for r in await rows.fetchall()]
    total_usdt = sum(p["usdt_amount"] for p in payrolls)
    total_krw = sum(p["krw_amount"] for p in payrolls)
    total_tax = sum(p["tax_simulated"] for p in payrolls)

    jaden_balance = {"usdt": 45230.50, "tokamak": 12500.0}

    tx_rows = await db.execute("SELECT * FROM hr_transactions ORDER BY timestamp DESC LIMIT 5")
    txs = [dict(r) for r in await tx_rows.fetchall()]

    from datetime import date
    today = date.today()
    last_day = date(today.year, today.month, _calendar.monthrange(today.year, today.month)[1])
    while last_day.weekday() >= 5:
        last_day = last_day.replace(day=last_day.day - 1)
    d_day = (last_day - today).days

    res_row = await db.execute("SELECT SUM(reserve_tokamak) as total_tok FROM payrolls WHERE year=?", (year,))
    res = await res_row.fetchone()
    total_reserve_tok = res["total_tok"] or 0
    tokamak_price = 3200

    await db.close()
    return {
        "current_month": {"year": year, "month": month, "total_usdt": round(total_usdt, 2), "total_krw": round(total_krw), "total_tax": round(total_tax), "member_count": len(payrolls)},
        "jaden_balance": jaden_balance,
        "recent_transactions": txs,
        "d_day": d_day,
        "payday": last_day.isoformat(),
        "reserves": {"total_tokamak": round(total_reserve_tok, 4), "krw_value": round(total_reserve_tok * tokamak_price), "tokamak_price": tokamak_price},
    }


# ── Tax Simulation ──

@app.get("/api/hr/tax/simulate/{member_id}")
async def tax_simulate(member_id: int, year: int = 2026):
    db = await get_db()
    row = await db.execute("SELECT * FROM hr_members WHERE id=?", (member_id,))
    member = await row.fetchone()
    if not member:
        await db.close()
        raise HTTPException(404, "Member not found")

    p_rows = await db.execute("SELECT * FROM payrolls WHERE member_id=? AND year=? ORDER BY month", (member_id, year))
    payrolls = [dict(p) for p in await p_rows.fetchall()]
    total_payroll_krw = sum(p["krw_amount"] for p in payrolls)

    i_rows = await db.execute("SELECT * FROM incentives WHERE member_id=? AND year=?", (member_id, year))
    incentives = [dict(i) for i in await i_rows.fetchall()]
    total_incentive_krw = sum(i["krw_amount"] for i in incentives)

    annual_income = total_payroll_krw + total_incentive_krw
    tax_result = simulate_annual_tax(annual_income)
    monthly = monthly_tax_burden(annual_income)

    total_reserve_tok = sum(p["reserve_tokamak"] for p in payrolls)
    tokamak_price = 3200

    await db.close()
    return {
        "member": dict(member),
        "year": year,
        "payroll_income_krw": round(total_payroll_krw),
        "incentive_income_krw": round(total_incentive_krw),
        "annual_income_krw": round(annual_income),
        "tax": tax_result,
        "monthly_burden": monthly,
        "reserves": {"total_tokamak": round(total_reserve_tok, 4), "krw_value": round(total_reserve_tok * tokamak_price), "tokamak_price": tokamak_price},
        "payroll_details": payrolls,
    }


# ── Incentives ──

@app.get("/api/hr/incentives")
async def list_incentives(year: int = 2026, quarter: Optional[int] = None):
    db = await get_db()
    if quarter:
        rows = await db.execute("""
            SELECT i.*, m.name, m.role FROM incentives i
            JOIN hr_members m ON i.member_id = m.id
            WHERE i.year=? AND i.quarter=? ORDER BY m.name
        """, (year, quarter))
    else:
        rows = await db.execute("""
            SELECT i.*, m.name, m.role FROM incentives i
            JOIN hr_members m ON i.member_id = m.id
            WHERE i.year=? ORDER BY i.quarter, m.name
        """, (year,))
    result = [dict(r) for r in await rows.fetchall()]
    await db.close()
    return result


# ── Transactions ──

@app.get("/api/hr/transactions")
async def list_hr_transactions(limit: int = 20):
    db = await get_db()
    rows = await db.execute("SELECT * FROM hr_transactions ORDER BY timestamp DESC LIMIT ?", (limit,))
    result = [dict(r) for r in await rows.fetchall()]
    await db.close()
    return result


# ── Market Data (Mock) ──

@app.get("/api/hr/market/tokamak")
async def tokamak_price():
    return {"token": "TOKAMAK", "price_krw": 3200, "source": "mock", "timestamp": datetime.now().isoformat()}

@app.get("/api/hr/market/usdt")
async def usdt_rate():
    return {"pair": "USDT/KRW", "rate": 1352.50, "source": "mock", "timestamp": datetime.now().isoformat()}


if __name__ == "__main__":
    import uvicorn
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args()
    uvicorn.run(app, host="0.0.0.0", port=args.port)
