# Contributing to Tokamak Hiring System

Thank you for your interest in contributing! This project powers Tokamak Network's AI-driven hiring pipeline.

## How We Hire (and How You Can Help)

We believe in **Track B evaluation** — no resumes, no algorithm puzzles. We evaluate based on real deliverables. If you're interested in joining Tokamak Network, check out our [Track B process](#track-b-evaluation).

## Getting Started

1. Fork and clone the repository
2. Set up your environment (see [README.md](README.md#-시작하기))
3. Create a feature branch: `git checkout -b feat/your-feature`
4. Make your changes
5. Test locally (backend on port 8001, frontend on port 3002)
6. Submit a Pull Request

## Development Setup

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env  # Configure your API keys
uvicorn main:app --reload --port 8001

# Frontend
cd frontend
npm install
npm run dev -- -p 3002
```

## Code Style

- **Python**: Follow PEP 8, Python 3.9 compatible (no `match/case`, no `X|Y` union types)
- **TypeScript/React**: Functional components, hooks-based
- **Commits**: Use conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`)

## Areas for Contribution

- 🔍 Improving candidate sourcing algorithms
- 🎨 Frontend UI/UX improvements
- 📊 Evaluation criteria refinement
- 🔗 New integration sources (beyond GitHub + LinkedIn)
- 📖 Documentation and i18n
- 🧪 Testing coverage

## Track B Evaluation

Our hiring process evaluates candidates on three dimensions:

1. **Problem Definition** — Can you clearly define the problem you're solving?
2. **Implementation** — Does your code work? Is it well-architected?
3. **Deliverable** — Is there a demo, documentation, or deployed result?

## License

By contributing, you agree that your contributions will be licensed under the project's license.
