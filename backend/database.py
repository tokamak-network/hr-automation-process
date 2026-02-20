import aiosqlite
import os
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "hiring.db")

async def get_db():
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    return db

async def init_db():
    db = await get_db()
    await db.executescript("""
    CREATE TABLE IF NOT EXISTS candidates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        repo_url TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'submitted',
        scores TEXT,
        report TEXT,
        recommendation TEXT,
        repo_analysis TEXT,
        track_b_evaluation TEXT,
        weighted_score REAL,
        reviewed_by TEXT,
        analyzed_by TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        analyzed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS monitor_candidates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        github_username TEXT UNIQUE NOT NULL,
        profile_url TEXT,
        bio TEXT,
        public_repos INTEGER DEFAULT 0,
        followers INTEGER DEFAULT 0,
        languages TEXT,
        contributions TEXT,
        scores TEXT,
        activity_level TEXT,
        last_scanned TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT DEFAULT 'viewer',
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS team_skills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        github_username TEXT NOT NULL,
        name TEXT NOT NULL,
        skills TEXT NOT NULL,
        UNIQUE(user_email)
    );
    CREATE TABLE IF NOT EXISTS team_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        github_username TEXT UNIQUE NOT NULL,
        display_name TEXT,
        avatar_url TEXT,
        expertise_areas TEXT,
        top_repos TEXT,
        languages TEXT,
        review_count INTEGER DEFAULT 0,
        last_active TEXT,
        last_profiled TEXT,
        is_active INTEGER DEFAULT 1
    );
    """)

    # Pre-populate users and team_skills
    team_data = [
        ("Kevin", "kevin@tokamak.network", "admin", "ggs134", "protocol,tokenomics,smart-contracts,ethereum,solidity"),
        ("Jaden", "jaden@tokamak.network", "reviewer", "Jaden-Kong", "fullstack,ops,devops,typescript,javascript,python"),
        ("Mehdi", "mehdi@tokamak.network", "reviewer", "Mehd1b", "frontend,react,typescript,javascript,css,ui"),
        ("Jason", "jason@tokamak.network", "reviewer", "SonYoungsung", "l2,bridge,rollup,ethereum,solidity,typescript"),
    ]

    for name, email, role, github, skills in team_data:
        await db.execute(
            "INSERT OR IGNORE INTO users (name, email, role) VALUES (?, ?, ?)",
            (name, email, role)
        )
        await db.execute(
            "INSERT OR IGNORE INTO team_skills (user_email, github_username, name, skills) VALUES (?, ?, ?, ?)",
            (email, github, name, skills)
        )

    await db.commit()
    await db.close()
