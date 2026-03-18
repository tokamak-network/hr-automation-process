import os
from contextlib import asynccontextmanager
from typing import Optional
from datetime import datetime, date

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import init_db, seed_data, get_db
from tax_calculator import simulate_annual_tax, monthly_tax_burden


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed_data()
    yield

app = FastAPI(title="Tokamak HR Solution", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ---- Models ----

class MemberCreate(BaseModel):
    name: str
    github: str = ""
    role: str
    monthly_usdt: float
    wallet_address: str = ""
    contract_start: str = ""

class MemberUpdate(BaseModel):
    name: Optional[str] = None
    github: Optional[str] = None
    role: Optional[str] = None
    monthly_usdt: Optional[float] = None
    wallet_address: Optional[str] = None
    contract_start: Optional[str] = None
    is_active: Optional[int] = None

class PayrollConfirm(BaseModel):
    year: int
    month: int


# ---- Health ----

@app.get("/api/health")
def health():
    return {"status": "healthy", "service": "Tokamak HR Solution"}


# ---- Members ----

@app.get("/api/members")
def list_members():
    conn = get_db()
    rows = conn.execute("SELECT * FROM members WHERE is_active=1 ORDER BY id").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/members/{member_id}")
def get_member(member_id: int):
    conn = get_db()
    row = conn.execute("SELECT * FROM members WHERE id=?", (member_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Member not found")
    member = dict(row)
    # Include payroll history
    payrolls = conn.execute("SELECT * FROM payrolls WHERE member_id=? ORDER BY year DESC, month DESC", (member_id,)).fetchall()
    member["payrolls"] = [dict(p) for p in payrolls]
    # Include incentives
    incentives = conn.execute("SELECT * FROM incentives WHERE member_id=? ORDER BY year DESC, quarter DESC", (member_id,)).fetchall()
    member["incentives"] = [dict(i) for i in incentives]
    conn.close()
    return member

@app.post("/api/members")
def create_member(data: MemberCreate):
    conn = get_db()
    c = conn.execute("INSERT INTO members (name, github, role, monthly_usdt, wallet_address, contract_start) VALUES (?,?,?,?,?,?)",
                     (data.name, data.github, data.role, data.monthly_usdt, data.wallet_address, data.contract_start))
    conn.commit()
    mid = c.lastrowid
    conn.close()
    return {"id": mid, "message": "Member created"}

@app.put("/api/members/{member_id}")
def update_member(member_id: int, data: MemberUpdate):
    conn = get_db()
    row = conn.execute("SELECT * FROM members WHERE id=?", (member_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Member not found")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if updates:
        set_clause = ", ".join(f"{k}=?" for k in updates)
        conn.execute(f"UPDATE members SET {set_clause} WHERE id=?", list(updates.values()) + [member_id])
        conn.commit()
    conn.close()
    return {"message": "Updated"}

@app.delete("/api/members/{member_id}")
def delete_member(member_id: int):
    conn = get_db()
    conn.execute("UPDATE members SET is_active=0 WHERE id=?", (member_id,))
    conn.commit()
    conn.close()
    return {"message": "Deactivated"}


# ---- Payroll ----

@app.get("/api/payroll")
def list_payroll(year: int = 2026, month: Optional[int] = None):
    conn = get_db()
    if month:
        rows = conn.execute("""
            SELECT p.*, m.name, m.role, m.wallet_address FROM payrolls p 
            JOIN members m ON p.member_id = m.id 
            WHERE p.year=? AND p.month=? ORDER BY m.name
        """, (year, month)).fetchall()
    else:
        rows = conn.execute("""
            SELECT p.*, m.name, m.role, m.wallet_address FROM payrolls p 
            JOIN members m ON p.member_id = m.id 
            WHERE p.year=? ORDER BY p.month DESC, m.name
        """, (year,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/payroll/confirm")
def confirm_payroll(data: PayrollConfirm):
    conn = get_db()
    conn.execute("UPDATE payrolls SET status='confirmed', confirmed_at=datetime('now') WHERE year=? AND month=? AND status='estimated'",
                 (data.year, data.month))
    conn.commit()
    count = conn.execute("SELECT changes()").fetchone()[0]
    conn.close()
    return {"message": f"Confirmed {count} payroll entries"}

@app.post("/api/payroll/pay")
def pay_payroll(data: PayrollConfirm):
    conn = get_db()
    conn.execute("UPDATE payrolls SET status='paid', paid_at=datetime('now') WHERE year=? AND month=? AND status='confirmed'",
                 (data.year, data.month))
    conn.commit()
    count = conn.execute("SELECT changes()").fetchone()[0]
    conn.close()
    return {"message": f"Marked {count} as paid"}


# ---- Dashboard ----

@app.get("/api/dashboard")
def dashboard():
    conn = get_db()
    # Current month summary (March 2026)
    year, month = 2026, 3
    payrolls = conn.execute("SELECT * FROM payrolls WHERE year=? AND month=?", (year, month)).fetchall()
    total_usdt = sum(p["usdt_amount"] for p in payrolls)
    total_krw = sum(p["krw_amount"] for p in payrolls)
    total_tax = sum(p["tax_simulated"] for p in payrolls)

    # Jaden balance (mock)
    jaden_balance = {"usdt": 45230.50, "tokamak": 12500.0}

    # Recent deposits Kevin→Jaden
    txs = conn.execute("SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 5").fetchall()

    # Next payday D-day
    today = date.today()
    import calendar
    last_day = date(today.year, today.month, calendar.monthrange(today.year, today.month)[1])
    # Find last business day
    while last_day.weekday() >= 5:
        last_day = last_day.replace(day=last_day.day - 1)
    d_day = (last_day - today).days

    # Reserve summary
    reserves = conn.execute("SELECT SUM(reserve_tokamak) as total_tok FROM payrolls WHERE year=?", (year,)).fetchone()
    total_reserve_tok = reserves["total_tok"] or 0
    tokamak_price = 3200  # mock

    conn.close()
    return {
        "current_month": {"year": year, "month": month, "total_usdt": round(total_usdt, 2), "total_krw": round(total_krw), "total_tax": round(total_tax), "member_count": len(payrolls)},
        "jaden_balance": jaden_balance,
        "recent_transactions": [dict(t) for t in txs],
        "d_day": d_day,
        "payday": last_day.isoformat(),
        "reserves": {"total_tokamak": round(total_reserve_tok, 4), "krw_value": round(total_reserve_tok * tokamak_price), "tokamak_price": tokamak_price},
    }


# ---- Tax Simulation ----

@app.get("/api/tax/simulate/{member_id}")
def tax_simulate(member_id: int, year: int = 2026):
    conn = get_db()
    member = conn.execute("SELECT * FROM members WHERE id=?", (member_id,)).fetchone()
    if not member:
        raise HTTPException(404, "Member not found")

    # Sum payroll KRW for the year
    payrolls = conn.execute("SELECT * FROM payrolls WHERE member_id=? AND year=? ORDER BY month", (member_id, year)).fetchall()
    total_payroll_krw = sum(p["krw_amount"] for p in payrolls)

    # Sum incentive KRW for the year
    incentives = conn.execute("SELECT * FROM incentives WHERE member_id=? AND year=?", (member_id, year)).fetchall()
    total_incentive_krw = sum(i["krw_amount"] for i in incentives)

    annual_income = total_payroll_krw + total_incentive_krw
    tax_result = simulate_annual_tax(annual_income)

    # Monthly burden chart
    monthly_burden = monthly_tax_burden(annual_income)

    # Reserve info
    total_reserve_tok = sum(p["reserve_tokamak"] for p in payrolls)
    tokamak_price = 3200

    conn.close()
    return {
        "member": dict(member),
        "year": year,
        "payroll_income_krw": round(total_payroll_krw),
        "incentive_income_krw": round(total_incentive_krw),
        "annual_income_krw": round(annual_income),
        "tax": tax_result,
        "monthly_burden": monthly_burden,
        "reserves": {"total_tokamak": round(total_reserve_tok, 4), "krw_value": round(total_reserve_tok * tokamak_price), "tokamak_price": tokamak_price},
        "payroll_details": [dict(p) for p in payrolls],
    }


# ---- Incentives ----

@app.get("/api/incentives")
def list_incentives(year: int = 2026, quarter: Optional[int] = None):
    conn = get_db()
    if quarter:
        rows = conn.execute("""
            SELECT i.*, m.name, m.role FROM incentives i 
            JOIN members m ON i.member_id = m.id 
            WHERE i.year=? AND i.quarter=? ORDER BY m.name
        """, (year, quarter)).fetchall()
    else:
        rows = conn.execute("""
            SELECT i.*, m.name, m.role FROM incentives i 
            JOIN members m ON i.member_id = m.id 
            WHERE i.year=? ORDER BY i.quarter, m.name
        """, (year,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ---- Transactions ----

@app.get("/api/transactions")
def list_transactions(limit: int = 20):
    conn = get_db()
    rows = conn.execute("SELECT * FROM transactions ORDER BY timestamp DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ---- Market Data (Mock + Real) ----

@app.get("/api/market/tokamak")
def tokamak_price():
    # Mock data - in production would call Upbit API
    return {"token": "TOKAMAK", "price_krw": 3200, "source": "mock", "timestamp": datetime.now().isoformat()}

@app.get("/api/market/usdt")
def usdt_rate():
    return {"pair": "USDT/KRW", "rate": 1352.50, "source": "mock", "timestamp": datetime.now().isoformat()}
