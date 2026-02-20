import os
import tempfile
import json
import httpx
import subprocess
from pathlib import Path
from collections import Counter

TEAM_MEMBERS = {
    "amrtokmak", "SonYoungsung", "zzooppii", "ireneeeeeee0", "Jaden-Kong",
    "JehyukJang", "cd4761", "0xHammerr", "ggs134", "Mehd1b", "monica-tokamak",
    "0xsy3", "shlee-lab", "theo-learner", "shinthom", "Zena-park"
}

LANG_EXTENSIONS = {
    ".py": "Python", ".js": "JavaScript", ".ts": "TypeScript", ".tsx": "TypeScript",
    ".sol": "Solidity", ".rs": "Rust", ".go": "Go", ".java": "Java",
    ".cpp": "C++", ".c": "C", ".rb": "Ruby", ".jsx": "JavaScript",
    ".vue": "Vue", ".svelte": "Svelte", ".html": "HTML", ".css": "CSS",
    ".json": "JSON", ".yaml": "YAML", ".yml": "YAML", ".md": "Markdown",
    ".sh": "Shell", ".toml": "TOML",
}

async def analyze_repo(repo_url: str) -> dict:
    """Clone and analyze a repository."""
    with tempfile.TemporaryDirectory() as tmpdir:
        repo_path = os.path.join(tmpdir, "repo")
        try:
            subprocess.run(
                ["git", "clone", "--depth", "50", repo_url, repo_path],
                capture_output=True, timeout=60, check=True
            )
        except Exception as e:
            return {"error": f"Failed to clone: {str(e)}"}

        # Count files and languages
        lang_counter = Counter()
        file_count = 0
        total_size = 0
        for root, dirs, files in os.walk(repo_path):
            dirs[:] = [d for d in dirs if d not in {".git", "node_modules", "__pycache__", ".next", "dist", "build"}]
            for f in files:
                fp = os.path.join(root, f)
                ext = Path(f).suffix.lower()
                if ext in LANG_EXTENSIONS:
                    lang_counter[LANG_EXTENSIONS[ext]] += 1
                file_count += 1
                try:
                    total_size += os.path.getsize(fp)
                except:
                    pass

        # Commit history
        try:
            result = subprocess.run(
                ["git", "log", "--oneline", "--format=%H|%an|%s"],
                capture_output=True, text=True, cwd=repo_path, timeout=10
            )
            commits = result.stdout.strip().split("\n") if result.stdout.strip() else []
        except:
            commits = []

        # Test indicators
        has_tests = any(
            "test" in d.lower() or "spec" in d.lower()
            for _, dirs, _ in os.walk(repo_path)
            for d in dirs
        )

        # Sample code for AI analysis
        sample_files = []
        for root, dirs, files in os.walk(repo_path):
            dirs[:] = [d for d in dirs if d not in {".git", "node_modules", "__pycache__"}]
            for f in files:
                ext = Path(f).suffix.lower()
                if ext in {".py", ".js", ".ts", ".tsx", ".sol", ".rs", ".go"}:
                    fp = os.path.join(root, f)
                    try:
                        content = open(fp).read()[:2000]
                        rel = os.path.relpath(fp, repo_path)
                        sample_files.append(f"--- {rel} ---\n{content}")
                        if len(sample_files) >= 5:
                            break
                    except:
                        pass
            if len(sample_files) >= 5:
                break

        # README
        readme = ""
        for name in ["README.md", "readme.md", "README.rst", "README"]:
            rp = os.path.join(repo_path, name)
            if os.path.exists(rp):
                readme = open(rp).read()[:3000]
                break

        return {
            "file_count": file_count,
            "total_size_kb": round(total_size / 1024, 1),
            "languages": dict(lang_counter.most_common(10)),
            "commit_count": len(commits),
            "has_tests": has_tests,
            "readme_preview": readme[:500],
            "sample_code": "\n\n".join(sample_files)[:6000],
            "readme_full": readme,
        }


async def ai_analyze(repo_analysis: dict, description: str = "") -> dict:
    """Call AI to generate qualitative analysis and scores."""
    api_url = os.getenv("AI_API_URL", "https://api.openai.com/v1/chat/completions")
    api_key = os.getenv("AI_API_KEY", "")
    model = os.getenv("AI_MODEL", "gpt-4o-mini")

    if not api_key:
        return _fallback_scores(repo_analysis)

    prompt = f"""Analyze this code repository for a hiring evaluation at Tokamak Network (Ethereum L2/rollup project).

Repository Info:
- Description: {description}
- Files: {repo_analysis.get('file_count', 0)}, Size: {repo_analysis.get('total_size_kb', 0)}KB
- Languages: {json.dumps(repo_analysis.get('languages', {}))}
- Commits: {repo_analysis.get('commit_count', 0)}
- Has tests: {repo_analysis.get('has_tests', False)}

README:
{repo_analysis.get('readme_full', 'N/A')[:2000]}

Sample Code:
{repo_analysis.get('sample_code', 'N/A')[:4000]}

Respond in JSON with these fields:
- "summary": What does this project do? (2-3 sentences)
- "ecosystem_relevance": How does it relate to Tokamak Network / Ethereum L2? (1-2 sentences)
- "code_quality": Code quality assessment (1-2 sentences)
- "tokenomics_impact": Tokenomics/protocol-level impact potential (1-2 sentences)
- "innovation_notes": Innovation assessment (1-2 sentences)
- "ai_usage_evidence": Evidence of AI tool usage (1-2 sentences)
- "scores": object with integer 1-10 for: "technical_completeness", "ecosystem_fit", "tokenomics_impact", "innovation", "ai_proficiency"
- "recommendation": one of "Strong Hire", "Hire", "Maybe", "Pass"
- "report": Full evaluation report (3-5 paragraphs)

Return ONLY valid JSON."""

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(api_url, headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }, json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
            })
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            # Strip markdown code fences if present
            if content.startswith("```"):
                content = content.split("\n", 1)[1].rsplit("```", 1)[0]
            return json.loads(content)
    except Exception as e:
        print(f"AI analysis failed: {e}")
        return _fallback_scores(repo_analysis)


def _fallback_scores(repo_analysis: dict) -> dict:
    """Generate basic scores without AI."""
    fc = repo_analysis.get("file_count", 0)
    cc = repo_analysis.get("commit_count", 0)
    has_tests = repo_analysis.get("has_tests", False)
    langs = repo_analysis.get("languages", {})

    tech = min(10, max(1, fc // 10 + cc // 5 + (2 if has_tests else 0)))
    eco = 5 if any(l in langs for l in ["Solidity", "Rust"]) else 3
    tok = 3
    inn = min(8, max(2, len(langs)))
    ai_p = 3

    return {
        "summary": "Automated analysis (AI unavailable)",
        "ecosystem_relevance": "Could not determine without AI analysis",
        "code_quality": "Basic metrics only",
        "tokenomics_impact": "Unknown",
        "innovation_notes": "Unknown",
        "ai_usage_evidence": "Unknown",
        "scores": {
            "technical_completeness": tech,
            "ecosystem_fit": eco,
            "tokenomics_impact": tok,
            "innovation": inn,
            "ai_proficiency": ai_p,
        },
        "recommendation": "Maybe",
        "report": f"Automated analysis: {fc} files, {cc} commits, languages: {', '.join(langs.keys())}. AI analysis unavailable.",
    }


async def analyze_github_profile(g, username: str) -> dict:
    """Analyze a GitHub user's profile."""
    try:
        user = g.get_user(username)
        repos = list(user.get_repos(sort="updated")[:20])

        lang_counter = Counter()
        for repo in repos:
            if repo.language:
                lang_counter[repo.language] += 1

        return {
            "username": username,
            "profile_url": f"https://github.com/{username}",
            "bio": user.bio or "",
            "public_repos": user.public_repos,
            "followers": user.followers,
            "languages": dict(lang_counter.most_common(10)),
            "recent_repos": [{"name": r.name, "stars": r.stargazers_count, "language": r.language} for r in repos[:10]],
        }
    except Exception as e:
        return {"username": username, "error": str(e)}
