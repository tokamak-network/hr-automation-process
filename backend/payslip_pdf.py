"""
Payslip PDF Generator
Generates a service fee payslip PDF matching the Tokamak Network template.
"""

import io
import calendar
from datetime import date, datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Spacer, Paragraph
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Try to register a font that supports Korean
import os
_FONT_REGISTERED = False

def _register_fonts():
    global _FONT_REGISTERED
    if _FONT_REGISTERED:
        return
    # Try system fonts
    candidates = [
        ("/System/Library/Fonts/AppleSDGothicNeo.ttc", "AppleSD"),
        ("/System/Library/Fonts/Supplemental/Arial Unicode.ttf", "ArialUnicode"),
        ("/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc", "NotoSansCJK"),
    ]
    for path, name in candidates:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont(name, path, subfontIndex=0))
                _FONT_REGISTERED = True
                return name
            except Exception:
                continue
    return "Helvetica"


def _get_font():
    name = _register_fonts()
    if name:
        return name
    return "Helvetica"


def _fmt(n: float) -> str:
    """Format number with commas, 2 decimal places for USDT"""
    if n == 0:
        return "-"
    return f"{n:,.2f}"


def _fmt_krw(n: int) -> str:
    if n == 0:
        return "-"
    return f"{n:,}"


def last_business_day(year: int, month: int) -> date:
    """Get last business day of a month."""
    last_day = date(year, month, calendar.monthrange(year, month)[1])
    while last_day.weekday() >= 5:  # Sat=5, Sun=6
        last_day = last_day.replace(day=last_day.day - 1)
    return last_day


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
    tax_percentage: int = 100,  # 80, 100, or 120
    issue_date: str = "",  # YYYY-MM-DD, defaults to today
) -> bytes:
    """Generate payslip PDF and return bytes."""
    
    font = _get_font()
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=15*mm,
        rightMargin=15*mm,
        topMargin=15*mm,
        bottomMargin=15*mm,
    )
    
    # Calculations
    gross_krw = round(service_fee_usdt * exchange_rate)
    net_tax_krw = total_tax_krw
    net_krw = gross_krw - net_tax_krw
    
    # Convert to USDT equivalents
    if exchange_rate > 0:
        income_tax_usdt = income_tax_krw / exchange_rate
        local_tax_usdt = local_tax_krw / exchange_rate
        total_tax_usdt = total_tax_krw / exchange_rate
        net_usdt = service_fee_usdt - total_tax_usdt
    else:
        income_tax_usdt = 0
        local_tax_usdt = 0
        total_tax_usdt = 0
        net_usdt = service_fee_usdt
    
    # Dates
    payment_date = last_business_day(payment_year, payment_month)
    period_start = date(payment_year, payment_month, 1)
    period_end = date(payment_year, payment_month, calendar.monthrange(payment_year, payment_month)[1])
    
    if issue_date:
        issue_dt = issue_date
    else:
        issue_dt = date.today().strftime("%Y-%m-%d")
    
    # Styles
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle('Title', fontName=font, fontSize=11, leading=14, alignment=TA_CENTER, spaceAfter=2*mm)
    label_style = ParagraphStyle('Label', fontName=font, fontSize=8, leading=10, textColor=colors.HexColor("#333333"))
    value_style = ParagraphStyle('Value', fontName=font, fontSize=8, leading=10, textColor=colors.HexColor("#111111"))
    value_right = ParagraphStyle('ValueRight', fontName=font, fontSize=8, leading=10, alignment=TA_RIGHT)
    header_style = ParagraphStyle('Header', fontName=font, fontSize=8.5, leading=11, textColor=colors.white, alignment=TA_CENTER)
    section_style = ParagraphStyle('Section', fontName=font, fontSize=8.5, leading=11, textColor=colors.white)
    small_style = ParagraphStyle('Small', fontName=font, fontSize=7, leading=9, textColor=colors.HexColor("#666666"))
    issue_style = ParagraphStyle('Issue', fontName=font, fontSize=8, leading=10, alignment=TA_RIGHT, textColor=colors.HexColor("#333333"))
    net_label = ParagraphStyle('NetLabel', fontName=font, fontSize=9, leading=12, alignment=TA_CENTER, textColor=colors.HexColor("#111111"))
    net_value = ParagraphStyle('NetValue', fontName=font, fontSize=10, leading=13, alignment=TA_RIGHT, textColor=colors.HexColor("#111111"))
    notice_style = ParagraphStyle('Notice', fontName=font, fontSize=7.5, leading=10, textColor=colors.HexColor("#666666"))
    
    elements = []
    
    # ── Title Row with Issue Date ──
    title_data = [
        [Paragraph("SERVICE FEE PAYSLIP", title_style), '', '', Paragraph(f"Issue Date: {issue_dt}", issue_style)],
    ]
    title_table = Table(title_data, colWidths=[60*mm, 40*mm, 40*mm, 45*mm])
    title_table.setStyle(TableStyle([
        ('SPAN', (0, 0), (2, 0)),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4*mm),
    ]))
    elements.append(title_table)
    elements.append(Spacer(1, 3*mm))
    
    # ── Monetary unit headers ──
    unit_data = [
        ['', '', '', '', Paragraph("Monetary unit : USDT", small_style), '', '', Paragraph("Monetary unit : USDT", small_style)],
    ]
    
    # ── Main Table ──
    BG_DARK = colors.HexColor("#2A72E5")
    BG_LIGHT = colors.HexColor("#E8F0FE")
    BORDER = colors.HexColor("#CCCCCC")
    
    col_widths = [28*mm, 52*mm, 28*mm, 22*mm, 5*mm, 28*mm, 22*mm, 5*mm]
    
    # Build rows
    P = Paragraph
    
    data = [
        # Row 0: Section headers
        [P("Information", header_style), '', 
         P("Service Fee Details", header_style), '', '',
         P("Tax Details", header_style), '', ''],
        
        # Row 1: Company + Basic service fee + Income Tax
        [P("Full name of company", label_style), P("TOKAMAK NETWORK PTE. LTD.", value_style),
         P("Basic service fee\nfor each period", label_style), P(_fmt(service_fee_usdt), value_right), '',
         P("Income Tax", label_style), P(_fmt(income_tax_usdt), value_right), ''],
        
        # Row 2: Contractor name + Allowance + Local Tax
        [P("Full name of contractor", label_style), P(contractor_name, value_style),
         P("Allowance paid for\nservice fee period", label_style), P("-", value_right), '',
         P("Local Income Tax", label_style), P(_fmt(local_tax_usdt), value_right), ''],
        
        # Row 3: Date of payment + Additional + empty
        [P("Date of payment", label_style), P(payment_date.strftime("%Y-%m-%d"), value_style),
         P("Any other additional\npayment for each period", label_style), P("-", value_right), '',
         '', '', ''],
        
        # Row 4: Period + ⓐTotal + ⓑTotal
        [P("Start and end date of\nservice fee period", label_style), 
         P(f"{period_start.strftime('%Y-%m-%d')} ~ {period_end.strftime('%Y-%m-%d')}", value_style),
         P("ⓐ Total", section_style), P(_fmt(service_fee_usdt), value_right), '',
         P("ⓑ Total", section_style), P(_fmt(total_tax_usdt), value_right), ''],
        
        # Row 5: ERC20 Address
        [P("ERC20 Address", label_style), P(erc20_address if erc20_address else "", small_style),
         '', '', '', '', '', ''],
        
        # Row 6: Transaction URL + Net service fee
        [P("Transaction URL", label_style), P(transaction_url if transaction_url else "", small_style),
         '', '', '',
         P("Net service fee\n(ⓐ-ⓑ)", net_label), P(_fmt(net_usdt), net_value), ''],
    ]
    
    table = Table(data, colWidths=col_widths, rowHeights=[9*mm, 12*mm, 12*mm, 12*mm, 12*mm, 12*mm, 14*mm])
    
    style_cmds = [
        # Global
        ('FONTNAME', (0, 0), (-1, -1), font),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('TOPPADDING', (0, 0), (-1, -1), 1.5*mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5*mm),
        ('LEFTPADDING', (0, 0), (-1, -1), 2*mm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2*mm),
        
        # Header row backgrounds
        ('BACKGROUND', (0, 0), (1, 0), BG_DARK),
        ('BACKGROUND', (2, 0), (4, 0), BG_DARK),
        ('BACKGROUND', (5, 0), (7, 0), BG_DARK),
        ('SPAN', (0, 0), (1, 0)),
        ('SPAN', (2, 0), (4, 0)),
        ('SPAN', (5, 0), (7, 0)),
        
        # ⓐTotal and ⓑTotal row backgrounds
        ('BACKGROUND', (2, 4), (2, 4), BG_DARK),
        ('BACKGROUND', (5, 4), (5, 4), BG_DARK),
        
        # Net service fee highlight
        ('BACKGROUND', (5, 6), (6, 6), BG_LIGHT),
        
        # Spans for address/url rows
        ('SPAN', (1, 5), (4, 5)),  # ERC20 address spans
        ('SPAN', (1, 6), (4, 6)),  # TX URL spans
        
        # Empty separator column
        ('BACKGROUND', (4, 1), (4, 4), colors.white),
        ('LINEWIDTH', (4, 1), (4, 4), 0),
    ]
    
    table.setStyle(TableStyle(style_cmds))
    elements.append(table)
    
    elements.append(Spacer(1, 4*mm))
    
    # ── KRW Reference ──
    krw_data = [
        [P("KRW Reference (참고용)", ParagraphStyle('', fontName=font, fontSize=8, textColor=colors.HexColor("#666"))), '', '', ''],
        [P("적용 환율 (USD-KRW)", small_style), P(f"₩{_fmt_krw(round(exchange_rate))}", value_right), 
         P(f"세액 비율", small_style), P(f"{tax_percentage}%", value_right)],
        [P("월 급여액 (Gross KRW)", small_style), P(f"₩{_fmt_krw(gross_krw)}", value_right),
         P("소득세 (KRW)", small_style), P(f"₩{_fmt_krw(income_tax_krw)}", value_right)],
        [P("세후 수령액 (Net KRW)", small_style), P(f"₩{_fmt_krw(net_krw)}", value_right),
         P("지방소득세 (KRW)", small_style), P(f"₩{_fmt_krw(local_tax_krw)}", value_right)],
    ]
    
    krw_table = Table(krw_data, colWidths=[45*mm, 45*mm, 45*mm, 45*mm])
    krw_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), font),
        ('SPAN', (0, 0), (3, 0)),
        ('BACKGROUND', (0, 0), (3, 0), colors.HexColor("#F5F5F5")),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor("#E0E0E0")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 1.5*mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5*mm),
        ('LEFTPADDING', (0, 0), (-1, -1), 2*mm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2*mm),
    ]))
    elements.append(krw_table)
    
    elements.append(Spacer(1, 5*mm))
    
    # ── Notice ──
    notice_text = (
        "Notice: This payslip is generated based on the 2026 Korean Simplified Tax Table "
        "(근로소득 간이세액표, revised 2026.2.27). Actual tax amounts may differ from the "
        "simplified table calculations. Tax amounts are converted to USDT using the applied exchange rate."
    )
    elements.append(Paragraph(notice_text, notice_style))
    
    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
