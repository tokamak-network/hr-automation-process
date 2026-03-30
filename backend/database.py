import aiosqlite
import os
import json
import shutil
import glob
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "hiring.db")

BACKUP_DIR = os.path.join(os.path.dirname(__file__), "backups")


def backup_db():
    """Create a timestamped backup. Keeps last 10 backups."""
    if not os.path.exists(DB_PATH):
        return
    os.makedirs(BACKUP_DIR, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = os.path.join(BACKUP_DIR, f"hiring_{ts}.db")
    shutil.copy2(DB_PATH, dest)
    # Prune old backups, keep last 10
    backups = sorted(glob.glob(os.path.join(BACKUP_DIR, "hiring_*.db")))
    for old in backups[:-10]:
        os.remove(old)


async def get_db():
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA busy_timeout=5000")
    return db

async def init_db():
    backup_db()
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
    CREATE TABLE IF NOT EXISTS monitor_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        github_username TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        repo_name TEXT NOT NULL,
        activity_url TEXT NOT NULL,
        activity_date TEXT,
        details TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(github_username, activity_type, activity_url)
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
    CREATE TABLE IF NOT EXISTS monitor_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        github_username TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        repo_name TEXT,
        activity_url TEXT,
        activity_date TEXT,
        details TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(github_username, activity_type, activity_url)
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
    CREATE TABLE IF NOT EXISTS outreach_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        candidate_id INTEGER NOT NULL,
        candidate_type TEXT DEFAULT 'linkedin',
        template_used TEXT,
        message_sent TEXT,
        channel TEXT DEFAULT 'linkedin_dm',
        status TEXT DEFAULT 'sent',
        sent_at TEXT DEFAULT (datetime('now')),
        sent_by TEXT
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

    # ── HR/Payroll tables ──
    await db.executescript("""
    CREATE TABLE IF NOT EXISTS hr_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        github TEXT,
        role TEXT NOT NULL,
        monthly_usdt REAL NOT NULL,
        wallet_address TEXT,
        contract_start TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS payrolls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        usdt_amount REAL NOT NULL,
        krw_rate REAL NOT NULL,
        krw_amount REAL NOT NULL,
        tax_simulated REAL DEFAULT 0,
        reserve_tokamak REAL DEFAULT 0,
        net_pay_krw REAL DEFAULT 0,
        status TEXT DEFAULT 'estimated',
        created_at TEXT DEFAULT (datetime('now')),
        confirmed_at TEXT,
        paid_at TEXT,
        FOREIGN KEY (member_id) REFERENCES hr_members(id)
    );
    CREATE TABLE IF NOT EXISTS incentives (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        quarter INTEGER NOT NULL,
        tokamak_amount REAL NOT NULL,
        tokamak_krw_rate REAL NOT NULL,
        krw_amount REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (member_id) REFERENCES hr_members(id)
    );
    CREATE TABLE IF NOT EXISTS hr_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tx_hash TEXT,
        from_address TEXT,
        to_address TEXT,
        amount REAL,
        token TEXT DEFAULT 'USDT',
        status TEXT DEFAULT 'confirmed',
        timestamp TEXT,
        note TEXT
    );
    CREATE TABLE IF NOT EXISTS reserves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        tokamak_amount REAL NOT NULL,
        krw_value REAL NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (member_id) REFERENCES hr_members(id)
    );
    """)

    # Seed HR members if empty
    cursor = await db.execute("SELECT COUNT(*) FROM hr_members")
    row = await cursor.fetchone()
    if row[0] == 0:
        import random
        hr_members = [
            ("Kevin", "ggs134", "CEO / Representative", 15000, "0x1a2b3c4d5e6f7890abcdef1234567890abcdef01", "2020-01-01"),
            ("Jaden", "Jaden-Kong", "Directing Manager", 12000, "0x2b3c4d5e6f7890abcdef1234567890abcdef0102", "2020-03-15"),
            ("Sujin Park", "sujin-park", "Senior Developer", 10000, "0x3c4d5e6f7890abcdef1234567890abcdef010203", "2021-06-01"),
            ("Minho Lee", "minho-dev", "Backend Developer", 9000, "0x4d5e6f7890abcdef1234567890abcdef01020304", "2022-01-10"),
            ("Yuna Kim", "yuna-kim", "Frontend Developer", 9000, "0x5e6f7890abcdef1234567890abcdef0102030405", "2022-04-01"),
            ("Hyunwoo Cho", "hyunwoo-cho", "Smart Contract Developer", 10000, "0x6f7890abcdef1234567890abcdef010203040506", "2021-09-15"),
            ("Eunji Hwang", "eunji-design", "UI/UX Designer", 8000, "0x7890abcdef1234567890abcdef01020304050607", "2023-02-01"),
            ("Dongwon Shin", "dongwon-r", "Researcher", 8500, "0x890abcdef1234567890abcdef0102030405060708", "2022-07-01"),
            ("Jiyeon Oh", "jiyeon-ops", "Operations Manager", 7500, "0x90abcdef1234567890abcdef010203040506070809", "2023-05-15"),
            ("Taehoon Ryu", "taehoon-sec", "Security Engineer", 9500, "0xa0bcdef1234567890abcdef01020304050607080910", "2022-11-01"),
        ]
        for m in hr_members:
            await db.execute("INSERT INTO hr_members (name, github, role, monthly_usdt, wallet_address, contract_start) VALUES (?,?,?,?,?,?)", m)

        for month in range(1, 4):
            for mid in range(1, 11):
                cursor2 = await db.execute("SELECT monthly_usdt FROM hr_members WHERE id=?", (mid,))
                member = await cursor2.fetchone()
                usdt = member[0]
                krw_rate = 1350 + random.uniform(-20, 20)
                krw = usdt * krw_rate
                tax = krw * 0.06
                status = "paid" if month < 3 else ("confirmed" if month == 3 else "estimated")
                await db.execute(
                    "INSERT INTO payrolls (member_id, year, month, usdt_amount, krw_rate, krw_amount, tax_simulated, reserve_tokamak, net_pay_krw, status) VALUES (?,?,?,?,?,?,?,?,?,?)",
                    (mid, 2026, month, usdt, round(krw_rate, 2), round(krw, 0), round(tax, 0), round(tax / 3200, 4), round(krw - tax, 0), status))

        txs = [
            ("0xabc123def456789...001", "0x1a2b...ef01", "0x2b3c...0102", 98500, "USDT", "confirmed", "2026-01-31T09:00:00Z", "Jan payroll"),
            ("0xabc123def456789...002", "0x1a2b...ef01", "0x2b3c...0102", 98500, "USDT", "confirmed", "2026-02-28T09:00:00Z", "Feb payroll"),
            ("0xabc123def456789...003", "0x1a2b...ef01", "0x2b3c...0102", 98500, "USDT", "pending", "2026-03-31T09:00:00Z", "Mar payroll"),
        ]
        for tx in txs:
            await db.execute("INSERT INTO hr_transactions (tx_hash, from_address, to_address, amount, token, status, timestamp, note) VALUES (?,?,?,?,?,?,?,?)", tx)

        for mid in range(1, 11):
            tok = random.uniform(500, 2000)
            await db.execute("INSERT INTO incentives (member_id, year, quarter, tokamak_amount, tokamak_krw_rate, krw_amount, status) VALUES (?,?,?,?,?,?,?)",
                (mid, 2026, 1, round(tok, 2), 3200, round(tok * 3200, 0), "pending"))

    # Migration: add linkedin_url to monitor_candidates if missing
    try:
        cursor = await db.execute("PRAGMA table_info(monitor_candidates)")
        columns = [row[1] for row in await cursor.fetchall()]
        if "linkedin_url" not in columns:
            await db.execute("ALTER TABLE monitor_candidates ADD COLUMN linkedin_url TEXT")
    except Exception:
        pass

    await db.commit()
    await db.close()
