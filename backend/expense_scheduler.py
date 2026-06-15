"""
Monthly expense trigger — runs inside the backend process.
On the configured day each month, notifies that N pending items await review.
Ingest is triggered via the /api/expenses/trigger endpoint (manual or cron).
NO automatic payment. Record + notify only.
"""
import os
import asyncio
import logging
from datetime import datetime, date

import aiosqlite
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("expense_scheduler")

TRIGGER_DAY = int(os.getenv("EXPENSE_TRIGGER_DAY", "1"))  # day of month
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")


async def send_telegram(message: str):
    """Send a Telegram notification. Silently skips if not configured."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        logger.info(f"[Telegram not configured] {message}")
        return False
    try:
        import httpx
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json={
                "chat_id": TELEGRAM_CHAT_ID,
                "text": message,
                "parse_mode": "HTML",
            })
            return resp.status_code == 200
    except Exception as e:
        logger.error(f"Telegram send failed: {e}")
        return False


async def get_pending_count(period: str) -> int:
    """Count pending expense decisions for a given period."""
    from expense_db import get_expense_db
    db = await get_expense_db()
    row = await db.execute(
        "SELECT COUNT(*) FROM expense_decisions WHERE period = ? AND decision = 'pending'",
        (period,)
    )
    result = await row.fetchone()
    await db.close()
    return result[0] if result else 0


async def monthly_notify():
    """Check pending expenses for current month and send notification."""
    period = date.today().strftime("%Y-%m")
    count = await get_pending_count(period)

    if count > 0:
        msg = (
            f"<b>[HR Expense] {period}</b>\n"
            f"{count}건 경비 정산 대기 중입니다.\n"
            f"승인 화면에서 확인해주세요."
        )
    else:
        msg = f"<b>[HR Expense] {period}</b>\n이번 달 경비 정산 대기 건이 없습니다."

    await send_telegram(msg)
    logger.info(f"Monthly notify: {period} — {count} pending")
    return {"period": period, "pending_count": count, "notified": True}


async def scheduler_loop():
    """Background loop — checks once daily if it's trigger day, then notifies."""
    logger.info(f"Expense scheduler started (trigger day: {TRIGGER_DAY})")
    notified_month = None

    while True:
        try:
            today = date.today()
            current_month = today.strftime("%Y-%m")

            if today.day == TRIGGER_DAY and notified_month != current_month:
                await monthly_notify()
                notified_month = current_month

            # Sleep until next day check (check at 09:00 KST-ish)
            await asyncio.sleep(3600)  # check every hour
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Scheduler error: {e}")
            await asyncio.sleep(3600)
