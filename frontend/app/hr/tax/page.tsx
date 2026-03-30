"use client";
import { useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);

interface TaxResult {
  monthly_salary_krw: number;
  income_tax_80: number;
  local_tax_80: number;
  total_tax_80: number;
  income_tax_100: number;
  local_tax_100: number;
  total_tax_100: number;
  income_tax_120: number;
  local_tax_120: number;
  total_tax_120: number;
}

export default function TaxCalculator() {
  const [usdt, setUsdt] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");
  const [dependents, setDependents] = useState(1);
  const [children, setChildren] = useState("");
  const [result, setResult] = useState<TaxResult | null>(null);
  const [loading, setLoading] = useState(false);

  const krwAmount = usdt && exchangeRate ? Math.round(parseFloat(usdt) * parseFloat(exchangeRate)) : 0;
  const childrenNum = children ? parseInt(children) : 0;
  const canCalculate = parseFloat(usdt) > 0 && parseFloat(exchangeRate) > 0 && dependents >= 1;

  const handleCalculate = async () => {
    if (!canCalculate) return;
    setLoading(true);
    try {
      const res = await fetch("/api/hr/tax/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthly_salary_krw: krwAmount,
          num_dependents: dependents,
          num_children_8_20: childrenNum,
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">세금 시뮬레이션</h1>
      <p className="text-sm mb-8 text-gray-400">
        2026년 근로소득 간이세액표 기반 (개정 2026.2.27)
      </p>

      {/* Input Section */}
      <div className="max-w-2xl space-y-5 mb-8">
        {/* 1. 월 서비스 Fee (USDT) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            1. 월 서비스 Fee (USDT)
          </label>
          <div className="relative">
            <input
              type="number"
              value={usdt}
              onChange={(e) => setUsdt(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A72E5]/30 focus:border-[#2A72E5]"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">USDT</span>
          </div>
        </div>

        {/* 2. USD-KRW 환율 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            2. 월급여일 전날 기준 USD-KRW 마감환율
          </label>
          <div className="relative">
            <input
              type="number"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              placeholder="1,350"
              step="0.01"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A72E5]/30 focus:border-[#2A72E5]"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">KRW/USD</span>
          </div>
        </div>

        {/* 3. 환산 KRW 금액 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            3. 환산 월 급여액 (KRW)
          </label>
          <div className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-sm">
            {krwAmount > 0 ? (
              <span className="font-semibold text-[#2A72E5]">₩{fmt(krwAmount)}</span>
            ) : (
              <span className="text-gray-400">위 항목을 입력하면 자동 계산됩니다</span>
            )}
          </div>
        </div>

        {/* 4. 공제대상 가족 수 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            4. 공제대상 가족 수 (본인 포함)
          </label>
          <select
            value={dependents}
            onChange={(e) => setDependents(Number(e.target.value))}
            className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A72E5]/30 focus:border-[#2A72E5] bg-white"
          >
            {Array.from({ length: 11 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}명{n === 1 ? " (본인만)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* 5. 8~20세 자녀 수 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            5. 공제대상 가족 중 8세 이상 20세 이하 자녀 수
          </label>
          <input
            type="number"
            min="0"
            max="20"
            value={children}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9]/g, "");
              setChildren(v);
            }}
            placeholder="0"
            className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A72E5]/30 focus:border-[#2A72E5]"
          />
        </div>

        {/* 6. 계산 버튼 */}
        <button
          onClick={handleCalculate}
          disabled={!canCalculate || loading}
          className={`w-full py-3 rounded-lg text-sm font-semibold transition ${
            canCalculate && !loading
              ? "bg-[#2A72E5] text-white hover:bg-[#1E5FCC]"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          {loading ? "계산 중..." : "세액 계산하기"}
        </button>
      </div>

      {/* 7. Result Section */}
      {result && (
        <div className="max-w-2xl rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="font-bold text-lg">나의 월급에서 한 달에 납부하는 세금은?</h2>
            <p className="text-sm text-[#2A72E5] mt-1">
              2026년 근로소득 간이세액표상의 세액으로서 실제 징수세금과 차이가 있을 수 있습니다.
            </p>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* 80% */}
            <div>
              <h3 className="font-bold text-sm mb-3">80% 선택</h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">소득세</span>
                  <span className="text-sm font-medium">{fmt(result.income_tax_80)} 원</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">지방소득세</span>
                  <span className="text-sm font-medium">{fmt(result.local_tax_80)} 원</span>
                </div>
              </div>
              <div className="flex justify-between items-center py-2 mt-1">
                <span className="text-sm font-semibold text-red-500">납부세액의 합계액</span>
                <span className="text-sm font-bold text-red-500">{fmt(result.total_tax_80)} 원</span>
              </div>
            </div>

            {/* 100% */}
            <div>
              <h3 className="font-bold text-sm mb-3">100% 선택</h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">소득세</span>
                  <span className="text-sm font-medium">{fmt(result.income_tax_100)} 원</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">지방소득세</span>
                  <span className="text-sm font-medium">{fmt(result.local_tax_100)} 원</span>
                </div>
              </div>
              <div className="flex justify-between items-center py-2 mt-1">
                <span className="text-sm font-semibold text-red-500">납부세액의 합계액</span>
                <span className="text-sm font-bold text-red-500">{fmt(result.total_tax_100)} 원</span>
              </div>
            </div>

            {/* 120% */}
            <div>
              <h3 className="font-bold text-sm mb-3">120% 선택</h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">소득세</span>
                  <span className="text-sm font-medium">{fmt(result.income_tax_120)} 원</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">지방소득세</span>
                  <span className="text-sm font-medium">{fmt(result.local_tax_120)} 원</span>
                </div>
              </div>
              <div className="flex justify-between items-center py-2 mt-1">
                <span className="text-sm font-semibold text-red-500">납부세액의 합계액</span>
                <span className="text-sm font-bold text-red-500">{fmt(result.total_tax_120)} 원</span>
              </div>
            </div>
          </div>

          {/* Net amount summary */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">월 급여액 (Gross)</span>
              <span className="text-sm font-bold">₩{fmt(result.monthly_salary_krw)}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm font-medium text-gray-600">100% 기준 세후 수령액 (Net)</span>
              <span className="text-sm font-bold text-[#2A72E5]">
                ₩{fmt(result.monthly_salary_krw - result.total_tax_100)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
