"""
C-1 §3 — 지원 감지 + 지원자(발신자) 단위 누적.

설계 의도 (가볍게, 핵심만):
  * 2중 필터: 메일에 GitHub repo 링크 또는 ERC-20 지갑이 있으면 신호. 둘 다 없으면
    제외(건수만 집계).
  * 지갑 검증: 0x + 정확히 40 hex 만 인정. 트랜잭션 해시(0x+64hex)는 길이 경계로 자동
    배제. 컨트랙트 주소는 (Etherscan 키가 있을 때만) on-chain 코드 유무로 best-effort 배제.
  * 발신자(이메일) 단위 누적: repo만 온 1차 메일 → 후보 생성(wallet=NULL, 지갑 대기).
    후속 메일의 지갑 → 같은 발신자 행에 채움. 새 행 만들지 않음.

안전선:
  * 감지·목록화까지만. candidates 본테이블에 등록하지 않음(=§4 승인 단계). 자동 회신 없음.
  * 결과는 detected_applicants(검토 대기) 테이블에만 쌓는다.
"""
import os
import re
import json
import logging
from email.utils import parseaddr
from typing import List, Dict, Optional

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("candidate_intake")

ETHERSCAN_API_KEY = os.getenv("ETHERSCAN_API_KEY", "")


def _parse_csv_lower(s: str) -> set:
    return {x.strip().lower() for x in (s or "").split(",") if x.strip()}


# 내부(우리 측) 발신자 — 후보 감지에서 제외. .env 로 설정 가능(하드코딩 아님).
# 스레드에서 우리가 답장한 메일은 발신자=우리이므로 여기서 걸러진다.
INTERNAL_DOMAINS = _parse_csv_lower(os.getenv("INTAKE_INTERNAL_DOMAINS", "tokamak.network"))
INTERNAL_EMAILS = _parse_csv_lower(
    os.getenv("INTAKE_INTERNAL_EMAILS", "hr@tokamak.network,jaden@tokamak.network")
)


def is_internal_sender(email_addr: str) -> bool:
    """발신자가 우리 측(내부)이면 True → 후보 감지 제외.
    개별 주소(INTAKE_INTERNAL_EMAILS) 또는 도메인(INTAKE_INTERNAL_DOMAINS) 일치."""
    e = (email_addr or "").strip().lower()
    if not e:
        return False
    if e in INTERNAL_EMAILS:
        return True
    domain = e.split("@")[-1] if "@" in e else ""
    return bool(domain) and domain in INTERNAL_DOMAINS

# github.com/{owner}/{repo} — 쿼리/경로 꼬리는 잘라 owner/repo 까지만.
_GITHUB_RE = re.compile(r"https?://(?:www\.)?github\.com/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38})?)/([A-Za-z0-9_.-]+)", re.I)

# 0x + 정확히 40 hex. 앞뒤가 hex가 아니어야 함 → 0x+64hex(tx 해시)는 매치되지 않음.
_WALLET_RE = re.compile(r"(?<![0-9A-Fa-fx])0x[0-9A-Fa-f]{40}(?![0-9A-Fa-f])")
# 참고용: 트랜잭션 해시(0x+64hex) 감지 — 리포트/로그에만 사용.
_TXHASH_RE = re.compile(r"(?<![0-9A-Fa-fx])0x[0-9A-Fa-f]{64}(?![0-9A-Fa-f])")


def _dedupe(seq):
    seen, out = set(), []
    for x in seq:
        if x not in seen:
            seen.add(x); out.append(x)
    return out


def extract_repo_urls(text: str) -> List[str]:
    """본문에서 github repo 링크(owner/repo)만 정규화해 추출."""
    out = []
    for owner, repo in _GITHUB_RE.findall(text or ""):
        repo = repo.rstrip(".,);]").removesuffix(".git")
        # repo 위치에 오는 비-저장소 경로 제외(개인 프로필 등)
        if repo.lower() in {"orgs", "settings", "sponsors", "about", "features"}:
            continue
        out.append(f"https://github.com/{owner}/{repo}")
    return _dedupe(out)


def extract_wallets(text: str) -> List[str]:
    """형식상 유효한 지갑(0x+40hex)만. tx 해시(64hex)는 정규식 경계로 자동 제외."""
    return _dedupe(_WALLET_RE.findall(text or ""))


def find_tx_hashes(text: str) -> List[str]:
    return _dedupe(_TXHASH_RE.findall(text or ""))


async def is_contract_address(addr: str) -> bool:
    """on-chain 코드가 있으면 컨트랙트(=개인 지갑 아님). best-effort.
    Etherscan 키가 없거나 조회 실패/비정상 응답이면 False(=배제 안 함)로 통과.
    절대 에러 응답을 '코드 있음'으로 오판해 정상 지갑을 막지 않는다."""
    if not ETHERSCAN_API_KEY:
        return False
    try:
        import httpx
        url = "https://api.etherscan.io/v2/api"
        params = {"chainid": "1", "module": "proxy", "action": "eth_getCode",
                  "address": addr, "tag": "latest", "apikey": ETHERSCAN_API_KEY}
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(url, params=params)
            code = (resp.json() or {}).get("result")
        # 실제 바이트코드(hex)일 때만 컨트랙트. 에러 문자열/None 은 무시.
        if not isinstance(code, str) or not code.startswith("0x"):
            return False
        return len(code) > 2  # '0x' = EOA(코드 없음), 그보다 길면 컨트랙트
    except Exception as e:
        logger.info("[intake] contract check skipped (%s): %s", addr[:10], e)
        return False


def _msg_text(msg: Dict) -> str:
    return "\n".join(str(msg.get(k, "")) for k in ("subject", "body", "snippet"))


async def classify_message(msg: Dict) -> Dict:
    """한 통의 메일을 분류. repo/유효지갑 추출 + 신호 판정. (DB 접근 없음, 순수)"""
    text = _msg_text(msg)
    repos = extract_repo_urls(text)
    fmt_wallets = extract_wallets(text)
    valid_wallets = [w for w in fmt_wallets if not await is_contract_address(w)]

    if repos:
        signal = "application"          # 지원 감지 (지갑 있으면 완비)
    elif valid_wallets:
        signal = "needs_review"         # 지갑만 있고 repo 불명 → 확인 필요
    else:
        signal = "excluded"             # repo·지갑 둘 다 없음 → 제외(집계만)

    return {
        "repos": repos,
        "wallets": valid_wallets,
        "tx_hashes_ignored": find_tx_hashes(text),
        "signal": signal,
    }


async def process_message(db, msg: Dict) -> Dict:
    """메일 1통을 검토 대기 목록에 발신자 단위로 누적.
    반환 action: created | updated | duplicate | excluded."""
    _, email_addr = parseaddr(msg.get("sender", ""))
    email_addr = (email_addr or "").strip().lower()
    sender_name, _ = parseaddr(msg.get("sender", ""))
    msg_id = str(msg.get("id", "") or "")

    # 우리 측(내부) 발신자는 후보 대상 아님 — 스레드에서 우리가 답장한 메일 제외.
    if is_internal_sender(email_addr):
        return {"action": "excluded", "reason": "internal sender", "sender_email": email_addr}

    cls = await classify_message(msg)
    if cls["signal"] == "excluded":
        return {"action": "excluded", "reason": "no repo/wallet", **cls}
    if not email_addr:
        return {"action": "excluded", "reason": "no sender email", **cls}

    cur = await db.execute("SELECT * FROM detected_applicants WHERE sender_email=?", (email_addr,))
    row = await cur.fetchone()

    if row is None:
        repo_url = cls["repos"][0] if cls["repos"] else None
        wallet = cls["wallets"][0] if cls["wallets"] else None
        status = "detected" if cls["repos"] else "needs_review"
        ids = json.dumps([msg_id] if msg_id else [])
        await db.execute(
            "INSERT INTO detected_applicants "
            "(sender_email, sender_name, repo_url, wallet_address, status, source_email_ids, first_detected_at, updated_at) "
            "VALUES (?,?,?,?,?,?,datetime('now'),datetime('now'))",
            (email_addr, sender_name or None, repo_url, wallet, status, ids),
        )
        await db.commit()
        return {"action": "created", "sender_email": email_addr,
                "repo_url": repo_url, "wallet_address": wallet, "status": status, **cls}

    r = dict(row)
    ids = json.loads(r.get("source_email_ids") or "[]")
    if msg_id and msg_id in ids:
        return {"action": "duplicate", "sender_email": email_addr, **cls}
    if msg_id:
        ids.append(msg_id)

    # 기존 값 우선, 비어 있을 때만 채움 → 후속 메일의 지갑/누락 repo 보강
    new_repo = r.get("repo_url") or (cls["repos"][0] if cls["repos"] else None)
    prev_wallet = r.get("wallet_address")
    new_wallet = prev_wallet or (cls["wallets"][0] if cls["wallets"] else None)
    new_status = "detected" if new_repo else r.get("status", "needs_review")

    await db.execute(
        "UPDATE detected_applicants SET repo_url=?, wallet_address=?, status=?, "
        "source_email_ids=?, updated_at=datetime('now') WHERE sender_email=?",
        (new_repo, new_wallet, new_status, json.dumps(ids), email_addr),
    )
    await db.commit()
    return {"action": "updated", "sender_email": email_addr,
            "repo_url": new_repo, "wallet_address": new_wallet, "status": new_status,
            "wallet_filled": bool(new_wallet and not prev_wallet), **cls}


async def process_messages(db, messages: List[Dict]) -> Dict:
    """여러 메일을 누적 처리하고 요약 반환. (등록·회신 없음)"""
    summary = {"created": 0, "updated": 0, "duplicate": 0, "excluded": 0,
               "excluded_internal": 0, "wallet_filled": 0}
    for msg in messages or []:
        res = await process_message(db, msg)
        summary[res["action"]] = summary.get(res["action"], 0) + 1
        if res.get("reason") == "internal sender":
            summary["excluded_internal"] += 1
        if res.get("wallet_filled"):
            summary["wallet_filled"] += 1
    return summary
