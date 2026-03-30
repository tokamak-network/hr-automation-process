"""
Korean Income Tax Calculator (근로소득세)
Based on 2024/2025 Korean tax brackets.
"""

# 근로소득공제 (Employment Income Deduction)
def employment_income_deduction(total_income: float) -> float:
    """Calculate 근로소득공제 based on total annual income (KRW)."""
    if total_income <= 5_000_000:
        return total_income * 0.70
    elif total_income <= 15_000_000:
        return 3_500_000 + (total_income - 5_000_000) * 0.40
    elif total_income <= 45_000_000:
        return 7_500_000 + (total_income - 15_000_000) * 0.15
    elif total_income <= 100_000_000:
        return 12_000_000 + (total_income - 45_000_000) * 0.05
    else:
        return 14_750_000 + (total_income - 100_000_000) * 0.02


# 기본공제 (Basic deduction) - simplified: 본인 1인 150만원
BASIC_DEDUCTION = 1_500_000


# 근로소득세율표 (Tax brackets)
TAX_BRACKETS = [
    (14_000_000, 0.06, 0),
    (50_000_000, 0.15, 840_000),
    (88_000_000, 0.24, 5_940_000),
    (150_000_000, 0.35, 15_940_000),
    (300_000_000, 0.38, 19_940_000),
    (500_000_000, 0.40, 25_940_000),
    (1_000_000_000, 0.42, 35_940_000),
    (float('inf'), 0.45, 65_940_000),
]


def calculate_income_tax(taxable_income: float) -> float:
    """Calculate 산출세액 from 과세표준."""
    if taxable_income <= 0:
        return 0
    for upper, rate, cumulative in TAX_BRACKETS:
        if taxable_income <= upper:
            prev_upper = 0
            for u, r, c in TAX_BRACKETS:
                if u == upper:
                    break
                prev_upper = u
            return cumulative + (taxable_income - prev_upper) * rate
    return 0


def simulate_annual_tax(annual_income_krw: float) -> dict:
    """
    Full tax simulation for a given annual income in KRW.
    Returns detailed breakdown.
    """
    deduction = employment_income_deduction(annual_income_krw)
    after_deduction = max(0, annual_income_krw - deduction)
    taxable_income = max(0, after_deduction - BASIC_DEDUCTION)
    tax = calculate_income_tax(taxable_income)
    local_tax = tax * 0.10  # 지방소득세 10%
    total_tax = tax + local_tax

    # Find applicable bracket
    applicable_rate = 0.06
    for upper, rate, _ in TAX_BRACKETS:
        if taxable_income <= upper:
            applicable_rate = rate
            break

    return {
        "annual_income_krw": round(annual_income_krw),
        "employment_deduction": round(deduction),
        "after_deduction": round(after_deduction),
        "basic_deduction": BASIC_DEDUCTION,
        "taxable_income": round(taxable_income),
        "applicable_rate": applicable_rate,
        "income_tax": round(tax),
        "local_tax": round(local_tax),
        "total_tax": round(total_tax),
        "effective_rate": round(total_tax / annual_income_krw * 100, 2) if annual_income_krw > 0 else 0,
    }


def monthly_tax_burden(annual_income_krw: float, months: int = 12) -> list:
    """Calculate cumulative monthly tax burden for chart data."""
    result = []
    for m in range(1, months + 1):
        cumulative_income = annual_income_krw / 12 * m
        sim = simulate_annual_tax(cumulative_income * (12 / m))  # annualize
        monthly_tax = sim["total_tax"] / 12
        result.append({
            "month": m,
            "cumulative_income": round(cumulative_income),
            "estimated_monthly_tax": round(monthly_tax),
            "estimated_annual_tax": sim["total_tax"],
        })
    return result
