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
    """)
    await db.commit()
    await db.close()
