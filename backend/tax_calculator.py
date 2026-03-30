"""
2026년 근로소득 간이세액표 기반 세금 계산기
소득세법 시행령 [별표 2] <개정 2026. 2. 27.>

- 간이세액표: 월급여 770천원 ~ 10,000천원 (tax_table_2026.json)
- 고소득 구간: 10,000천원 초과 공식 적용
- 지방소득세: 소득세의 10%
- 8~20세 자녀 공제 반영
"""

import json
import os
import bisect

# Load tax table
_TABLE_PATH = os.path.join(os.path.dirname(__file__), "tax_table_2026.json")
_table = None


def _load_table():
    global _table
    if _table is None:
        with open(_TABLE_PATH, "r") as f:
            _table = json.load(f)
    return _table


def _child_deduction(num_children_8_20: int) -> int:
    """8세 이상 20세 이하 자녀 공제액 (원)"""
    if num_children_8_20 <= 0:
        return 0
    if num_children_8_20 == 1:
        return 20_830
    if num_children_8_20 == 2:
        return 45_830
    # 3명 이상: 45,830 + (초과 1명당 33,330)
    return 45_830 + (num_children_8_20 - 2) * 33_330


def lookup_income_tax(monthly_salary_krw: int, num_dependents: int = 1, num_children_8_20: int = 0) -> int:
    """
    간이세액표에서 소득세 조회.
    
    Args:
        monthly_salary_krw: 월급여액 (원, 비과세 제외)
        num_dependents: 공제대상가족 수 (본인 포함, 1~11+)
        num_children_8_20: 8세 이상 20세 이하 자녀 수
    
    Returns:
        월 소득세 (원)
    """
    table = _load_table()
    
    # 월급여를 천원 단위로 변환
    salary_k = monthly_salary_krw / 1000
    
    # 공제대상가족 수 인덱스 (1명 → index 0, 11명 → index 10)
    dep_idx = min(max(num_dependents, 1), 11) - 1
    
    # 770천원 미만: 세액 0
    if salary_k < 770:
        return 0
    
    # 10,000천원 초과: 공식 적용
    if salary_k > 10000:
        return _high_income_tax(monthly_salary_krw, dep_idx)
    
    # 간이세액표 조회
    # 정확히 10,000천원인 경우: 테이블 마지막 행 (lower=10000, upper=10000)
    for row in table:
        if row["lower"] == 10000 and row["upper"] == 10000 and salary_k == 10000:
            base_tax = row["tax"][dep_idx]
            break
        elif row["lower"] <= salary_k < row["upper"]:
            base_tax = row["tax"][dep_idx]
            break
    else:
        # Fallback: 가장 가까운 구간
        base_tax = table[-1]["tax"][dep_idx]
    
    # 공제대상가족 11명 초과 처리
    if num_dependents > 11:
        tax_10 = _lookup_raw(salary_k, 9)  # 10명 (index 9)
        tax_11 = _lookup_raw(salary_k, 10)  # 11명 (index 10)
        extra_fam = num_dependents - 11
        base_tax = max(0, tax_11 - (tax_10 - tax_11) * extra_fam)
    
    # 자녀 공제 적용
    child_ded = _child_deduction(num_children_8_20)
    base_tax = max(0, base_tax - child_ded)
    
    return base_tax


def _lookup_raw(salary_k: float, dep_idx: int) -> int:
    """테이블에서 raw 세액 조회 (자녀공제 미적용)"""
    table = _load_table()
    for row in table:
        if row["lower"] == 10000 and row["upper"] == 10000 and salary_k == 10000:
            return row["tax"][dep_idx]
        elif row["lower"] <= salary_k < row["upper"]:
            return row["tax"][dep_idx]
    return table[-1]["tax"][dep_idx]


def _high_income_tax(monthly_salary_krw: int, dep_idx: int) -> int:
    """
    월급여 10,000천원 초과 구간 공식 계산.
    
    10,000천원 초과 ~ 14,000천원: base + (초과액 × 98% × 35%) + 25,000
    14,000천원 초과 ~ 28,000천원: base + 1,397,000 + (초과액 × 98% × 38%)
    28,000천원 초과 ~ 30,000천원: base + 6,610,600 + (초과액 × 98% × 40%)
    30,000천원 초과 ~ 45,000천원: base + 7,394,600 + (초과액 × 40%)
    45,000천원 초과 ~ 87,000천원: base + 13,394,600 + (초과액 × 42%)
    87,000천원 초과: base + 31,034,600 + (초과액 × 45%)
    """
    table = _load_table()
    
    # 10,000천원 기준 세액 (base)
    base_row = table[-1]  # lower=10000, upper=10000
    base = base_row["tax"][dep_idx]
    
    salary_k = monthly_salary_krw / 1000  # 천원 단위
    
    if salary_k <= 14000:
        excess = monthly_salary_krw - 10_000_000
        return base + int(excess * 0.98 * 0.35) + 25_000
    elif salary_k <= 28000:
        excess = monthly_salary_krw - 14_000_000
        return base + 1_397_000 + int(excess * 0.98 * 0.38)
    elif salary_k <= 30000:
        excess = monthly_salary_krw - 28_000_000
        return base + 6_610_600 + int(excess * 0.98 * 0.40)
    elif salary_k <= 45000:
        excess = monthly_salary_krw - 30_000_000
        return base + 7_394_600 + int(excess * 0.40)
    elif salary_k <= 87000:
        excess = monthly_salary_krw - 45_000_000
        return base + 13_394_600 + int(excess * 0.42)
    else:
        excess = monthly_salary_krw - 87_000_000
        return base + 31_034_600 + int(excess * 0.45)


def calculate_tax(monthly_salary_krw: int, num_dependents: int = 1, num_children_8_20: int = 0) -> dict:
    """
    월 소득세 + 지방소득세 계산.
    
    Returns:
        {
            "monthly_salary_krw": 월급여액,
            "num_dependents": 공제대상가족 수,
            "num_children_8_20": 8~20세 자녀 수,
            "income_tax_100": 소득세 (100%),
            "local_tax_100": 지방소득세 (100%),
            "total_tax_100": 납부세액 합계 (100%),
            "income_tax_80": 소득세 (80%),
            "local_tax_80": 지방소득세 (80%),
            "total_tax_80": 납부세액 합계 (80%),
            "income_tax_120": 소득세 (120%),
            "local_tax_120": 지방소득세 (120%),
            "total_tax_120": 납부세액 합계 (120%),
        }
    """
    income_tax = lookup_income_tax(monthly_salary_krw, num_dependents, num_children_8_20)
    
    import math
    def _ceil10(n):
        """10원 단위 올림"""
        return math.ceil(n / 10) * 10
    
    # 100%
    it_100 = _ceil10(income_tax)
    lt_100 = _ceil10(int(it_100 * 0.1))
    
    # 80%
    it_80 = _ceil10(int(income_tax * 0.8))
    lt_80 = _ceil10(int(it_80 * 0.1))
    
    # 120%
    it_120 = _ceil10(int(income_tax * 1.2))
    lt_120 = _ceil10(int(it_120 * 0.1))
    
    return {
        "monthly_salary_krw": monthly_salary_krw,
        "num_dependents": num_dependents,
        "num_children_8_20": num_children_8_20,
        "income_tax_100": it_100,
        "local_tax_100": lt_100,
        "total_tax_100": it_100 + lt_100,
        "income_tax_80": it_80,
        "local_tax_80": lt_80,
        "total_tax_80": it_80 + lt_80,
        "income_tax_120": it_120,
        "local_tax_120": lt_120,
        "total_tax_120": it_120 + lt_120,
    }


# Legacy compatibility
def simulate_annual_tax(annual_income_krw: float) -> dict:
    """연간 소득 기반 세금 시뮬레이션 (레거시 호환)"""
    monthly = annual_income_krw / 12
    result = calculate_tax(int(monthly), num_dependents=1)
    total_annual = result["total_tax_100"] * 12
    return {
        "annual_income_krw": round(annual_income_krw),
        "employment_deduction": 0,
        "after_deduction": round(annual_income_krw),
        "basic_deduction": 0,
        "taxable_income": round(annual_income_krw),
        "applicable_rate": 0,
        "income_tax": result["income_tax_100"] * 12,
        "local_tax": result["local_tax_100"] * 12,
        "total_tax": total_annual,
        "effective_rate": round(total_annual / annual_income_krw * 100, 2) if annual_income_krw > 0 else 0,
    }


def monthly_tax_burden(annual_income_krw: float, months: int = 12) -> list:
    """월별 세부담 추이 (레거시 호환)"""
    monthly_salary = int(annual_income_krw / 12)
    result = calculate_tax(monthly_salary, num_dependents=1)
    return [
        {
            "month": m,
            "cumulative_income": round(monthly_salary * m),
            "estimated_monthly_tax": result["total_tax_100"],
            "estimated_annual_tax": result["total_tax_100"] * 12,
        }
        for m in range(1, months + 1)
    ]
