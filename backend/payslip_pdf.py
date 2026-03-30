"""
Payslip PDF Generator — Tokamak Network Service Fee Payslip
Layout: 3-column (Information | Service Fee Details | Tax Details)
Matches the original Tokamak Network payslip template.
"""

import io
import os
import calendar
from datetime import date

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


# ── Font Registration ──

_FONT_REGISTERED = False
_FONT_NAME = "Helvetica"
_FONT_BOLD = "Helvetica-Bold"


def _register_fonts():
    global _FONT_REGISTERED, _FONT_NAME, _FONT_BOLD
    if _FONT_REGISTERED:
        return
    candidates = [
        ("/System/Library/Fonts/AppleSDGothicNeo.ttc", "AppleSD", 0, 2),
        ("/System/Library/Fonts/Supplemental/Arial Unicode.ttf", "ArialUnicode", None, None),
    ]
    for path, name, idx, bold_idx in candidates:
        if os.path.exists(path):
            try:
                if idx is not None:
                    pdfmetrics.registerFont(TTFont(name, path, subfontIndex=idx))
                    if bold_idx is not None:
                        pdfmetrics.registerFont(TTFont(name + "-Bold", path, subfontIndex=bold_idx))
                        _FONT_BOLD = name + "-Bold"
                    else:
                        _FONT_BOLD = name
                else:
                    pdfmetrics.registerFont(TTFont(name, path))
                    _FONT_BOLD = name
                _FONT_NAME = name
                _FONT_REGISTERED = True
                return
            except Exception:
                continue
    _FONT_REGISTERED = True


def _fmt(n: float) -> str:
    if n == 0:
        return "-"
    return f"{n:,.2f}"


def _fmt_krw(n) -> str:
    n = int(round(n))
    if n == 0:
        return "-"
    return f"₩{n:,}"


def last_business_day(year: int, month: int) -> date:
    last_day = date(year, month, calendar.monthrange(year, month)[1])
    while last_day.weekday() >= 5:
        last_day = last_day.replace(day=last_day.day - 1)
    return last_day


# ── Drawing Helpers ──

BLUE = (42/255, 114/255, 229/255)
LIGHT_BLUE = (232/255, 240/255, 254/255)
DARK = (0.15, 0.15, 0.15)
GRAY = (0.45, 0.45, 0.45)
BORDER = (0.75, 0.75, 0.75)
WHITE = (1, 1, 1)


def _draw_rect(c, x, y, w, h, fill=None, stroke=BORDER, stroke_width=0.5):
    if fill:
        c.setFillColorRGB(*fill)
        c.rect(x, y, w, h, fill=1, stroke=0)
    if stroke:
        c.setStrokeColorRGB(*stroke)
        c.setLineWidth(stroke_width)
        c.rect(x, y, w, h, fill=0, stroke=1)


def _draw_text(c, x, y, text, font=None, size=8, color=DARK, align="left", max_width=None):
    _register_fonts()
    c.setFont(font or _FONT_NAME, size)
    c.setFillColorRGB(*color)
    if align == "right" and max_width:
        tw = c.stringWidth(text, font or _FONT_NAME, size)
        c.drawString(x + max_width - tw, y, text)
    elif align == "center" and max_width:
        tw = c.stringWidth(text, font or _FONT_NAME, size)
        c.drawString(x + (max_width - tw) / 2, y, text)
    else:
        c.drawString(x, y, text)


def _draw_wrapped_text(c, x, y, text, font=None, size=8, color=DARK, max_width=100, line_height=11):
    """Draw text with word wrapping. Returns the number of lines drawn."""
    _register_fonts()
    fn = font or _FONT_NAME
    c.setFont(fn, size)
    c.setFillColorRGB(*color)

    words = text.split()
    lines = []
    current = ""
    for w in words:
        test = f"{current} {w}".strip()
        if c.stringWidth(test, fn, size) <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = w
    if current:
        lines.append(current)

    for i, line in enumerate(lines):
        c.drawString(x, y - i * line_height, line)
    return len(lines)


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
    _register_fonts()

    buffer = io.BytesIO()
    page_w, page_h = A4  # 595 x 842 pt
    c = canvas.Canvas(buffer, pagesize=A4)

    # Calculations
    gross_krw = round(service_fee_usdt * exchange_rate)
    net_krw = gross_krw - total_tax_krw
    income_tax_usdt = income_tax_krw / exchange_rate if exchange_rate > 0 else 0
    local_tax_usdt = local_tax_krw / exchange_rate if exchange_rate > 0 else 0
    total_tax_usdt = total_tax_krw / exchange_rate if exchange_rate > 0 else 0
    net_usdt = service_fee_usdt - total_tax_usdt

    payment_date = last_business_day(payment_year, payment_month)
    period_start = date(payment_year, payment_month, 1)
    period_end = date(payment_year, payment_month, calendar.monthrange(payment_year, payment_month)[1])
    issue_dt = issue_date if issue_date else date.today().strftime("%Y-%m-%d")

    # ── Layout Constants ──
    margin_x = 30
    top_y = page_h - 40
    col_gap = 12  # gap between the 3 sections
    total_w = page_w - 2 * margin_x  # ~535

    # 3 sections: Info (wider), Service Fee, Tax Details
    info_w = total_w * 0.38  # ~203
    fee_w = total_w * 0.31   # ~166
    tax_w = total_w * 0.31   # ~166

    info_x = margin_x
    fee_x = info_x + info_w + col_gap
    tax_x = fee_x + fee_w + col_gap

    # Sub-column widths within each section
    info_label_w = info_w * 0.42
    info_value_w = info_w * 0.58
    fee_label_w = fee_w * 0.58
    fee_value_w = fee_w * 0.42
    tax_label_w = tax_w * 0.58
    tax_value_w = tax_w * 0.42

    row_h = 36  # row height
    header_h = 28

    # ── Title ──
    _draw_text(c, margin_x, top_y, "SERVICE FEE PAYSLIP", _FONT_BOLD, 14, DARK)
    _draw_text(c, 0, top_y, f"Issue Date: {issue_dt}", _FONT_NAME, 8, GRAY, "right", page_w - margin_x)

    # ── Monetary unit labels ──
    y = top_y - 18
    _draw_text(c, fee_x, y, "Monetary unit : USDT", _FONT_NAME, 7, GRAY)
    _draw_text(c, tax_x, y, "Monetary unit : USDT", _FONT_NAME, 7, GRAY)

    # ── Section Headers ──
    y = top_y - 32
    _draw_rect(c, info_x, y, info_w, header_h, fill=BLUE)
    _draw_text(c, info_x, y + 9, "Information", _FONT_BOLD, 9, WHITE, "center", info_w)

    _draw_rect(c, fee_x, y, fee_w, header_h, fill=BLUE)
    _draw_text(c, fee_x, y + 9, "Service Fee Details", _FONT_BOLD, 9, WHITE, "center", fee_w)

    _draw_rect(c, tax_x, y, tax_w, header_h, fill=BLUE)
    _draw_text(c, tax_x, y + 9, "Tax Details", _FONT_BOLD, 9, WHITE, "center", tax_w)

    # ── Data Rows ──
    # Info rows
    info_rows = [
        ("Company Name", "TOKAMAK NETWORK\nPTE. LTD."),
        ("Full name of\nContractor", contractor_name),
        ("Date of payment", payment_date.strftime("%b %d, %Y")),
        ("Start and end date\nof service fee period", f"{period_start.strftime('%B %d, %Y')} to\n{period_end.strftime('%B %d, %Y')}"),
        ("ERC20 Address", erc20_address or ""),
        ("Transaction URL", transaction_url or ""),
    ]

    fee_rows = [
        ("Basic service fee\nfor each period", _fmt(service_fee_usdt), False),
        ("Allowance paid for\nservice fee period", "-", False),
        ("Any other additional\npayment for each period", "-", False),
        ("ⓐ Total", _fmt(service_fee_usdt), True),
    ]

    tax_rows = [
        ("Income Tax", _fmt(income_tax_usdt), False),
        ("Local Income Tax", _fmt(local_tax_usdt), False),
        ("", "", False),  # empty row
        ("ⓑ Total", _fmt(total_tax_usdt), True),
    ]

    y_start = y - row_h  # first data row top

    # Draw Info column (6 rows)
    for i, (label, value) in enumerate(info_rows):
        ry = y_start - i * row_h

        # Label cell
        _draw_rect(c, info_x, ry, info_label_w, row_h)
        lines = label.split("\n")
        for li, line in enumerate(lines):
            _draw_text(c, info_x + 6, ry + row_h - 14 - li * 11, line, _FONT_NAME, 8, DARK)

        # Value cell
        _draw_rect(c, info_x + info_label_w, ry, info_value_w, row_h)
        val_lines = value.split("\n")
        vx = info_x + info_label_w + 6
        vw = info_value_w - 12
        for li, line in enumerate(val_lines):
            # Truncate long text
            fn = _FONT_NAME
            sz = 8
            if len(line) > 30:
                sz = 6.5
            _draw_text(c, vx, ry + row_h - 14 - li * 11, line, fn, sz, DARK)

    # Draw Service Fee column (4 rows, with spacing to align with info rows)
    fee_row_positions = [0, 1, 2, 4]  # row indices to align: basic=row0, allowance=row1, additional=row2/3, total=row4
    fee_row_map = [
        (0, 1),  # basic: spans info rows 0
        (1, 1),  # allowance: spans info row 1
        (2, 2),  # additional: spans info rows 2-3
        (4, 2),  # total: spans info rows 4-5
    ]

    for idx, (start_row, span) in enumerate(fee_row_map):
        ry = y_start - start_row * row_h
        rh = row_h * span
        label, value, is_total = fee_rows[idx]

        # Label cell
        fill = BLUE if is_total else None
        text_color = WHITE if is_total else DARK
        _draw_rect(c, fee_x, ry, fee_label_w, rh, fill=fill)
        lines = label.split("\n")
        for li, line in enumerate(lines):
            _draw_text(c, fee_x + 6, ry + rh - 16 - li * 11, line, _FONT_BOLD if is_total else _FONT_NAME, 8, text_color)

        # Value cell
        _draw_rect(c, fee_x + fee_label_w, ry, fee_value_w, rh)
        _draw_text(c, fee_x + fee_label_w, ry + rh - 16, value, _FONT_BOLD if is_total else _FONT_NAME, 9, DARK, "right", fee_value_w - 8)

    # Draw Tax column (4 rows, aligned with fee column)
    tax_row_map = [
        (0, 1),  # Income Tax
        (1, 1),  # Local Income Tax
        (2, 2),  # empty
        (4, 2),  # total
    ]

    for idx, (start_row, span) in enumerate(tax_row_map):
        ry = y_start - start_row * row_h
        rh = row_h * span
        label, value, is_total = tax_rows[idx]

        if not label and not value:
            # Empty row — just draw border
            _draw_rect(c, tax_x, ry, tax_w, rh)
            continue

        # Label cell
        fill = BLUE if is_total else None
        text_color = WHITE if is_total else DARK
        _draw_rect(c, tax_x, ry, tax_label_w, rh, fill=fill)
        lines = label.split("\n")
        for li, line in enumerate(lines):
            _draw_text(c, tax_x + 6, ry + rh - 16 - li * 11, line, _FONT_BOLD if is_total else _FONT_NAME, 8, text_color)

        # Value cell
        _draw_rect(c, tax_x + tax_label_w, ry, tax_value_w, rh)
        _draw_text(c, tax_x + tax_label_w, ry + rh - 16, value, _FONT_BOLD if is_total else _FONT_NAME, 9, DARK, "right", tax_value_w - 8)

    # ── Net Service Fee Box (below tax column) ──
    net_y = y_start - 6 * row_h - 8
    net_h = row_h + 4

    # Net label
    _draw_rect(c, tax_x, net_y, tax_label_w, net_h, fill=LIGHT_BLUE)
    _draw_text(c, tax_x + 6, net_y + net_h - 14, "Net service fee", _FONT_BOLD, 9, DARK)
    _draw_text(c, tax_x + 6, net_y + net_h - 26, "(ⓐ-ⓑ)", _FONT_NAME, 8, GRAY)

    # Net value
    _draw_rect(c, tax_x + tax_label_w, net_y, tax_value_w, net_h, fill=LIGHT_BLUE)
    _draw_text(c, tax_x + tax_label_w, net_y + net_h - 18, _fmt(net_usdt), _FONT_BOLD, 11, DARK, "right", tax_value_w - 8)

    # ── Notice row (below info column) ──
    notice_y = y_start - 6 * row_h - 8
    notice_h = net_h
    _draw_rect(c, info_x, notice_y, info_w, notice_h)
    _draw_text(c, info_x + 6, notice_y + notice_h - 16, "Notice", _FONT_BOLD, 8, DARK)

    # ── KRW Reference Section ──
    krw_y = notice_y - 20
    ref_w = page_w - 2 * margin_x

    # Header
    _draw_rect(c, margin_x, krw_y - 18, ref_w, 18, fill=(0.96, 0.96, 0.96))
    _draw_text(c, margin_x + 6, krw_y - 13, "KRW Reference (참고용)", _FONT_BOLD, 8, GRAY)

    # Data rows
    ref_col_w = ref_w / 4
    ref_data = [
        [("적용 환율 (USD-KRW)", _fmt_krw(round(exchange_rate))), ("세액 비율", f"{tax_percentage}%")],
        [("월 급여액 (Gross KRW)", _fmt_krw(gross_krw)), ("소득세 (KRW)", _fmt_krw(income_tax_krw))],
        [("세후 수령액 (Net KRW)", _fmt_krw(net_krw)), ("지방소득세 (KRW)", _fmt_krw(local_tax_krw))],
    ]

    for ri, row_data in enumerate(ref_data):
        ry = krw_y - 18 - (ri + 1) * 20
        for ci, (label, value) in enumerate(row_data):
            lx = margin_x + ci * ref_w / 2
            _draw_rect(c, lx, ry, ref_col_w, 20)
            _draw_text(c, lx + 6, ry + 6, label, _FONT_NAME, 7.5, GRAY)
            _draw_rect(c, lx + ref_col_w, ry, ref_col_w, 20)
            _draw_text(c, lx + ref_col_w, ry + 6, value, _FONT_BOLD, 8, DARK, "right", ref_col_w - 8)

    # ── Footer Notice ──
    footer_y = krw_y - 18 - 4 * 20 - 8
    c.setFont(_FONT_NAME, 7)
    c.setFillColorRGB(*GRAY)
    c.drawString(margin_x, footer_y,
        "Notice: This payslip is generated based on the 2026 Korean Simplified Tax Table (근로소득 간이세액표, revised 2026.2.27).")
    c.drawString(margin_x, footer_y - 10,
        "Actual tax amounts may differ from the simplified table calculations. Tax amounts are converted to USDT using the applied exchange rate.")

    c.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
