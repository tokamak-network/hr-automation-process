"""
Payslip PDF Generator — Tokamak Network Service Fee Payslip
Landscape A4, 3-column layout matching original template.
"""

import io
import os
import math
import calendar
from datetime import date

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ── Constants ──
BLUE = (42/255, 114/255, 229/255)
LIGHT_BLUE = (232/255, 240/255, 254/255)
DARK = (0, 0, 0)
GRAY = (0.5, 0.5, 0.5)
BORDER = (0.78, 0.78, 0.78)
WHITE = (1, 1, 1)
BG_HEADER = (0.96, 0.96, 0.96)

BASE_DIR = os.path.dirname(__file__)
LOGO_PATH = os.path.join(BASE_DIR, "tokamak-logo-full.png")

_FONT = "Helvetica"
_FONT_B = "Helvetica-Bold"
_FONT_INIT = False


def _init_fonts():
    global _FONT, _FONT_B, _FONT_INIT
    if _FONT_INIT:
        return
    _FONT_INIT = True
    # NotoSansKR variable font — single file, supports all weights
    noto_path = os.path.join(BASE_DIR, "NotoSansKR.ttf")
    if os.path.exists(noto_path):
        try:
            pdfmetrics.registerFont(TTFont("NotoKR", noto_path))
            pdfmetrics.registerFont(TTFont("NotoKRB", noto_path))  # same file, bold via name
            _FONT, _FONT_B = "NotoKR", "NotoKRB"
            return
        except Exception:
            pass


def _ceil10_usdt(krw_amount: float, exchange_rate: float) -> float:
    """KRW 세금을 USDT로 환산 후 10의 자리 올림"""
    if exchange_rate <= 0:
        return 0
    usdt = krw_amount / exchange_rate
    return math.ceil(usdt / 10) * 10


def _fmt_int(n: float) -> str:
    if n == 0:
        return "-"
    return f"{int(n):,}"


def _fmt_krw(n) -> str:
    n = int(round(n))
    return "-" if n == 0 else f"\u20a9{n:,}"


def last_business_day(year: int, month: int) -> date:
    d = date(year, month, calendar.monthrange(year, month)[1])
    while d.weekday() >= 5:
        d = d.replace(day=d.day - 1)
    return d


# ── Drawing helpers ──

def _rect(c, x, y, w, h, fill=None, stroke=BORDER):
    if fill:
        c.setFillColorRGB(*fill)
        c.rect(x, y, w, h, fill=1, stroke=0)
    c.setStrokeColorRGB(*stroke)
    c.setLineWidth(0.4)
    c.rect(x, y, w, h, fill=0, stroke=1)


def _text(c, x, y, s, font=None, size=9, color=DARK, bold=False):
    _init_fonts()
    f = font or _FONT
    if bold:
        # Faux bold: draw text with thin stroke overlay
        t = c.beginText(x, y)
        t.setFont(f, size)
        t.setFillColorRGB(*color)
        t.setStrokeColorRGB(*color)
        t.setTextRenderMode(2)  # fill + stroke
        t._strokeWidth = size * 0.04
        c.setLineWidth(size * 0.04)
        t.textLine(s)
        c.drawText(t)
        # Reset
        t2 = c.beginText(0, 0)
        t2.setTextRenderMode(0)
        c.drawText(t2)
    else:
        c.setFont(f, size)
        c.setFillColorRGB(*color)
        c.drawString(x, y, s)


def _text_r(c, x, y, s, w, font=None, size=9, color=DARK, bold=False):
    _init_fonts()
    f = font or _FONT
    tw = c.stringWidth(s, f, size)
    _text(c, x + w - tw, y, s, f, size, color, bold=bold)


def _text_c(c, x, y, s, w, font=None, size=9, color=DARK, bold=False):
    _init_fonts()
    f = font or _FONT
    tw = c.stringWidth(s, f, size)
    _text(c, x + (w - tw) / 2, y, s, f, size, color, bold=bold)


def _wrap_text(c, s, font, size, max_width):
    """Break text into lines that fit within max_width, character-level."""
    _init_fonts()
    f = font or _FONT
    lines = []
    line = ""
    for ch in s:
        test = line + ch
        if c.stringWidth(test, f, size) <= max_width:
            line = test
        else:
            if line:
                lines.append(line)
            line = ch
    if line:
        lines.append(line)
    return lines if lines else [s]


def _draw_cell(c, x, y, w, h, lines, font=None, size=9, color=DARK, fill=None, align="center", pad=6, bold=False):
    """
    Draw a cell with text lines, vertically and horizontally centered.
    align: 'center', 'left', 'right'
    bold: use faux bold (stroke + fill) for thicker text
    """
    _rect(c, x, y, w, h, fill=fill)
    _init_fonts()
    f = font or _FONT
    if not lines or (len(lines) == 1 and not lines[0]):
        return

    line_h = size + 3
    n = len(lines)
    # Vertical center: place block midpoint at cell center
    start_y = y + h / 2 + (n - 1) * line_h / 2 - size * 0.3

    for i, ln in enumerate(lines):
        ly = start_y - i * line_h
        if align == "right":
            _text_r(c, x + pad, ly, ln, w - pad * 2, f, size, color, bold=bold)
        elif align == "left":
            _text(c, x + pad, ly, ln, f, size, color, bold=bold)
        else:  # center
            _text_c(c, x, ly, ln, w, f, size, color, bold=bold)


# ── Main Generator ──

def generate_payslip_pdf(
    contractor_name: str,
    erc20_address: str,
    transaction_url: str,
    payment_year: int,
    payment_month: int,
    service_fee_usdt: float,
    exchange_rate: float,
    income_tax_krw: int,
    local_tax_krw: int,
    total_tax_krw: int,
    tax_percentage: int = 100,
    issue_date: str = "",
    expenses: list = None,
    expense_total_usdt: float = 0,
    erc20_addresses: list = None,
) -> bytes:
    _init_fonts()

    buf = io.BytesIO()
    pw, ph = landscape(A4)  # 842 x 595
    c = canvas.Canvas(buf, pagesize=landscape(A4))

    # Calculations — USDT amounts with 10의 자리 올림
    gross_krw = round(service_fee_usdt * exchange_rate)
    net_krw = gross_krw - total_tax_krw
    tt_usdt = _ceil10_usdt(total_tax_krw, exchange_rate)
    it_usdt = _ceil10_usdt(income_tax_krw, exchange_rate)
    lt_usdt = tt_usdt - it_usdt
    net_usdt = service_fee_usdt - tt_usdt

    pay_date = last_business_day(payment_year, payment_month)
    p_start = date(payment_year, payment_month, 1)
    p_end = date(payment_year, payment_month, calendar.monthrange(payment_year, payment_month)[1])
    issue_dt = issue_date if issue_date else date.today().strftime("%Y-%m-%d")

    # ── Layout ──
    mx = 35
    top = ph - 30

    # ── Logo (cropped image with logo + text) ──
    if os.path.exists(LOGO_PATH):
        # Logo image is ~1001x169, display proportionally
        logo_display_h = 28
        logo_display_w = logo_display_h * (1001 / 169)  # ~166px
        c.drawImage(LOGO_PATH, mx, top - logo_display_h + 2, width=logo_display_w, height=logo_display_h, mask='auto')

    # Issue Date box (top right)
    id_x = pw - mx - 130
    _rect(c, id_x, top - 8, 60, 18)
    _draw_cell(c, id_x, top - 8, 60, 18, ["Issue Date"], _FONT, 7.5, GRAY)
    _rect(c, id_x + 60, top - 8, 70, 18)
    _draw_cell(c, id_x + 60, top - 8, 70, 18, [issue_dt], _FONT, 8, DARK)

    # ── 3 Column Sections ──
    gap = 12
    usable = pw - 2 * mx - 2 * gap
    info_w = usable * 0.36
    fee_w = usable * 0.32
    tax_w = usable * 0.32

    ix = mx
    fx = ix + info_w + gap
    tx = fx + fee_w + gap

    # Section headers
    hdr_y = top - 50
    hdr_h = 26

    _rect(c, ix, hdr_y - hdr_h, info_w, hdr_h, fill=BLUE)
    _draw_cell(c, ix, hdr_y - hdr_h, info_w, hdr_h, ["Information"], _FONT_B, 10, WHITE, bold=True)

    # Monetary unit labels — above header bar, right-aligned
    _text_r(c, fx + 4, hdr_y + 5, "Monetary unit : USDT", fee_w - 8, _FONT, 7.5, DARK, bold=True)
    _text_r(c, tx + 4, hdr_y + 5, "Monetary unit : USDT", tax_w - 8, _FONT, 7.5, DARK, bold=True)

    # Service Fee header
    _rect(c, fx, hdr_y - hdr_h, fee_w, hdr_h, fill=BLUE)
    _draw_cell(c, fx, hdr_y - hdr_h, fee_w, hdr_h, ["Service Fee Details"], _FONT_B, 10, WHITE, bold=True)

    # Tax header
    _rect(c, tx, hdr_y - hdr_h, tax_w, hdr_h, fill=BLUE)
    _draw_cell(c, tx, hdr_y - hdr_h, tax_w, hdr_h, ["Tax Details"], _FONT_B, 10, WHITE, bold=True)

    # ── Row layout ──
    rh = 38
    r0 = hdr_y - hdr_h  # top of first data row

    il = info_w * 0.40
    iv = info_w * 0.60
    fl = fee_w * 0.55
    fv = fee_w * 0.45
    tl = tax_w * 0.55
    tv = tax_w * 0.45

    # Parse multiple TX hashes (newline or comma separated), extract hash from URL
    tx_list = []
    if transaction_url:
        for line in transaction_url.replace(",", "\n").split("\n"):
            line = line.strip()
            if not line:
                continue
            # Extract hash from etherscan URL if needed
            if "/tx/" in line:
                line = line.split("/tx/")[-1].strip()
            tx_list.append(line)
    tx_display = "\n".join(tx_list) if tx_list else ""

    # === INFO COLUMN (dynamic rows) ===
    addr_list = erc20_addresses or ([erc20_address] if erc20_address else [])

    info_data = [
        ("Company Name", "TOKAMAK NETWORK PTE. LTD."),
        ("Full name of Contractor", contractor_name),
        ("Date of payment", pay_date.strftime("%b %d, %Y")),
        ("Start and end date of service fee period", f"{p_start.strftime('%B %d, %Y')} to {p_end.strftime('%B %d, %Y')}"),
    ]
    # Add each address as separate row
    for idx, addr in enumerate(addr_list):
        label = f"ERC20 Address {idx + 1}" if len(addr_list) > 1 else "ERC20 Address"
        info_data.append((label, addr))

    # Add each TX as separate row
    if len(tx_list) > 1:
        for idx, txh in enumerate(tx_list):
            label = f"Transaction {idx + 1}" if len(tx_list) > 1 else "Transaction"
            info_data.append((label, txh))
    else:
        info_data.append(("Transaction", tx_list[0] if tx_list else ""))
        info_data.append(("Notice", ""))

    cur_y = r0
    for i, (lbl, val) in enumerate(info_data):
        is_addr = lbl in ("ERC20 Address", "Transaction")
        val_sz = 6.5 if is_addr else 8.5

        # Calculate needed height based on wrapped lines
        max_val_w = iv - 14
        val_lines = _wrap_text(c, val, _FONT, val_sz, max_val_w) if val else [""]
        lbl_lines = _wrap_text(c, lbl, _FONT_B, 8.5, il - 12)
        line_count = max(len(val_lines), len(lbl_lines))
        row_h = max(rh, line_count * (val_sz + 4) + 10) if is_addr else rh

        ry = cur_y - row_h
        _draw_cell(c, ix, ry, il, row_h, lbl_lines, _FONT_B, 8.5, DARK, align="center", bold=True)
        _draw_cell(c, ix + il, ry, iv, row_h, val_lines, _FONT, val_sz, DARK, align="left", bold=True)
        cur_y = ry

    # === SERVICE FEE & EXPENSES COLUMN ===
    total_payout = service_fee_usdt + expense_total_usdt
    exp_list = expenses or []

    # -- type: "normal", "expense_item", "subtotal", "total"
    fee_rows = [
        {"lbl": "Basic service fee\nfor each period", "val": _fmt_int(service_fee_usdt), "type": "normal"},
    ]

    if exp_list:
        fee_rows.append({"lbl": "Expense Subtotal\n(Non-taxable)", "val": _fmt_int(expense_total_usdt), "type": "subtotal"})
        for exp in exp_list[:5]:
            cat = exp.get("category", "")
            desc = exp.get("description", "") or exp.get("memo", "")
            label = f"  · {cat}: {desc}" if desc else f"  · {cat}"
            amt = exp.get("amount_usdt", 0)
            fee_rows.append({"lbl": label, "val": _fmt_int(amt), "type": "expense_item"})
    else:
        fee_rows.append({"lbl": "Expenses\n(Non-taxable)", "val": "-", "type": "normal"})

    fee_rows.append({"lbl": "\u24b6 Total", "val": _fmt_int(total_payout), "type": "total"})

    for i, item in enumerate(fee_rows):
        ry = r0 - (i + 1) * rh
        t = item["type"]

        if t == "total":
            _draw_cell(c, fx, ry, fl, rh, item["lbl"].split("\n"), _FONT_B, 9, WHITE, fill=BLUE, align="center", bold=True)
            _draw_cell(c, fx + fl, ry, fv, rh, [item["val"]], _FONT_B, 10, DARK, align="right", bold=True)
        elif t == "subtotal":
            _draw_cell(c, fx, ry, fl, rh, item["lbl"].split("\n"), _FONT_B, 8, DARK, fill=BG_HEADER, align="center", bold=True)
            _draw_cell(c, fx + fl, ry, fv, rh, [item["val"]], _FONT_B, 9, DARK, fill=BG_HEADER, align="right", bold=True)
        elif t == "expense_item":
            _draw_cell(c, fx, ry, fl, rh, [item["lbl"]], _FONT, 7.5, GRAY, align="left")
            _draw_cell(c, fx + fl, ry, fv, rh, [item["val"]], _FONT, 8, GRAY, align="right")
        else:
            _draw_cell(c, fx, ry, fl, rh, item["lbl"].split("\n"), _FONT_B, 9, DARK, align="center", bold=True)
            _draw_cell(c, fx + fl, ry, fv, rh, [item["val"]], _FONT_B, 10, DARK, align="right", bold=True)

    # === TAX COLUMN (no empty rows) ===
    tax_items = [
        (0, 1, "Income Tax", _fmt_int(it_usdt), False),
        (1, 1, "Local Income Tax", _fmt_int(lt_usdt), False),
        (2, 1, "\u24b7 Total", _fmt_int(tt_usdt), True),
    ]

    for start, span, lbl, val, is_tot in tax_items:
        ry = r0 - (start + span) * rh
        h = rh * span

        bg = BLUE if is_tot else None
        tc = WHITE if is_tot else DARK

        _draw_cell(c, tx, ry, tl, h, [lbl], _FONT_B, 9, tc, fill=bg, align="center", bold=True)
        _draw_cell(c, tx + tl, ry, tv, h, [val], _FONT_B, 10, DARK, align="right", bold=True)

    # === NET PAYOUT (right after Tax Total) ===
    net_ry = r0 - 4 * rh
    net_h = rh
    net_payout = total_payout - tt_usdt

    _draw_cell(c, tx, net_ry, tl, net_h, ["Net payout", "(\u24b6-\u24b7)"], _FONT_B, 9, DARK, fill=LIGHT_BLUE, align="center", bold=True)
    _draw_cell(c, tx + tl, net_ry, tv, net_h, [_fmt_int(net_payout)], _FONT_B, 12, DARK, fill=LIGHT_BLUE, align="right", bold=True)

    # ── KRW Reference ── (positioned below Info column which is always 7 rows)
    info_bottom = cur_y
    ref_y = info_bottom - 18
    ref_w = pw - 2 * mx
    ref_rh = 22
    ref_cw = ref_w / 4

    # Header
    _rect(c, mx, ref_y - ref_rh, ref_w, ref_rh, fill=BG_HEADER)
    _draw_cell(c, mx, ref_y - ref_rh, ref_w, ref_rh, ["KRW Reference (\ucc38\uace0\uc6a9)"], _FONT_B, 8, GRAY, align="left", bold=True)

    ref_data = [
        ("\uc801\uc6a9 \ud658\uc728 (USD-KRW)", _fmt_krw(round(exchange_rate)), "\uc138\uc561 \ube44\uc728", f"{tax_percentage}%"),
        ("\uc6d4 \uae09\uc5ec\uc561 (Gross KRW)", _fmt_krw(gross_krw), "\uc18c\ub4dd\uc138 (KRW)", _fmt_krw(income_tax_krw)),
        ("\uc138\ud6c4 \uc218\ub839\uc561 (Net KRW)", _fmt_krw(net_krw), "\uc9c0\ubc29\uc18c\ub4dd\uc138 (KRW)", _fmt_krw(local_tax_krw)),
    ]

    for ri, (l1, v1, l2, v2) in enumerate(ref_data):
        ry = ref_y - ref_rh - (ri + 1) * ref_rh
        _draw_cell(c, mx, ry, ref_cw, ref_rh, [l1], _FONT_B, 8, GRAY, align="left", bold=True)
        _draw_cell(c, mx + ref_cw, ry, ref_cw, ref_rh, [v1], _FONT_B, 8.5, DARK, align="right", bold=True)
        _draw_cell(c, mx + ref_cw * 2, ry, ref_cw, ref_rh, [l2], _FONT_B, 8, GRAY, align="left", bold=True)
        _draw_cell(c, mx + ref_cw * 3, ry, ref_cw, ref_rh, [v2], _FONT_B, 8.5, DARK, align="right", bold=True)

    # ── Footer ──
    fy = ref_y - ref_rh - 4 * ref_rh - 10
    _text(c, mx, fy, "Notice: This payslip is generated based on the 2026 Korean Simplified Tax Table (\uadfc\ub85c\uc18c\ub4dd \uac04\uc774\uc138\uc561\ud45c, revised 2026.2.27).", _FONT, 7, GRAY)
    _text(c, mx, fy - 11, "Actual tax amounts may differ from the simplified table calculations. Tax amounts are converted to USDT using the applied exchange rate.", _FONT, 7, GRAY)

    c.save()
    result = buf.getvalue()
    buf.close()
    return result
