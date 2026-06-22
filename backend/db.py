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
# 로컬 개발 override — .env 다음에 backend/.env.local 을 적용(로컬 기본값).
# 단, 환경에 DATABASE_URL 이 이미 주어진 경우(run-cloud.sh 인라인 주입 / 운영 플랫폼 env)
# 에는 그 명시 주입을 존중하고 .env.local override 를 건너뛴다.
if not os.getenv("DATABASE_URL"):
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env.local"), override=True)

DATABASE_URL = os.getenv("DATABASE_URL", "")
DB_PATH = os.path.join(os.path.dirname(__file__), "hiring.db")

# Use PostgreSQL if DATABASE_URL is set, otherwise SQLite
USE_PG = bool(DATABASE_URL and DATABASE_URL.startswith("postgresql"))


def _is_local_host(url: str) -> bool:
    from urllib.parse import urlparse
    try:
        h = (urlparse(url).hostname or "").lower()
    except Exception:
        h = ""
    return h in ("", "localhost", "127.0.0.1", "::1")


# C가드 — 비로컬(운영 Supabase 등) DB로의 실수 연결 방지.
# 호스트가 로컬이 아니면 ALLOW_PROD_DB=1 이 없는 한 즉시 중단.
# ALLOW_PROD_DB 는 운영 플랫폼 env 에만 둔다(로컬 .env/.env.local 금지).
if USE_PG and not _is_local_host(DATABASE_URL):
    import sys
    from urllib.parse import urlparse
    _host = urlparse(DATABASE_URL).hostname or "(unknown)"
    if os.getenv("ALLOW_PROD_DB") != "1":
        sys.stderr.write(
            "\n" + "=" * 70 + "\n"
            f"  ⛔ 비로컬 DATABASE_URL 차단: host={_host}\n"
            "  운영(또는 원격) DB로의 연결이 감지됐습니다.\n"
            "  로컬 개발은 backend/.env.local 의 로컬 PG(localhost)를 쓰세요.\n"
            "  의도된 운영 접속이면 ALLOW_PROD_DB=1 을 환경변수로 주입하세요\n"
            "  (예: ALLOW_PROD_DB=1 DATABASE_URL=... python ...). 로컬 파일엔 넣지 말 것.\n"
            + "=" * 70 + "\n\n"
        )
        raise RuntimeError(f"Refusing to use non-local DATABASE_URL (host={_host}) without ALLOW_PROD_DB=1")
    sys.stderr.write(f"\n  ⚠️ ALLOW_PROD_DB=1 — 비로컬 DB(host={_host})에 연결합니다.\n\n")

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
        # C-1 §1: email-intake columns on candidates
        await conn.execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS wallet_address TEXT")
        await conn.execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'")
        await conn.execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS source_email_id TEXT")
        await conn.execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS detected_at TEXT")
        # C-1 §3: detected_applicants staging table (감지됨/검토 대기)
        await conn.execute(
            "CREATE TABLE IF NOT EXISTS detected_applicants ("
            "id SERIAL PRIMARY KEY, sender_email TEXT NOT NULL UNIQUE, sender_name TEXT, "
            "repo_url TEXT, wallet_address TEXT, status TEXT DEFAULT 'detected', "
            "source_email_ids TEXT, first_detected_at TEXT, updated_at TEXT, "
            "registered_candidate_id INTEGER)"
        )
        # RLS 기본 거부 유지: 정책 없이 RLS만 켠다(서비스 역할만 백엔드 경유 접근).
        await conn.execute("ALTER TABLE detected_applicants ENABLE ROW LEVEL SECURITY")
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
