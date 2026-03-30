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
DARK = (0.1, 0.1, 0.1)
GRAY = (0.5, 0.5, 0.5)
BORDER = (0.7, 0.7, 0.7)
WHITE = (1, 1, 1)
BG_HEADER = (0.96, 0.96, 0.96)

LOGO_PATH = os.path.join(os.path.dirname(__file__), "tokamak-symbol.png")

_FONT = "Helvetica"
_FONT_B = "Helvetica-Bold"
_FONT_INIT = False

def _init_fonts():
    global _FONT, _FONT_B, _FONT_INIT
    if _FONT_INIT:
        return
    _FONT_INIT = True
    for path, name, idx, bidx in [
        ("/System/Library/Fonts/AppleSDGothicNeo.ttc", "AppleSD", 0, 2),
    ]:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont(name, path, subfontIndex=idx))
                pdfmetrics.registerFont(TTFont(name + "B", path, subfontIndex=bidx))
                _FONT, _FONT_B = name, name + "B"
                return
            except:
                pass


def _fmt(n: float) -> str:
    return "-" if n == 0 else f"{n:,.2f}"

def _fmt_krw(n) -> str:
    n = int(round(n))
    return "-" if n == 0 else f"₩{n:,}"


def last_business_day(year: int, month: int) -> date:
    d = date(year, month, calendar.monthrange(year, month)[1])
    while d.weekday() >= 5:
        d = d.replace(day=d.day - 1)
    return d


# ── Drawing helpers ──

def rect(c, x, y, w, h, fill=None, stroke=BORDER):
    if fill:
        c.setFillColorRGB(*fill)
        c.rect(x, y, w, h, fill=1, stroke=0)
    c.setStrokeColorRGB(*stroke)
    c.setLineWidth(0.5)
    c.rect(x, y, w, h, fill=0, stroke=1)


def text(c, x, y, s, font=None, size=9, color=DARK):
    _init_fonts()
    c.setFont(font or _FONT, size)
    c.setFillColorRGB(*color)
    c.drawString(x, y, s)


def text_r(c, x, y, s, w, font=None, size=9, color=DARK):
    """Right-aligned text within width w from x."""
    _init_fonts()
    f = font or _FONT
    c.setFont(f, size)
    c.setFillColorRGB(*color)
    tw = c.stringWidth(s, f, size)
    c.drawString(x + w - tw, y, s)


def text_c(c, x, y, s, w, font=None, size=9, color=DARK):
    """Center-aligned text."""
    _init_fonts()
    f = font or _FONT
    c.setFont(f, size)
    c.setFillColorRGB(*color)
    tw = c.stringWidth(s, f, size)
    c.drawString(x + (w - tw) / 2, y, s)


def cell(c, x, y, w, h, label, font=None, size=9, color=DARK, fill=None, align="left", pad=8):
    """Draw a cell with text."""
    rect(c, x, y, w, h, fill=fill)
    tx = x + pad
    if align == "right":
        text_r(c, x + pad, y + h/2 - size*0.35, label, w - pad*2, font, size, color)
    elif align == "center":
        text_c(c, x, y + h/2 - size*0.35, label, w, font, size, color)
    else:
        text(c, tx, y + h/2 - size*0.35, label, font, size, color)


def cell2(c, x, y, w, h, line1, line2, font=None, size=9, color=DARK, fill=None, pad=8):
    """Draw a cell with 2 lines of text."""
    rect(c, x, y, w, h, fill=fill)
    lh = size + 3
    mid = y + h/2
    text(c, x + pad, mid + lh*0.3, line1, font, size, color)
    text(c, x + pad, mid - lh*0.7, line2, font, size, color)


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
) -> bytes:
    _init_fonts()

    buf = io.BytesIO()
    pw, ph = landscape(A4)  # 842 x 595
    c = canvas.Canvas(buf, pagesize=landscape(A4))

    # Calculations
    gross_krw = round(service_fee_usdt * exchange_rate)
    net_krw = gross_krw - total_tax_krw
    it_usdt = income_tax_krw / exchange_rate if exchange_rate else 0
    lt_usdt = local_tax_krw / exchange_rate if exchange_rate else 0
    tt_usdt = total_tax_krw / exchange_rate if exchange_rate else 0
    net_usdt = service_fee_usdt - tt_usdt

    pay_date = last_business_day(payment_year, payment_month)
    p_start = date(payment_year, payment_month, 1)
    p_end = date(payment_year, payment_month, calendar.monthrange(payment_year, payment_month)[1])
    issue_dt = issue_date if issue_date else date.today().strftime("%Y-%m-%d")

    # ── Layout ──
    mx = 35  # margin x
    my = 35  # margin bottom
    top = ph - 35

    # Logo + Title
    if os.path.exists(LOGO_PATH):
        c.drawImage(LOGO_PATH, mx, top - 32, width=35, height=35, mask='auto')
    text(c, mx + 42, top - 10, "Tokamak Network", _FONT_B, 18, DARK)

    # Issue Date box (top right)
    id_x = pw - mx - 130
    rect(c, id_x, top - 8, 60, 18)
    cell(c, id_x, top - 8, 60, 18, "Issue Date", _FONT, 7.5, GRAY, align="center")
    rect(c, id_x + 60, top - 8, 70, 18)
    cell(c, id_x + 60, top - 8, 70, 18, issue_dt, _FONT, 8, DARK, align="center")

    # Monetary unit labels
    mu_y = top - 52

    # ── 3 Column Sections ──
    gap = 14
    usable = pw - 2 * mx - 2 * gap
    info_w = usable * 0.36
    fee_w = usable * 0.32
    tax_w = usable * 0.32

    ix = mx  # info x
    fx = ix + info_w + gap  # fee x
    tx = fx + fee_w + gap  # tax x

    # Monetary unit labels above fee and tax
    text(c, fx + fee_w/2 - 30, mu_y + 4, "Monetary unit : USDT", _FONT, 7, GRAY)
    text(c, tx + tax_w/2 - 30, mu_y + 4, "Monetary unit : USDT", _FONT, 7, GRAY)

    # Section headers
    hdr_y = mu_y - 6
    hdr_h = 26

    rect(c, ix, hdr_y - hdr_h, info_w, hdr_h, fill=BLUE)
    text_c(c, ix, hdr_y - hdr_h + 8, "Information", info_w, _FONT_B, 10, WHITE)

    rect(c, fx, hdr_y - hdr_h, fee_w, hdr_h, fill=BLUE)
    text_c(c, fx, hdr_y - hdr_h + 8, "Service Fee Details", fee_w, _FONT_B, 10, WHITE)

    rect(c, tx, hdr_y - hdr_h, tax_w, hdr_h, fill=BLUE)
    text_c(c, tx, hdr_y - hdr_h + 8, "Tax Details", tax_w, _FONT_B, 10, WHITE)

    # ── Row layout ──
    rh = 38  # row height
    r0 = hdr_y - hdr_h  # top of first data row

    il = info_w * 0.40  # info label width
    iv = info_w * 0.60  # info value width
    fl = fee_w * 0.55
    fv = fee_w * 0.45
    tl = tax_w * 0.55
    tv = tax_w * 0.45

    # === INFO COLUMN (7 rows) ===
    info_data = [
        ("Company Name", "TOKAMAK NETWORK PTE. LTD."),
        ("Full name of Contractor", contractor_name),
        ("Date of payment", pay_date.strftime("%b %d, %Y")),
        ("Start and end date of\nservice fee period", f"{p_start.strftime('%B %d, %Y')} to\n{p_end.strftime('%B %d, %Y')}"),
        ("ERC20 Address", erc20_address or ""),
        ("Transaction URL", transaction_url or ""),
        ("Notice", ""),
    ]

    for i, (lbl, val) in enumerate(info_data):
        ry = r0 - (i + 1) * rh
        lbl_lines = lbl.split("\n")
        val_lines = val.split("\n")

        # Label
        rect(c, ix, ry, il, rh)
        for li, ln in enumerate(lbl_lines):
            text(c, ix + 8, ry + rh - 16 - li * 13, ln, _FONT, 9, DARK)

        # Value
        rect(c, ix + il, ry, iv, rh)
        for li, ln in enumerate(val_lines):
            sz = 7.5 if len(ln) > 35 else (8 if len(ln) > 25 else 9)
            text(c, ix + il + 8, ry + rh - 16 - li * 13, ln, _FONT, sz, DARK)

    # === SERVICE FEE COLUMN ===
    # Row mapping: (info_row_start, info_row_span, label, value, is_total)
    fee_items = [
        (0, 1, "Basic service fee\nfor each period", _fmt(service_fee_usdt), False),
        (1, 1, "Allowance paid for\nservice fee period", "-", False),
        (2, 2, "Any other additional\npayment for each period", "-", False),
        (4, 1, "", "", False),  # blank row aligned with ERC20
        (5, 1, "ⓐ Total", _fmt(service_fee_usdt), True),
        (6, 1, "", "", False),  # blank row aligned with Notice
    ]

    for start, span, lbl, val, is_tot in fee_items:
        ry = r0 - (start + span) * rh
        h = rh * span

        if not lbl and not val:
            rect(c, fx, ry, fee_w, h)
            continue

        bg = BLUE if is_tot else None
        tc = WHITE if is_tot else DARK
        font = _FONT_B if is_tot else _FONT

        # Label
        rect(c, fx, ry, fl, h, fill=bg)
        lines = lbl.split("\n")
        for li, ln in enumerate(lines):
            text(c, fx + 8, ry + h - 16 - li * 13, ln, font, 9, tc)

        # Value
        rect(c, fx + fl, ry, fv, h)
        text_r(c, fx + fl + 4, ry + h/2 - 3, val, fv - 12, _FONT_B if is_tot else _FONT, 10, DARK)

    # === TAX COLUMN ===
    tax_items = [
        (0, 1, "Income Tax", _fmt(it_usdt), False),
        (1, 1, "Local Income Tax", _fmt(lt_usdt), False),
        (2, 2, "", "", False),  # blank
        (4, 1, "", "", False),  # blank aligned with ERC20
        (5, 1, "ⓑ Total", _fmt(tt_usdt), True),
    ]

    for start, span, lbl, val, is_tot in tax_items:
        ry = r0 - (start + span) * rh
        h = rh * span

        if not lbl and not val:
            rect(c, tx, ry, tax_w, h)
            continue

        bg = BLUE if is_tot else None
        tc = WHITE if is_tot else DARK
        font = _FONT_B if is_tot else _FONT

        rect(c, tx, ry, tl, h, fill=bg)
        text(c, tx + 8, ry + h/2 - 3, lbl, font, 9, tc)

        rect(c, tx + tl, ry, tv, h)
        text_r(c, tx + tl + 4, ry + h/2 - 3, val, tv - 12, _FONT_B if is_tot else _FONT, 10, DARK)

    # === NET SERVICE FEE (aligned with Notice row) ===
    net_ry = r0 - 7 * rh
    net_h = rh

    rect(c, tx, net_ry, tl, net_h, fill=LIGHT_BLUE)
    text(c, tx + 8, net_ry + net_h - 14, "Net service fee", _FONT_B, 10, DARK)
    text(c, tx + 8, net_ry + net_h - 27, "(ⓐ-ⓑ)", _FONT, 8, GRAY)

    rect(c, tx + tl, net_ry, tv, net_h, fill=LIGHT_BLUE)
    text_r(c, tx + tl + 4, net_ry + net_h/2 - 4, _fmt(net_usdt), tv - 12, _FONT_B, 12, DARK)

    # ── KRW Reference ──
    ref_y = net_ry - 20
    ref_w = pw - 2 * mx
    ref_rh = 22
    ref_cw = ref_w / 4

    # Header
    rect(c, mx, ref_y - ref_rh, ref_w, ref_rh, fill=BG_HEADER)
    text(c, mx + 8, ref_y - ref_rh + 7, "KRW Reference (참고용)", _FONT_B, 8, GRAY)

    ref_data = [
        ("적용 환율 (USD-KRW)", _fmt_krw(round(exchange_rate)), "세액 비율", f"{tax_percentage}%"),
        ("월 급여액 (Gross KRW)", _fmt_krw(gross_krw), "소득세 (KRW)", _fmt_krw(income_tax_krw)),
        ("세후 수령액 (Net KRW)", _fmt_krw(net_krw), "지방소득세 (KRW)", _fmt_krw(local_tax_krw)),
    ]

    for ri, (l1, v1, l2, v2) in enumerate(ref_data):
        ry = ref_y - ref_rh - (ri + 1) * ref_rh
        cell(c, mx, ry, ref_cw, ref_rh, l1, _FONT, 8, GRAY, pad=8)
        cell(c, mx + ref_cw, ry, ref_cw, ref_rh, v1, _FONT_B, 8.5, DARK, align="right")
        cell(c, mx + ref_cw*2, ry, ref_cw, ref_rh, l2, _FONT, 8, GRAY, pad=8)
        cell(c, mx + ref_cw*3, ry, ref_cw, ref_rh, v2, _FONT_B, 8.5, DARK, align="right")

    # ── Footer ──
    fy = ref_y - ref_rh - 4 * ref_rh - 12
    text(c, mx, fy, "Notice: This payslip is generated based on the 2026 Korean Simplified Tax Table (근로소득 간이세액표, revised 2026.2.27).", _FONT, 7, GRAY)
    text(c, mx, fy - 11, "Actual tax amounts may differ from the simplified table calculations. Tax amounts are converted to USDT using the applied exchange rate.", _FONT, 7, GRAY)

    c.save()
    result = buf.getvalue()
    buf.close()
    return result
