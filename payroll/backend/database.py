import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "hr.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS members (
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
        FOREIGN KEY (member_id) REFERENCES members(id)
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
        FOREIGN KEY (member_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
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
        FOREIGN KEY (member_id) REFERENCES members(id)
    );
    """)
    conn.commit()
    conn.close()

def seed_data():
    conn = get_db()
    c = conn.cursor()
    count = c.execute("SELECT COUNT(*) FROM members").fetchone()[0]
    if count > 0:
        conn.close()
        return

    members = [
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

    for m in members:
        c.execute("INSERT INTO members (name, github, role, monthly_usdt, wallet_address, contract_start) VALUES (?,?,?,?,?,?)", m)

    # Seed payroll data for recent months
    import random
    for month in range(1, 4):  # Jan-Mar 2026
        for mid in range(1, 11):
            member = c.execute("SELECT monthly_usdt FROM members WHERE id=?", (mid,)).fetchone()
            usdt = member[0]
            krw_rate = 1350 + random.uniform(-20, 20)
            krw = usdt * krw_rate
            tax = krw * 0.06  # simplified
            status = "paid" if month < 3 else ("confirmed" if month == 3 else "estimated")
            c.execute("""INSERT INTO payrolls (member_id, year, month, usdt_amount, krw_rate, krw_amount, 
                        tax_simulated, reserve_tokamak, net_pay_krw, status)
                        VALUES (?,?,?,?,?,?,?,?,?,?)""",
                      (mid, 2026, month, usdt, round(krw_rate, 2), round(krw, 0),
                       round(tax, 0), round(tax / 3200, 4), round(krw - tax, 0), status))

    # Seed transactions
    txs = [
        ("0xabc123def456789...001", "0x1a2b3c4d5e6f7890abcdef1234567890abcdef01", "0x2b3c4d5e6f7890abcdef1234567890abcdef0102", 98500, "USDT", "confirmed", "2026-01-31T09:00:00Z", "Jan payroll"),
        ("0xabc123def456789...002", "0x1a2b3c4d5e6f7890abcdef1234567890abcdef01", "0x2b3c4d5e6f7890abcdef1234567890abcdef0102", 98500, "USDT", "confirmed", "2026-02-28T09:00:00Z", "Feb payroll"),
        ("0xabc123def456789...003", "0x1a2b3c4d5e6f7890abcdef1234567890abcdef01", "0x2b3c4d5e6f7890abcdef1234567890abcdef0102", 98500, "USDT", "pending", "2026-03-31T09:00:00Z", "Mar payroll"),
    ]
    for tx in txs:
        c.execute("INSERT INTO transactions (tx_hash, from_address, to_address, amount, token, status, timestamp, note) VALUES (?,?,?,?,?,?,?,?)", tx)

    # Seed incentives
    for mid in range(1, 11):
        tok = random.uniform(500, 2000)
        tok_rate = 3200
        c.execute("INSERT INTO incentives (member_id, year, quarter, tokamak_amount, tokamak_krw_rate, krw_amount, status) VALUES (?,?,?,?,?,?,?)",
                  (mid, 2026, 1, round(tok, 2), tok_rate, round(tok * tok_rate, 0), "pending"))

    conn.commit()
    conn.close()
