# Tokamak Hiring Framework

AI-powered hiring pipeline for Tokamak Network. No resumes — results only.

## Philosophy
- No job titles, no resumes — submit a **Track B deliverable** (working product that contributes to Tokamak ecosystem)
- Evaluation via ATI-compatible metrics (commits, code quality, ecosystem synergy)
- Same standard for internal team and external candidates

## Architecture

### Core Pipeline
1. **Intake** — Web form for candidates to submit repo URL + brief description
2. **Auto Analysis** — Clone repo → AI-powered evaluation (code quality, ecosystem fit, tokenomics impact)
3. **Scorecard** — Generated report for each candidate with scores + recommendations
4. **Dashboard** — View all candidates, filter, compare

### Auto Candidate Recommendation
1. **GitHub Monitor** — Track stars, forks, PRs, issues on tokamak-network org repos
2. **Profile Analysis** — Analyze active external contributors' GitHub profiles
3. **Scoring** — Rate potential candidates based on activity patterns + expertise
4. **Alert** — Notify when high-potential candidates are detected

## Tech Stack
- **Backend**: Python + FastAPI
- **Frontend**: Next.js (consistent with report generator)
- **AI**: Multi-model support via existing Tokamak API proxy
- **GitHub**: PyGithub for API access
# hr-automation-process