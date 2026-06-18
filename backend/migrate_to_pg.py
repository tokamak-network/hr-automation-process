"""Migrate SQLite data to Supabase PostgreSQL."""
import asyncio
import asyncpg
import sqlite3
import os
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv("DATABASE_URL")
SQLITE_PATH = os.path.join(os.path.dirname(__file__), "hiring.db")

CREATE_SQL = """
CREATE TABLE IF NOT EXISTS candidates (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, repo_url TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'submitted', scores TEXT, report TEXT, recommendation TEXT, repo_analysis TEXT, track_b_evaluation TEXT, weighted_score REAL, reviewed_by TEXT, analyzed_by TEXT, created_at TEXT, analyzed_at TEXT, demo_url TEXT, wallet_address TEXT, source TEXT DEFAULT 'manual', source_email_id TEXT, detected_at TEXT);

CREATE TABLE IF NOT EXISTS monitor_candidates (id SERIAL PRIMARY KEY, github_username TEXT UNIQUE NOT NULL, profile_url TEXT, bio TEXT, public_repos INTEGER DEFAULT 0, followers INTEGER DEFAULT 0, languages TEXT, contributions TEXT, scores TEXT, activity_level TEXT, last_scanned TEXT, linkedin_url TEXT);

CREATE TABLE IF NOT EXISTS monitor_activities (id SERIAL PRIMARY KEY, github_username TEXT NOT NULL, activity_type TEXT NOT NULL, repo_name TEXT NOT NULL, activity_url TEXT NOT NULL, activity_date TEXT, details TEXT, created_at TEXT);

CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, role TEXT DEFAULT 'viewer', created_at TEXT);

CREATE TABLE IF NOT EXISTS team_skills (id SERIAL PRIMARY KEY, user_email TEXT NOT NULL, github_username TEXT NOT NULL, name TEXT NOT NULL, skills TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS team_profiles (id SERIAL PRIMARY KEY, github_username TEXT UNIQUE NOT NULL, display_name TEXT, avatar_url TEXT, expertise_areas TEXT, top_repos TEXT, languages TEXT, review_count INTEGER DEFAULT 0, last_active TEXT, last_profiled TEXT, is_active INTEGER DEFAULT 1);

CREATE TABLE IF NOT EXISTS outreach_history (id SERIAL PRIMARY KEY, candidate_id INTEGER NOT NULL, candidate_type TEXT DEFAULT 'linkedin', template_used TEXT, message_sent TEXT, channel TEXT DEFAULT 'linkedin_dm', status TEXT DEFAULT 'sent', sent_at TEXT, sent_by TEXT);

CREATE TABLE IF NOT EXISTS hr_members (id SERIAL PRIMARY KEY, name TEXT NOT NULL, github TEXT, role TEXT NOT NULL, monthly_usdt REAL NOT NULL, wallet_address TEXT, contract_start TEXT, is_active INTEGER DEFAULT 1, created_at TEXT, contract_end TEXT, name_kr TEXT, email TEXT, phone TEXT, personal_email TEXT, birthday TEXT, education TEXT, nationality TEXT, is_rnd TEXT, address TEXT, company TEXT);

CREATE TABLE IF NOT EXISTS payrolls (id SERIAL PRIMARY KEY, member_id INTEGER NOT NULL, year INTEGER NOT NULL, month INTEGER NOT NULL, usdt_amount REAL NOT NULL, krw_rate REAL NOT NULL, krw_amount REAL NOT NULL, tax_simulated REAL DEFAULT 0, reserve_tokamak REAL DEFAULT 0, net_pay_krw REAL DEFAULT 0, status TEXT DEFAULT 'estimated', created_at TEXT, confirmed_at TEXT, paid_at TEXT, tx_hash TEXT);

CREATE TABLE IF NOT EXISTS incentives (id SERIAL PRIMARY KEY, member_id INTEGER NOT NULL, year INTEGER NOT NULL, quarter INTEGER NOT NULL, tokamak_amount REAL NOT NULL, tokamak_krw_rate REAL NOT NULL, krw_amount REAL NOT NULL, status TEXT DEFAULT 'pending', created_at TEXT);

CREATE TABLE IF NOT EXISTS hr_transactions (id SERIAL PRIMARY KEY, tx_hash TEXT, from_address TEXT, to_address TEXT, amount REAL, token TEXT DEFAULT 'USDT', status TEXT DEFAULT 'confirmed', "timestamp" TEXT, note TEXT);

CREATE TABLE IF NOT EXISTS reserves (id SERIAL PRIMARY KEY, member_id INTEGER NOT NULL, year INTEGER NOT NULL, tokamak_amount REAL NOT NULL, krw_value REAL NOT NULL, description TEXT, created_at TEXT);

CREATE TABLE IF NOT EXISTS linkedin_candidates (id SERIAL PRIMARY KEY, linkedin_username TEXT UNIQUE, full_name TEXT, headline TEXT, location TEXT, profile_url TEXT, open_to_work INTEGER DEFAULT 0, current_company TEXT, search_keyword TEXT, raw_data TEXT, score REAL DEFAULT 0, status TEXT DEFAULT 'discovered', created_at TEXT, notes TEXT DEFAULT '', source TEXT DEFAULT 'search', github_url TEXT, first_seen_at TEXT, last_searched_at TEXT, search_count TEXT, score_breakdown TEXT);

CREATE TABLE IF NOT EXISTS hr_settings (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS hr_wallets (id SERIAL PRIMARY KEY, label TEXT NOT NULL, address TEXT NOT NULL, chain TEXT DEFAULT 'ERC-20', is_active INTEGER DEFAULT 1, created_at TEXT);

CREATE TABLE IF NOT EXISTS member_wallets (id SERIAL PRIMARY KEY, member_id INTEGER NOT NULL, label TEXT NOT NULL, address TEXT NOT NULL, chain TEXT DEFAULT 'ERC-20', created_at TEXT);

CREATE TABLE IF NOT EXISTS expenses (id SERIAL PRIMARY KEY, member_id INTEGER NOT NULL, year INTEGER NOT NULL, month INTEGER NOT NULL, amount_usdt REAL NOT NULL, category TEXT NOT NULL, description TEXT, tx_hash TEXT, status TEXT DEFAULT 'pending', expense_date TEXT, created_at TEXT, memo TEXT);

CREATE TABLE IF NOT EXISTS fiat_transactions (id SERIAL PRIMARY KEY, tx_id TEXT, source TEXT, direction TEXT, status TEXT, amount REAL, currency TEXT, counterparty TEXT, category TEXT, reference TEXT, note TEXT, exchange_rate REAL, balance REAL, tx_date TEXT, created_at TEXT, fee_amount REAL DEFAULT 0, fee_currency REAL DEFAULT 0, gross_amount REAL DEFAULT 0);
"""


async def migrate():
    print("Connecting to Supabase...")
    conn = await asyncpg.connect(DB_URL)
    print("Connected!")

    # Create tables
    for stmt in CREATE_SQL.strip().split(";"):
        stmt = stmt.strip()
        if stmt:
            try:
                await conn.execute(stmt)
            except Exception as e:
                print(f"  Table error: {str(e)[:80]}")
    print("Tables created!")

    # Migrate data from SQLite
    sq = sqlite3.connect(SQLITE_PATH)
    sq.row_factory = sqlite3.Row

    tables = [r[0] for r in sq.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).fetchall()]

    for table in tables:
        rows = sq.execute(f"SELECT * FROM {table}").fetchall()
        if not rows:
            print(f"  {table}: 0 rows (skip)")
            continue

        col_names = [c[1] for c in sq.execute(f"PRAGMA table_info({table})").fetchall()]

        # Clear existing
        await conn.execute(f'DELETE FROM "{table}"')

        count = 0
        errors = 0
        for row in rows:
            values = []
            for c in col_names:
                v = row[c]
                if isinstance(v, bytes):
                    v = v.decode("utf-8", errors="replace")
                values.append(v)

            placeholders = ", ".join(f"${i+1}" for i in range(len(col_names)))
            # Quote "timestamp" and other reserved words
            cols_str = ", ".join(f'"{c}"' for c in col_names)
            try:
                await conn.execute(
                    f'INSERT INTO "{table}" ({cols_str}) VALUES ({placeholders})',
                    *values,
                )
                count += 1
            except Exception as e:
                errors += 1
                if errors <= 2:
                    print(f"    {table} row error: {str(e)[:100]}")

        # Reset auto-increment sequence
        if "id" in col_names:
            try:
                await conn.execute(
                    f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE((SELECT MAX(id) FROM \"{table}\"), 0))"
                )
            except:
                pass

        print(f"  {table}: {count}/{len(rows)} rows {'(' + str(errors) + ' errors)' if errors else ''}")

    sq.close()
    await conn.close()
    print("\nMigration complete!")


if __name__ == "__main__":
    asyncio.run(migrate())
