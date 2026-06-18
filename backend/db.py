"""
Database abstraction layer — supports both SQLite (local) and PostgreSQL (Supabase).
Automatically selects based on DATABASE_URL env var.
"""
import os
import re
import asyncpg
import aiosqlite
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")
DB_PATH = os.path.join(os.path.dirname(__file__), "hiring.db")

# Use PostgreSQL if DATABASE_URL is set, otherwise SQLite
USE_PG = bool(DATABASE_URL and DATABASE_URL.startswith("postgresql"))

_pg_pool = None


def _sqlite_to_pg_params(sql, params):
    """Convert SQLite ? placeholders to PostgreSQL $1, $2, ... format."""
    if not params:
        return sql, params

    counter = [0]
    def replace_placeholder(match):
        counter[0] += 1
        return f"${counter[0]}"

    converted = re.sub(r'\?', replace_placeholder, sql)
    return converted, list(params)


class PgCursorWrapper:
    """Wraps asyncpg results to behave like aiosqlite cursor."""
    def __init__(self, rows):
        self._rows = rows

    async def fetchone(self):
        if self._rows and len(self._rows) > 0:
            return dict(self._rows[0])
        return None

    async def fetchall(self):
        return [dict(r) for r in self._rows]


class PgConnectionWrapper:
    """Wraps asyncpg connection to match aiosqlite interface."""
    def __init__(self, conn):
        self._conn = conn
        self.total_changes = 0

    async def execute(self, sql, params=None):
        sql, params = _sqlite_to_pg_params(sql, params or ())
        # Handle datetime('now') → NOW()
        sql = sql.replace("datetime('now')", "NOW()::TEXT")

        try:
            if sql.strip().upper().startswith("SELECT"):
                rows = await self._conn.fetch(sql, *params)
                return PgCursorWrapper(rows)
            else:
                result = await self._conn.execute(sql, *params)
                # Extract affected rows count
                if result:
                    try:
                        self.total_changes = int(result.split()[-1])
                    except:
                        self.total_changes = 0

                # For INSERT ... RETURNING, return cursor-like
                if "RETURNING" in sql.upper():
                    rows = await self._conn.fetch(sql, *params)
                    return PgCursorWrapper(rows)

                # Simulate lastrowid for INSERT
                cursor = type('Cursor', (), {'lastrowid': 0})()
                return cursor
        except Exception as e:
            raise e

    async def executescript(self, sql):
        """Execute multiple statements (PostgreSQL)."""
        for stmt in sql.split(";"):
            stmt = stmt.strip()
            if stmt:
                try:
                    await self._conn.execute(stmt)
                except Exception as e:
                    pass  # Skip errors for CREATE IF NOT EXISTS etc.

    async def commit(self):
        pass  # asyncpg auto-commits in pooler mode

    async def close(self):
        await self._conn.close()


async def get_db():
    """Get a database connection. Returns aiosqlite or PgConnectionWrapper."""
    if USE_PG:
        conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
        return PgConnectionWrapper(conn)
    else:
        db = await aiosqlite.connect(DB_PATH)
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA busy_timeout=5000")
        return db


async def _pg_migrate():
    """Idempotent additive migrations for PostgreSQL/Supabase.
    Adds columns only — never touches RLS (default-deny stays as-is)."""
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    try:
        # C-1: email-intake columns on candidates
        await conn.execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS wallet_address TEXT")
        await conn.execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'")
        await conn.execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS source_email_id TEXT")
        await conn.execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS detected_at TEXT")
    finally:
        await conn.close()


async def init_db():
    """Initialize database. For PostgreSQL, tables are created via migration script."""
    if USE_PG:
        # Tables already created by migrate_to_pg.py
        print(f"Using PostgreSQL: {DATABASE_URL[:40]}...")
        await _pg_migrate()
        return

    # SQLite initialization (existing logic)
    from database import init_db as sqlite_init_db
    await sqlite_init_db()
