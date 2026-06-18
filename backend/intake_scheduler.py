"""
C-1 §5 — 채용 지원 메일 자동 스캔(주 2회) + 수동 트리거.
expense_scheduler.py 패턴 재사용.

안전선:
  * 스캔은 감지·staging(detected_applicants) 적재·알림까지만.
  * candidates 본테이블에 등록하지 않는다(=§4 검토 게이트 우회 금지). 자동 회신 없음.
  * Gmail 읽기 전용(gmail_intake) 유지. 미설정 시 graceful(빈 결과).
"""
import os
import asyncio
import logging
from datetime import date

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("intake_scheduler")

# 기존 텔레그램 채널 재사용 (경비 스케줄러와 동일 함수)
from expense_scheduler import send_telegram

CANDIDATE_SCAN_DAYS = int(os.getenv("CANDIDATE_SCAN_DAYS", "14"))


def _parse_weekdays(raw: str):
    """'0,3' → [0,3]. 월=0 ... 일=6. 비면 월·목 기본."""
    out = []
    for tok in (raw or "").split(","):
        tok = tok.strip()
        if tok.isdigit():
            out.append(int(tok) % 7)
    return sorted(set(out)) or [0, 3]


# 주 2회 자동 스캔 요일 — 기본 월(0)·목(3)
SCAN_WEEKDAYS = _parse_weekdays(os.getenv("INTAKE_SCAN_WEEKDAYS", "0,3"))


async def scan_inbox(days: int = None, notify: bool = True) -> dict:
    """Gmail 읽기 전용 스캔 → 감지 → staging 적재 → (새 감지 시) 알림.
    candidates 등록은 하지 않는다. 반환은 집계 요약."""
    days = days or CANDIDATE_SCAN_DAYS
    import gmail_intake
    import candidate_intake
    from db import get_db

    configured = gmail_intake.is_configured()
    messages = gmail_intake.search_messages(days=days)  # 읽기 전용, 미설정 시 []

    db = await get_db()
    summary = await candidate_intake.process_messages(db, messages)
    await db.close()

    summary["scanned_messages"] = len(messages)
    summary["gmail_configured"] = configured
    summary["registered_to_candidates"] = 0  # 명시: 자동 등록 없음

    new_detected = summary.get("created", 0) + summary.get("updated", 0)
    if notify and new_detected > 0:
        msg = (
            "<b>[HR 채용] 새 지원 감지</b>\n"
            f"신규 {summary.get('created', 0)}건 / 보강 {summary.get('updated', 0)}건 "
            f"(스캔 {summary['scanned_messages']}통)\n"
            "검토 화면에서 확인 후 '등록 승인'하세요. (자동 등록 안 됨)"
        )
        await send_telegram(msg)

    logger.info(f"[intake] scan summary: {summary}")
    return summary


async def scheduler_loop():
    """배경 루프 — 매일 1회 깨어나 오늘이 스캔 요일이면 1회만 스캔."""
    logger.info(f"Intake scheduler started (weekdays={SCAN_WEEKDAYS}, lookback={CANDIDATE_SCAN_DAYS}d)")
    scanned_key = None

    while True:
        try:
            today = date.today()
            key = today.strftime("%Y-%m-%d")
            if today.weekday() in SCAN_WEEKDAYS and scanned_key != key:
                await scan_inbox()
                scanned_key = key
            await asyncio.sleep(3600)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Intake scheduler error: {e}")
            await asyncio.sleep(3600)
