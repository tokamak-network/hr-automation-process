import os
import tempfile
import json
import httpx
import subprocess
from pathlib import Path
from collections import Counter
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

TEAM_MEMBERS = {
    "member-7", "member-4", "member-8", "member-9", "member-2",
    "member-5", "member-10", "member-11", "member-1", "member-3", "member-12",
    "member-13", "member-14", "member-15", "member-16", "member-17"
}

LANG_EXTENSIONS = {
    ".py": "Python", ".js": "JavaScript", ".ts": "TypeScript", ".tsx": "TypeScript",
    ".sol": "Solidity", ".rs": "Rust", ".go": "Go", ".java": "Java",
    ".cpp": "C++", ".c": "C", ".rb": "Ruby", ".jsx": "JavaScript",
    ".vue": "Vue", ".svelte": "Svelte", ".html": "HTML", ".css": "CSS",
    ".json": "JSON", ".yaml": "YAML", ".yml": "YAML", ".md": "Markdown",
    ".sh": "Shell", ".toml": "TOML",
}

# Scoring weights for Track B evaluation
SCORE_WEIGHTS = {
    "technical_completeness": 1.0,
    "ecosystem_fit": 2.0,  # 2x weight
    "tokenomics_impact": 1.0,
    "contribution_potential": 1.0,
    "deliverable_completeness": 1.0,
}


def calculate_weighted_score(scores: Dict[str, int]) -> float:
    """Calculate weighted final score based on Track B philosophy."""
    total_weight = 0.0
    weighted_sum = 0.0
    for key, weight in SCORE_WEIGHTS.items():
        if key in scores:
            weighted_sum += scores[key] * weight
            total_weight += weight
    if total_weight == 0:
        return 0.0
    return round(weighted_sum / total_weight, 2)


async def recommend_reviewers(candidate_scores: Dict[str, Any], repo_analysis: Dict[str, Any], db, exclude_email: Optional[str] = None) -> List[Dict[str, Any]]:
    """Recommend team reviewers based on expertise profile matching.
    
    Uses team_profiles (auto-generated from GitHub activity) with weighted matching.
    Falls back to team_skills if no profiles exist.
    """
    # Try team_profiles first
    rows = await db.execute("SELECT * FROM team_profiles WHERE is_active = 1")
    profiles = await rows.fetchall()

    if profiles:
        return _match_from_profiles(profiles, repo_analysis, exclude_email)

    # Fallback to legacy team_skills
    rows = await db.execute("SELECT * FROM team_skills")
    team = await rows.fetchall()

    candidate_langs = set()
    if repo_analysis:
        for lang in repo_analysis.get("languages", {}).keys():
            candidate_langs.add(lang.lower())

    lang_to_skills = {
        "solidity": ["solidity", "smart-contracts", "ethereum", "protocol"],
        "typescript": ["typescript", "fullstack", "frontend"],
        "javascript": ["javascript", "fullstack", "frontend"],
        "python": ["python", "fullstack"],
        "rust": ["rust", "protocol", "l2"],
        "css": ["css", "frontend", "ui"],
        "react": ["react", "frontend"],
        "go": ["go", "protocol"],
    }

    candidate_skill_keywords = set()
    for lang in candidate_langs:
        for kw in lang_to_skills.get(lang, [lang]):
            candidate_skill_keywords.add(kw)

    recommendations = []
    for member in team:
        if exclude_email and member["user_email"] == exclude_email:
            continue
        member_skills = set(member["skills"].split(","))
        overlap = candidate_skill_keywords & member_skills
        if overlap:
            recommendations.append({
                "name": member["name"],
                "email": member["user_email"],
                "github": member["github_username"],
                "matching_skills": list(overlap),
                "match_score": len(overlap),
            })

    recommendations.sort(key=lambda x: x["match_score"], reverse=True)
    return recommendations[:3]


# Domain keywords extracted from repo content (README, code, file names)
DOMAIN_KEYWORDS = {
    # L2 / Rollup
    "rollup": ["rollup", "optimistic", "op-stack", "thanos", "l2", "layer2", "layer-2", "l2 rollup", "rollup hub"],
    "sequencer": ["sequencer", "op-batcher", "op-proposer", "op-node", "op-geth", "batch", "finality", "block producer"],
    "bridge": ["bridge", "cross-chain", "cross-layer", "deposit", "withdraw", "withdrawal", "portal", "l1-l2", "l1 l2"],
    # Ethereum / On-chain
    "ethereum": ["ethereum", "eth", "eip", "rpc", "viem", "ethers.js", "ethersjs", "web3.js", "web3js", "on-chain", "onchain", "block", "transaction", "gas"],
    # Smart Contracts
    "smart-contracts": ["smart-contract", "smart contract", "solidity", "evm", "opcode", "abi", "deploy", "hardhat", "foundry", "forge"],
    "staking": ["staking", "stake", "unstake", "seigniorage", "seig", "ton-staking", "validator", "delegation"],
    "dao": ["dao", "governance", "vote", "proposal", "agenda"],
    # ZK
    "zk": ["zk", "zero-knowledge", "zero knowledge", "zk-proof", "snark", "stark", "circom", "plonk", "groth16"],
    # DeFi
    "defi": ["defi", "swap", "liquidity", "pool", "amm", "uniswap", "lending", "yield"],
    "token": ["erc20", "erc-20", "erc721", "erc-721", "token", "mint", "burn", "transfer", "erc1155"],
    # Tokamak specific
    "tokamak": ["tokamak", "thanos", "trh", "titan", "ton-staking", "seigmanager", "tokamak-network", "tokamak network"],
    "monitor": ["monitor", "monitoring", "dashboard", "metrics", "health", "analytics", "chain-monitor", "chain monitor", "chain health", "real-time"],
    # Infra
    "frontend": ["react", "next.js", "nextjs", "frontend", "ui", "ux", "webapp"],
    "backend": ["api", "server", "fastapi", "express", "backend", "database", "graphql"],
    "devops": ["docker", "ci/cd", "deploy", "kubernetes", "terraform", "infra"],
    # AI
    "ai": ["ai", "llm", "machine learning", "ml", "agent", "chatbot", "openai", "gpt"],
}

# Map team repos to domain expertise
REPO_DOMAIN_MAP = {
    "tokamak-zk-evm": ["zk", "rollup", "smart-contracts"],
    "tokamak-zk-evm-contracts": ["zk", "smart-contracts"],
    "ton-staking-v2": ["staking", "smart-contracts", "token"],
    "tokamak-thanos": ["rollup", "sequencer", "bridge"],
    "tokamak-dao": ["dao", "smart-contracts"],
    "tokamak-dao-v2": ["dao", "smart-contracts"],
    "tokamak-dao-contracts": ["dao", "smart-contracts"],
    "crosstrade": ["bridge", "defi", "smart-contracts"],
    "tokamak-oracle-network": ["defi", "smart-contracts"],
    "tokamak-bridge": ["bridge", "frontend"],
    "tokamak-landing-page": ["frontend"],
    "enshrined-vrf": ["zk", "smart-contracts"],
    "commit-reveal-drb": ["zk", "smart-contracts"],
    "ethrex": ["rollup", "sequencer"],
    "secure-vote": ["zk", "dao"],
    "tokamon": ["token", "defi"],
    "trh-sdk": ["rollup", "tokamak", "sequencer"],
    "tokamak-thanos-event-listener": ["rollup", "monitor", "tokamak"],
    "sentinai": ["monitor", "backend"],
    "auto-research-press": ["backend", "tokamak"],
    "hr-automation-process": ["backend", "frontend", "tokamak"],
}


def _extract_domain_keywords(repo_analysis: Dict[str, Any], candidate_description: str = "", candidate_report: str = "") -> Dict[str, float]:
    """Extract domain keywords from candidate repo content, description, and report."""
    text = " ".join([
        (repo_analysis.get("readme_full", "") or ""),
        (repo_analysis.get("description", "") or ""),
        " ".join(repo_analysis.get("languages", {}).keys()),
        " ".join(repo_analysis.get("file_list", [])[:100]) if repo_analysis.get("file_list") else "",
        candidate_description,
        candidate_report,
    ]).lower()

    domain_scores: Dict[str, float] = {}
    for domain, keywords in DOMAIN_KEYWORDS.items():
        count = sum(text.count(kw) for kw in keywords)
        if count > 0:
            domain_scores[domain] = min(count * 0.3, 3.0)  # cap at 3.0

    return domain_scores


def _get_profile_domains(profile) -> Dict[str, float]:
    """Get domain expertise from team profile's top repos."""
    repos = json.loads(profile["top_repos"]) if profile["top_repos"] else []
    domain_scores: Dict[str, float] = {}

    for repo in repos:
        repo_name = (repo.get("name", "") or "").lower().replace("_", "-")
        for key, domains in REPO_DOMAIN_MAP.items():
            if key in repo_name:
                for d in domains:
                    domain_scores[d] = domain_scores.get(d, 0) + 1.0

    return domain_scores


def _match_from_profiles(profiles, repo_analysis: Dict[str, Any], exclude_email: Optional[str] = None) -> List[Dict[str, Any]]:
    """Match candidate repo against team_profiles using language + domain matching."""
    # 1. Language-based keywords
    candidate_lang_keywords = set()
    if repo_analysis:
        for lang in repo_analysis.get("languages", {}).keys():
            lang_lower = lang.lower()
            candidate_lang_keywords.add(lang_lower)
            mapping = {
                "solidity": ["solidity", "smart-contracts", "ethereum"],
                "typescript": ["typescript", "fullstack", "frontend"],
                "javascript": ["javascript", "fullstack", "frontend"],
                "python": ["python"],
                "rust": ["rust", "protocol"],
                "go": ["go", "protocol"],
                "css": ["frontend", "ui"],
                "html": ["frontend"],
            }
            for kw in mapping.get(lang_lower, []):
                candidate_lang_keywords.add(kw)

    # 2. Domain-based keywords from repo content + description + report
    desc = repo_analysis.get("_candidate_description", "") if repo_analysis else ""
    report = repo_analysis.get("_candidate_report", "") if repo_analysis else ""
    candidate_domains = _extract_domain_keywords(repo_analysis, desc, report) if repo_analysis else {}

    recommendations = []
    for profile in profiles:
        expertise = json.loads(profile["expertise_areas"]) if profile["expertise_areas"] else {}
        if not expertise:
            continue

        # Language match score
        lang_score = 0.0
        matching_langs = []
        for keyword in candidate_lang_keywords:
            if keyword in expertise:
                lang_score += expertise[keyword]
                matching_langs.append(keyword)

        # Domain match score (from repo content vs team repo domains)
        profile_domains = _get_profile_domains(profile)
        domain_score = 0.0
        matching_domains = []
        for domain, candidate_weight in candidate_domains.items():
            if domain in profile_domains:
                domain_score += candidate_weight * profile_domains[domain]
                matching_domains.append(domain)

        total_score = lang_score + (domain_score * 1.5)  # domain weighted 1.5x

        if total_score > 0:
            all_matching = matching_langs + matching_domains
            recommendations.append({
                "name": profile["display_name"] or profile["github_username"],
                "email": "",
                "github": profile["github_username"],
                "avatar_url": profile["avatar_url"] or "",
                "matching_skills": sorted(set(all_matching), key=lambda s: expertise.get(s, 0) + candidate_domains.get(s, 0), reverse=True)[:6],
                "match_score": round(total_score, 2),
                "expertise": expertise,
                "domain_match": matching_domains,
                "why": _build_why(matching_langs, matching_domains, expertise),
            })

    recommendations.sort(key=lambda x: x["match_score"], reverse=True)
    return recommendations[:3]


def _build_why(matching_langs: list, matching_domains: list, expertise: dict) -> str:
    parts = []
    if matching_domains:
        parts.append("Domain: " + ", ".join(matching_domains[:3]))
    if matching_langs:
        top_langs = sorted(matching_langs, key=lambda s: expertise.get(s, 0), reverse=True)[:3]
        parts.append("Skills: " + ", ".join(top_langs))
    return " | ".join(parts) if parts else "General match"


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
            return {"error": "Failed to clone: {}".format(str(e))}

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

        try:
            result = subprocess.run(
                ["git", "log", "--oneline", "--format=%H|%an|%s"],
                capture_output=True, text=True, cwd=repo_path, timeout=10
            )
            commits = result.stdout.strip().split("\n") if result.stdout.strip() else []
        except:
            commits = []

        has_tests = any(
            "test" in d.lower() or "spec" in d.lower()
            for _, dirs, _ in os.walk(repo_path)
            for d in dirs
        )

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
                        sample_files.append("--- {} ---\n{}".format(rel, content))
                        if len(sample_files) >= 5:
                            break
                    except:
                        pass
            if len(sample_files) >= 5:
                break

        readme = ""
        for name in ["README.md", "readme.md", "README.rst", "README"]:
            rp = os.path.join(repo_path, name)
            if os.path.exists(rp):
                readme = open(rp).read()[:3000]
                break

        # Quality metrics: documentation quality
        readme_len = len(readme)
        readme_sections = readme.count("\n#") + readme.count("\n##")
        readme_has_code_blocks = "```" in readme
        readme_has_install = any(kw in readme.lower() for kw in ["install", "setup", "getting started", "usage", "quick start"])

        # Quality metrics: code organization
        config_files = set()
        max_depth = 0
        src_dirs = set()
        for root, dirs, files in os.walk(repo_path):
            dirs[:] = [d for d in dirs if d not in {".git", "node_modules", "__pycache__", ".next", "dist", "build"}]
            depth = root.replace(repo_path, "").count(os.sep)
            if depth > max_depth:
                max_depth = depth
            for d in dirs:
                if d in {"src", "lib", "pkg", "internal", "cmd", "contracts", "components", "modules", "core", "utils"}:
                    src_dirs.add(d)
            for f in files:
                fl = f.lower()
                if fl in {".eslintrc", ".eslintrc.js", ".eslintrc.json", ".prettierrc", ".prettierrc.json",
                          "tsconfig.json", "hardhat.config.js", "hardhat.config.ts", "foundry.toml",
                          "dockerfile", "docker-compose.yml", "docker-compose.yaml",
                          ".github", "makefile", "justfile", "package.json", "cargo.toml", "go.mod",
                          ".editorconfig", "pyproject.toml", "setup.py", "setup.cfg"}:
                    config_files.add(fl)
                if f == ".github":
                    config_files.add(".github")
            # Check for .github directory at top level
            if depth == 0 and ".github" in dirs:
                config_files.add("ci/cd")

        return {
            "file_count": file_count,
            "total_size_kb": round(total_size / 1024, 1),
            "languages": dict(lang_counter.most_common(10)),
            "commit_count": len(commits),
            "has_tests": has_tests,
            "readme_preview": readme[:500],
            "sample_code": "\n\n".join(sample_files)[:6000],
            "readme_full": readme,
            # Quality density metrics
            "readme_length": readme_len,
            "readme_sections": readme_sections,
            "readme_has_code_blocks": readme_has_code_blocks,
            "readme_has_install_guide": readme_has_install,
            "config_files": list(config_files),
            "config_file_count": len(config_files),
            "max_dir_depth": max_depth,
            "src_dir_count": len(src_dirs),
        }


def _build_benchmark_prompt_section(benchmark: dict = None) -> str:
    """Build the benchmark comparison section for the AI prompt."""
    if not benchmark:
        return ""
    top_langs = list(benchmark.get("languages", {}).keys())[:5]
    return f"""
**Tokamak Network Org Benchmark (last 6 months, {benchmark['repo_count']} active repos):**
Compare the candidate's repository against these QUALITY-DENSITY metrics (not raw size/age).
Do NOT penalize the candidate for having fewer files or commits — Tokamak repos have been maintained for months/years.

Quality benchmarks from tokamak-network org:
- Test Presence: {int(benchmark['test_ratio'] * 100)}% of repos have test directories
- Documentation: {int(benchmark.get('doc_structured_ratio', 0) * 100)}% have structured README (2+ sections), {int(benchmark.get('doc_install_ratio', 0) * 100)}% include install/setup guide, {int(benchmark.get('doc_codeblock_ratio', 0) * 100)}% have code blocks in README
- Code Organization: avg {benchmark.get('avg_config_files', 0)} config files (linter, CI, build tools), avg {benchmark.get('avg_src_dirs', 0)} structured src directories, {int(benchmark.get('ci_ratio', 0) * 100)}% have CI/CD (.github)
- Primary Languages: {', '.join(top_langs)}

Evaluate the candidate's repo against these quality standards, not against raw quantity metrics.
"""


def _build_benchmark_fields(benchmark: dict = None) -> str:
    """Build extra JSON fields for benchmark comparison."""
    if not benchmark:
        return ""
    return """
- "benchmark_comparison": object with:
  - "overall_level": one of "above", "on_par", "below" (quality-density compared to Tokamak org)
  - "test_presence": "above" / "on_par" / "below" (does repo have tests vs org's test ratio?)
  - "documentation_quality": "above" / "on_par" / "below" (README structure, install guide, code examples vs org average)
  - "code_organization": "above" / "on_par" / "below" (config files, linter, CI/CD, modular directory structure vs org average)
  - "language_alignment": "above" / "on_par" / "below" (overlap with org's primary languages: Solidity, TypeScript, Go, etc.)
  - "summary": 1-2 sentence comparison summary focusing on quality density, not raw size"""


async def ai_analyze(repo_analysis: dict, description: str = "", demo_url: str = "", benchmark: dict = None) -> dict:
    """Call AI to generate qualitative analysis and scores with Track B criteria."""
    api_url = os.getenv("TOKAMAK_API_URL", os.getenv("AI_API_URL", "https://api.openai.com/v1/chat/completions"))
    api_key = os.getenv("TOKAMAK_API_KEY", os.getenv("AI_API_KEY", ""))
    model = os.getenv("TOKAMAK_MODEL", os.getenv("AI_MODEL", "gpt-4o-mini"))
    # Ensure URL ends with /chat/completions for OpenAI-compatible APIs
    if api_url and not api_url.endswith("/chat/completions"):
        api_url = api_url.rstrip("/") + "/v1/chat/completions"

    if not api_key:
        return _fallback_scores(repo_analysis)

    prompt = """Analyze this code repository for a hiring evaluation at Tokamak Network.

**About Tokamak Network:**
Tokamak Network builds customizable Layer 2 networks on Ethereum using the Thanos Stack (based on OP Stack v1.7.7, Optimistic Rollup).
- Core components: op-geth (execution), op-node (consensus), op-batcher (data submission), op-proposer (state updates)
- Cross-Layer Message Protocol for inter-L2 communication without base layer routing
- EVM-equivalent execution, EIP-4844 blob data availability, 12-second block times
- L1↔L2 Bridge: OptimismPortal, L1/L2StandardBridge, CrossChainMessenger
- TON token: staking (min 1,000.1 TON for DAO), seigniorage (3.92 TON/block, ~10.3M TON/year)
- Seigniorage model: T_Φ = S + T_L2, distributed to Stakers (Φ_S), Sequencers (Φ_L2), DAO (Φ_DAO)
- Sequencer economics: collateral bond, challenge mechanism (DTD 7-14 days), Group Challenge, Fast Withdrawal
- Key contracts: SeigManager, OptimismMintableERC20Factory, IOptimismMintableERC20
- Dev tools: Thanos SDK (TypeScript), Hardhat/Foundry, Solidity

This evaluation follows Tokamak's Track B philosophy: we value BUILDERS who solve real problems with working code.

Repository Info:
- Description: {description}
- Demo URL: {demo_url}
- Files: {files}, Size: {size}KB
- Languages: {langs}
- Commits: {commits}
- Has tests: {tests}

README:
{readme}

Sample Code:
{sample}
{benchmark_section}
Evaluate using these criteria:

**5 Scoring Dimensions (1-10 each):**

1. technical_completeness - Code quality, architecture, testing, documentation

2. ecosystem_fit (WEIGHTED 2x) - Relevance to Tokamak/Ethereum L2 ecosystem:
   - 9-10: Directly related to Thanos/OP Stack (L2 sequencer, op-geth, op-node, rollup verification, Cross-Layer Protocol)
   - 7-8: EVM/Solidity smart contracts, L1↔L2 bridge, ERC-20 standards, blockchain infrastructure
   - 5-6: General Ethereum development (DeFi, NFT, Web3), Hardhat/Foundry tooling
   - 3-4: Blockchain but non-EVM chains (Solana, Cosmos, etc.)
   - 1-2: Not blockchain related

3. tokenomics_impact - Understanding of token economics and protocol design:
   - 9-10: TON seigniorage model, verifier's dilemma, Group Challenge, Fast Withdrawal liquidity
   - 7-8: Staking/unstaking mechanisms, DAO governance, L2 deposit/withdrawal economics
   - 5-6: General tokenomics (staking, liquidity pools, governance tokens), DeFi protocol design
   - 3-4: Basic ERC-20/token transfers, simple reward distribution
   - 1-2: No tokenomics elements

4. contribution_potential - How likely this work can contribute to Tokamak Network:
   - 9-10: Directly extends or complements existing Tokamak repos (new tooling for Thanos, L2 monitoring, bridge UI)
   - 7-8: Addresses a gap in the current ecosystem (new UX approach, unexplored use case, novel developer tool)
   - 5-6: Related technology that could be adapted for Tokamak with some effort
   - 3-4: Generic blockchain work with loose connection to Tokamak
   - 1-2: No clear contribution path to Tokamak ecosystem

5. deliverable_completeness - Is there a tangible, working result?
   - 9-10: Deployed/demo-ready application, comprehensive tests, CI/CD pipeline
   - 7-8: Working application that can be run locally, has tests
   - 5-6: Partially working code with some runnable components
   - 3-4: Code exists but not easily runnable, no clear entry point
   - 1-2: Incomplete code, no working deliverable

**Track B Criteria (rate each as "strong", "adequate", or "weak"):**
- problem_definition: Is the problem clearly defined? Does it address a real need?
- implementation: Is there working code? Not just ideas but actual implementation?
- deliverable: Is there a demo, documentation, or deployment? Something tangible?

Respond in JSON with these fields:
- "summary": What does this project do? (2-3 sentences)
- "ecosystem_relevance": How does it relate to Tokamak Network / Ethereum L2? (1-2 sentences)
- "code_quality": Code quality assessment (1-2 sentences)
- "tokenomics_impact": Tokenomics/protocol-level impact potential (1-2 sentences)
- "contribution_potential_notes": How this work could contribute to Tokamak (1-2 sentences)
- "deliverable_notes": Deliverable completeness assessment (1-2 sentences)
- "scores": object with integer 1-10 for: "technical_completeness", "ecosystem_fit", "tokenomics_impact", "contribution_potential", "deliverable_completeness"
- "track_b": object with "problem_definition", "implementation", "deliverable" (each "strong"/"adequate"/"weak") and "track_b_summary" (1-2 sentences)
- "recommendation": one of "Strong Hire", "Hire", "Maybe", "Pass"
- "report": Full evaluation report (3-5 paragraphs){benchmark_fields}

Return ONLY valid JSON.""".format(
        description=description,
        demo_url=demo_url or "N/A",
        files=repo_analysis.get('file_count', 0),
        size=repo_analysis.get('total_size_kb', 0),
        langs=json.dumps(repo_analysis.get('languages', {})),
        commits=repo_analysis.get('commit_count', 0),
        tests=repo_analysis.get('has_tests', False),
        readme=repo_analysis.get('readme_full', 'N/A')[:2000],
        sample=repo_analysis.get('sample_code', 'N/A')[:4000],
        benchmark_section=_build_benchmark_prompt_section(benchmark),
        benchmark_fields=_build_benchmark_fields(benchmark),
    )

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(api_url, headers={
                "Authorization": "Bearer {}".format(api_key),
                "Content-Type": "application/json"
            }, json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 4096,
            })
            data = resp.json()
            if "error" in data:
                print(f"AI API error: {data['error']}")
                return _fallback_scores(repo_analysis)
            content = data["choices"][0]["message"]["content"]
            if content.startswith("```"):
                content = content.split("\n", 1)[1].rsplit("```", 1)[0]
            result = json.loads(content)
            # Calculate weighted score
            if "scores" in result:
                result["weighted_score"] = calculate_weighted_score(result["scores"])
            return result
    except Exception as e:
        import traceback
        print("AI analysis failed: {} — {}".format(type(e).__name__, e))
        traceback.print_exc()
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
    contrib = eco  # fallback: same as ecosystem fit
    deliv = min(8, max(1, 2 + (2 if has_tests else 0) + min(4, fc // 15)))

    scores = {
        "technical_completeness": tech,
        "ecosystem_fit": eco,
        "tokenomics_impact": tok,
        "contribution_potential": contrib,
        "deliverable_completeness": deliv,
    }

    return {
        "summary": "Automated analysis (AI unavailable)",
        "ecosystem_relevance": "Could not determine without AI analysis",
        "code_quality": "Basic metrics only",
        "tokenomics_impact": "Unknown",
        "innovation_notes": "Unknown",
        "ai_usage_evidence": "Unknown",
        "scores": scores,
        "weighted_score": calculate_weighted_score(scores),
        "track_b": {
            "problem_definition": "adequate",
            "implementation": "adequate" if cc > 5 else "weak",
            "deliverable": "adequate" if has_tests else "weak",
            "track_b_summary": "Automated evaluation - AI unavailable for detailed Track B assessment.",
        },
        "recommendation": "Maybe",
        "report": "Automated analysis: {} files, {} commits, languages: {}. AI analysis unavailable.".format(
            fc, cc, ", ".join(langs.keys())
        ),
    }


async def analyze_org_benchmark(org_name: str = "tokamak-network", months: int = 6, max_repos: int = 15) -> dict:
    """Analyze recent active repos from a GitHub org to build a quality benchmark.

    Returns a benchmark profile with average metrics across active repos.
    """
    from datetime import datetime, timedelta
    import httpx

    token = os.getenv("GITHUB_TOKEN", "")
    if not token:
        return {"error": "GITHUB_TOKEN not set"}

    cutoff = (datetime.utcnow() - timedelta(days=months * 30)).isoformat() + "Z"
    headers = {"Authorization": f"token {token}", "Accept": "application/vnd.github.v3+json"}

    # Fetch org repos sorted by recent push, filter by cutoff
    repos_data = []
    page = 1
    async with httpx.AsyncClient(timeout=30) as client:
        while len(repos_data) < max_repos:
            resp = await client.get(
                f"https://api.github.com/orgs/{org_name}/repos",
                headers=headers,
                params={"sort": "pushed", "direction": "desc", "per_page": 30, "page": page},
            )
            if resp.status_code != 200:
                return {"error": f"GitHub API error: {resp.status_code}"}
            batch = resp.json()
            if not batch:
                break
            for r in batch:
                if r.get("pushed_at", "") >= cutoff and not r.get("fork", False) and not r.get("archived", False):
                    repos_data.append(r)
            page += 1
            if page > 3:
                break

    repos_data = repos_data[:max_repos]
    if not repos_data:
        return {"error": "No active repos found"}

    # Analyze each repo
    analyzed = []
    for repo in repos_data:
        clone_url = repo.get("clone_url", "")
        if not clone_url:
            continue
        try:
            result = await analyze_repo(clone_url)
            if "error" not in result:
                result["repo_name"] = repo["name"]
                result["pushed_at"] = repo.get("pushed_at", "")
                result["stars"] = repo.get("stargazers_count", 0)
                result["description"] = repo.get("description", "")
                analyzed.append(result)
        except Exception as e:
            print(f"Benchmark: failed to analyze {repo['name']}: {e}")
            continue

    if not analyzed:
        return {"error": "No repos could be analyzed"}

    # Aggregate quality-density metrics
    n = len(analyzed)
    test_count = sum(1 for r in analyzed if r.get("has_tests"))
    readme_with_sections = sum(1 for r in analyzed if r.get("readme_sections", 0) >= 2)
    readme_with_install = sum(1 for r in analyzed if r.get("readme_has_install_guide"))
    readme_with_code = sum(1 for r in analyzed if r.get("readme_has_code_blocks"))
    avg_config_files = round(sum(r.get("config_file_count", 0) for r in analyzed) / n, 1)
    avg_src_dirs = round(sum(r.get("src_dir_count", 0) for r in analyzed) / n, 1)
    ci_count = sum(1 for r in analyzed if "ci/cd" in r.get("config_files", []))

    # Aggregate language distribution
    lang_counter = Counter()
    for r in analyzed:
        for lang, count in r.get("languages", {}).items():
            lang_counter[lang] += count

    repo_summaries = []
    for r in analyzed:
        repo_summaries.append({
            "name": r["repo_name"],
            "has_tests": r.get("has_tests", False),
            "readme_sections": r.get("readme_sections", 0),
            "readme_has_install_guide": r.get("readme_has_install_guide", False),
            "config_file_count": r.get("config_file_count", 0),
            "src_dir_count": r.get("src_dir_count", 0),
            "languages": list(r.get("languages", {}).keys())[:5],
            "stars": r.get("stars", 0),
            "description": r.get("description", ""),
        })

    benchmark = {
        "org_name": org_name,
        "repo_count": n,
        "avg_file_count": round(sum(r["file_count"] for r in analyzed) / n, 1),
        "avg_commit_count": round(sum(r["commit_count"] for r in analyzed) / n, 1),
        "avg_size_kb": round(sum(r["total_size_kb"] for r in analyzed) / n, 1),
        "test_ratio": round(test_count / n, 2),
        # New quality-density metrics
        "doc_structured_ratio": round(readme_with_sections / n, 2),
        "doc_install_ratio": round(readme_with_install / n, 2),
        "doc_codeblock_ratio": round(readme_with_code / n, 2),
        "avg_config_files": avg_config_files,
        "avg_src_dirs": avg_src_dirs,
        "ci_ratio": round(ci_count / n, 2),
        "languages": dict(lang_counter.most_common(10)),
        "repo_details": repo_summaries,
    }
    return benchmark


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
            "profile_url": "https://github.com/{}".format(username),
            "bio": user.bio or "",
            "public_repos": user.public_repos,
            "followers": user.followers,
            "languages": dict(lang_counter.most_common(10)),
            "recent_repos": [{"name": r.name, "stars": r.stargazers_count, "language": r.language} for r in repos[:10]],
        }
    except Exception as e:
        return {"username": username, "error": str(e)}
