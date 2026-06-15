"""
Expense DB — repo 바깥 SQLite for sensitive HR/expense data.
Path is read from HR_DB_PATH env var. Falls back to ~/hr-data/hr.db.
"""
import os
import aiosqlite
from dotenv import load_dotenv

load_dotenv()

HR_DB_PATH = os.getenv("HR_DB_PATH", os.path.expanduser("~/hr-data/hr.db"))


async def get_expense_db():
    """Get a connection to the expense SQLite DB (repo 바깥)."""
    os.makedirs(os.path.dirname(HR_DB_PATH), exist_ok=True)
    db = await aiosqlite.connect(HR_DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA busy_timeout=5000")
    return db


async def init_expense_db():
    """Create expense_decisions table if not exists."""
    db = await get_expense_db()
    await db.executescript("""
    CREATE TABLE IF NOT EXISTS expense_decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        period TEXT NOT NULL,
        submitter TEXT NOT NULL,
        vendor TEXT,
        item TEXT,
        reason TEXT,
        amount_original REAL NOT NULL,
        currency_original TEXT NOT NULL DEFAULT 'USD',
        fx_date_estimate DATE,
        fx_rate_estimate REAL,
        amount_usd_estimate REAL,
        payment_date DATE,
        fx_date_confirmed DATE,
        fx_rate_confirmed REAL,
        amount_usd_confirmed REAL,
        evidence_status TEXT DEFAULT 'incomplete',
        evidence_ref TEXT,
        flags TEXT,
        decision TEXT DEFAULT 'pending',
        decided_by TEXT,
        decided_at DATETIME,
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_dedup
        ON expense_decisions (period, submitter, vendor, amount_original, fx_date_estimate);
    """)
    await db.commit()
    await db.close()
    print(f"Expense DB ready: {HR_DB_PATH}")
