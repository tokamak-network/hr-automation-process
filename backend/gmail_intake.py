"""
Gmail read-only intake for recruiting applications (C-1 §2).

HARD SAFETY LINES (do not weaken):
  * READ-ONLY. Scope is gmail.readonly. This module NEVER sends, replies,
    deletes, modifies, or labels mail. Only messages.list / messages.get.
  * SCOPED SEARCH ONLY — never scans the whole mailbox. Every query is bounded
    by `newer_than:{days}d` AND a set of application-signal keywords.
  * Credentials live in the backend .env / local files only (never committed).
  * Detection / candidate registration is NOT here — that is §3-§4. This module
    only reads and returns raw scoped messages for a later step to classify.

Configuration (backend/.env):
  GMAIL_USER             mailbox to read, e.g. hr@tokamak.network
  GMAIL_TOKEN_PATH       path to OAuth token json (read-only, refreshable)
  GMAIL_CREDENTIALS_PATH path to OAuth client secrets (used only to refresh)
  CANDIDATE_SCAN_DAYS    default lookback window in days (default 14)

If google libraries aren't installed or credentials are missing, every public
function degrades gracefully (returns "not configured") instead of raising, so
the backend keeps booting.
"""
import os
import base64
import logging
from typing import List, Dict, Optional

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("gmail_intake")

# READ-ONLY scope. Changing this to anything broader violates the C-1 safety line.
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

GMAIL_USER = os.getenv("GMAIL_USER", "")
GMAIL_TOKEN_PATH = os.getenv("GMAIL_TOKEN_PATH", os.path.join(os.path.dirname(__file__), "gmail_token.json"))
GMAIL_CREDENTIALS_PATH = os.getenv("GMAIL_CREDENTIALS_PATH", os.path.join(os.path.dirname(__file__), "gmail_credentials.json"))
DEFAULT_SCAN_DAYS = int(os.getenv("CANDIDATE_SCAN_DAYS", "14"))

# Application-signal keywords. A mail must look like a Track B submission to be
# read at all — collaboration/newsletter noise is excluded by the query itself.
SIGNAL_TERMS = [
    "github.com",
    "0x",
    "repository",
    "repo",
    "submission",
    "submit",
    "Track B",
    "application",
    "apply",
]


def is_configured() -> bool:
    """True only if google libs are importable AND a token file exists."""
    try:
        import google.oauth2.credentials  # noqa: F401
        import googleapiclient.discovery  # noqa: F401
    except ImportError:
        return False
    return bool(GMAIL_USER) and os.path.exists(GMAIL_TOKEN_PATH)


def build_search_query(days: int = DEFAULT_SCAN_DAYS) -> str:
    """Build a SCOPED Gmail search query: recent window + signal keywords.

    Example: newer_than:14d (github.com OR "0x" OR repository OR ... )
    Never returns an unbounded query — `days` is always applied.
    """
    days = max(1, int(days))
    terms = " OR ".join(f'"{t}"' if " " in t else t for t in SIGNAL_TERMS)
    return f"newer_than:{days}d ({terms})"


def _load_service():
    """Build a read-only Gmail API client, or return None if unavailable.

    Refreshes the stored token if expired. Never triggers an interactive OAuth
    flow inside the server process — a missing/invalid token just yields None.
    """
    try:
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        from googleapiclient.discovery import build
    except ImportError:
        logger.info("[gmail] google libraries not installed — read disabled")
        return None

    if not os.path.exists(GMAIL_TOKEN_PATH):
        logger.info("[gmail] no token file at %s — read disabled", GMAIL_TOKEN_PATH)
        return None

    try:
        creds = Credentials.from_authorized_user_file(GMAIL_TOKEN_PATH, SCOPES)
    except Exception as e:
        logger.warning("[gmail] failed to load token: %s", e)
        return None

    # Enforce the read-only scope at runtime as a second guard.
    if creds.scopes and any(s not in SCOPES for s in creds.scopes):
        logger.error("[gmail] token carries non-readonly scopes %s — refusing", creds.scopes)
        return None

    if not creds.valid and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
        except Exception as e:
            logger.warning("[gmail] token refresh failed: %s", e)
            return None

    if not creds.valid:
        logger.info("[gmail] credentials invalid — read disabled")
        return None

    return build("gmail", "v1", credentials=creds, cache_discovery=False)


def _extract_body(payload: dict) -> str:
    """Recursively pull text/plain (fallback text/html) from a message payload."""
    if not payload:
        return ""

    def walk(part) -> str:
        mime = part.get("mimeType", "")
        body = part.get("body", {})
        data = body.get("data")
        if mime == "text/plain" and data:
            return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
        text = ""
        for sub in part.get("parts", []) or []:
            text += walk(sub)
        if not text and mime == "text/html" and data:
            return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
        return text

    return walk(payload).strip()


def search_messages(days: int = DEFAULT_SCAN_DAYS, max_results: int = 50) -> List[Dict]:
    """READ-ONLY scoped fetch. Returns a list of lightweight message dicts:
        { id, thread_id, sender, subject, date, snippet, body }
    Returns [] if not configured (never raises for missing creds/libs).

    Classification (repo/wallet extraction, applicant grouping) is intentionally
    NOT done here — that is §3. This only surfaces candidate-signal mail.
    """
    service = _load_service()
    if service is None:
        return []

    query = build_search_query(days)
    out: List[Dict] = []
    try:
        resp = (
            service.users()
            .messages()
            .list(userId="me", q=query, maxResults=max_results)
            .execute()
        )
        for meta in resp.get("messages", []):
            msg = (
                service.users()
                .messages()
                .get(userId="me", id=meta["id"], format="full")
                .execute()
            )
            headers = {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}
            out.append({
                "id": msg.get("id"),
                "thread_id": msg.get("threadId"),
                "sender": headers.get("from", ""),
                "subject": headers.get("subject", ""),
                "date": headers.get("date", ""),
                "snippet": msg.get("snippet", ""),
                "body": _extract_body(msg.get("payload", {})),
            })
    except Exception as e:
        logger.error("[gmail] scoped search failed: %s", e)
        return []

    return out


def status() -> Dict:
    """Lightweight diagnostic for an ops/health view (no mail content)."""
    return {
        "configured": is_configured(),
        "user": GMAIL_USER or None,
        "token_present": os.path.exists(GMAIL_TOKEN_PATH),
        "scope": SCOPES,
        "default_days": DEFAULT_SCAN_DAYS,
        "example_query": build_search_query(),
    }


if __name__ == "__main__":
    # Manual self-check — prints config + query, and a dry count if configured.
    # Does NOT print mail content. Read-only.
    import json
    print("gmail_intake status:")
    print(json.dumps(status(), indent=2, ensure_ascii=False))
    if is_configured():
        msgs = search_messages()
        print(f"scoped read returned {len(msgs)} message(s) (content not printed)")
    else:
        print("not configured — set GMAIL_USER + GMAIL_TOKEN_PATH in backend/.env")
