"use client";
import { useState, useEffect } from "react";

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
  const [inputMode, setInputMode] = useState<"USDT" | "KRW">("USDT");
  const [usdt, setUsdt] = useState("");
  const [krwDirect, setKrwDirect] = useState("");
  const [rateDate, setRateDate] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");
  const [rateLoading, setRateLoading] = useState(false);
  const [rateSource, setRateSource] = useState("");
  const [dependents, setDependents] = useState(1);
  const [children, setChildren] = useState("");
  const [result, setResult] = useState<TaxResult | null>(null);
  const [loading, setLoading] = useState(false);

  // 날짜 변경 시 환율 자동 조회
  useEffect(() => {
    if (!rateDate) return;
    const fetchRate = async () => {
      setRateLoading(true);
      setRateSource("");
      try {
        const dateStr = rateDate.replace(/-/g, "");
        const res = await fetch(`/api/hr/exchange-rate?date=${dateStr}`);
        if (res.ok) {
          const data = await res.json();
          setExchangeRate(String(data.rate));
          setRateSource(`${data.source} | ${data.date} | ${data.item}`);
        } else {
          const err = await res.json();
          setRateSource(`조회 실패: ${err.detail || "해당 날짜 데이터 없음"}`);
        }
      } catch {
        setRateSource("API 연결 실패");
      } finally {
        setRateLoading(false);
      }
    };
    fetchRate();
  }, [rateDate]);

  const krwAmount = inputMode === "KRW"
    ? (krwDirect ? parseInt(krwDirect) : 0)
    : (usdt && exchangeRate ? Math.round(parseFloat(usdt) * parseFloat(exchangeRate)) : 0);
  const childrenNum = children ? parseInt(children) : 0;
  const canCalculate = krwAmount > 0 && dependents >= 1;

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
        {/* 1. 입력 방식 선택 + 금액 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            1. 월 서비스 Fee
          </label>
          <div className="flex gap-2 mb-2">
            <button onClick={() => setInputMode("USDT")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${inputMode === "USDT" ? "bg-[#2A72E5] text-white" : "bg-gray-50 text-gray-500 border border-gray-200"}`}>
              USDT 입력
            </button>
            <button onClick={() => setInputMode("KRW")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${inputMode === "KRW" ? "bg-[#2A72E5] text-white" : "bg-gray-50 text-gray-500 border border-gray-200"}`}>
              KRW 직접 입력
            </button>
          </div>
          {inputMode === "USDT" ? (
            <div className="relative">
              <input type="number" value={usdt} onChange={(e) => setUsdt(e.target.value)} placeholder="0"
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A72E5]/30 focus:border-[#2A72E5]" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">USDT</span>
            </div>
          ) : (
            <div className="relative">
              <input type="number" value={krwDirect} onChange={(e) => setKrwDirect(e.target.value)} placeholder="0"
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A72E5]/30 focus:border-[#2A72E5]" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">KRW</span>
            </div>
          )}
        </div>

        {/* 2. 환율 (USDT 모드만) */}
        {inputMode === "USDT" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              2. USD-KRW 마감환율
            </label>
            <div className="flex gap-3">
              <div className="flex-1">
                <input type="date" value={rateDate} onChange={(e) => setRateDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A72E5]/30 focus:border-[#2A72E5]" />
              </div>
              <div className="flex-1 relative">
                <input type="number" value={exchangeRate}
                  onChange={(e) => { setExchangeRate(e.target.value); setRateSource("직접 입력"); }}
                  placeholder={rateLoading ? "조회 중..." : "날짜 선택 시 자동 입력"} step="0.01"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A72E5]/30 focus:border-[#2A72E5]" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">
                  {rateLoading ? "⏳" : "KRW/USD"}
                </span>
              </div>
            </div>
            {rateSource && (
              <p className={`text-xs mt-1.5 ${rateSource.includes("실패") ? "text-red-400" : "text-gray-400"}`}>
                📌 {rateSource}
              </p>
            )}
          </div>
        )}

        {/* 3. 환산 KRW 금액 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {inputMode === "USDT" ? "3. 환산 월 급여액 (KRW)" : "2. 월 급여액 (KRW)"}
          </label>
          <div className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-sm">
            {krwAmount > 0 ? (
              <span className="font-semibold text-[#2A72E5]">₩{fmt(krwAmount)}</span>
            ) : (
              <span className="text-gray-400">{inputMode === "USDT" ? "위 항목을 입력하면 자동 계산됩니다" : "KRW 금액을 입력하세요"}</span>
            )}
          </div>
        </div>

        {/* 4. 공제대상 가족 수 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {inputMode === "USDT" ? "4" : "3"}. 공제대상 가족 수 (본인 포함)
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
            {inputMode === "USDT" ? "5" : "4"}. 공제대상 가족 중 8세 이상 20세 이하 자녀 수
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

      {/* ── Payslip PDF Section ── */}
      {result && (
        <PayslipSection
          result={result}
          serviceFeeUsdt={parseFloat(usdt)}
          exchangeRate={parseFloat(exchangeRate)}
        />
      )}
    </div>
  );
}


/* ── Payslip Generator Component ── */

function PayslipSection({
  result,
  serviceFeeUsdt,
  exchangeRate,
}: {
  result: TaxResult;
  serviceFeeUsdt: number;
  exchangeRate: number;
}) {
  const [contractorName, setContractorName] = useState("");
  const [erc20Address, setErc20Address] = useState("");
  const [txUrl, setTxUrl] = useState("");
  const [payMonth, setPayMonth] = useState("");
  const [taxPct, setTaxPct] = useState<80 | 100 | 120>(100);
  const [downloading, setDownloading] = useState(false);

  const selectedTax = {
    income: taxPct === 80 ? result.income_tax_80 : taxPct === 120 ? result.income_tax_120 : result.income_tax_100,
    local: taxPct === 80 ? result.local_tax_80 : taxPct === 120 ? result.local_tax_120 : result.local_tax_100,
    total: taxPct === 80 ? result.total_tax_80 : taxPct === 120 ? result.total_tax_120 : result.total_tax_100,
  };

  // Parse month → year, month
  const [pYear, pMonth] = payMonth ? payMonth.split("-").map(Number) : [0, 0];

  // Format date as YYYY-MM-DD in local timezone (not UTC)
  const fmtDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // Last business day calculation (for display)
  const getLastBusinessDay = (y: number, m: number) => {
    if (!y || !m) return "";
    const lastDay = new Date(y, m, 0); // last day of month
    while (lastDay.getDay() === 0 || lastDay.getDay() === 6) {
      lastDay.setDate(lastDay.getDate() - 1);
    }
    return fmtDate(lastDay);
  };

  const periodStart = pYear && pMonth ? `${pYear}-${String(pMonth).padStart(2, "0")}-01` : "";
  const periodEnd = pYear && pMonth ? fmtDate(new Date(pYear, pMonth, 0)) : "";
  const paymentDate = pYear && pMonth ? getLastBusinessDay(pYear, pMonth) : "";

  const canDownload = contractorName.trim() && payMonth && serviceFeeUsdt > 0;

  const handleDownload = async () => {
    if (!canDownload) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/hr/payslip/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractor_name: contractorName,
          erc20_address: erc20Address,
          transaction_url: txUrl,
          payment_year: pYear,
          payment_month: pMonth,
          service_fee_usdt: serviceFeeUsdt,
          exchange_rate: exchangeRate,
          income_tax_krw: selectedTax.income,
          local_tax_krw: selectedTax.local,
          total_tax_krw: selectedTax.total,
          tax_percentage: taxPct,
        }),
      });
      if (!res.ok) throw new Error("PDF 생성 실패");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payslip_${contractorName}_${pYear}${String(pMonth).padStart(2, "0")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("PDF 다운로드에 실패했습니다.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="max-w-2xl mt-8 rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h2 className="font-bold text-lg">📄 Payslip 다운로드</h2>
        <p className="text-sm text-gray-400 mt-1">
          계산 결과를 기반으로 Service Fee Payslip PDF를 생성합니다.
        </p>
      </div>

      <div className="px-6 py-5 space-y-4">
        {/* Contractor name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">지급 대상자명</label>
          <input
            type="text"
            value={contractorName}
            onChange={(e) => setContractorName(e.target.value)}
            placeholder="Full name of contractor"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A72E5]/30 focus:border-[#2A72E5]"
          />
        </div>

        {/* ERC20 Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ERC20 지급 주소</label>
          <input
            type="text"
            value={erc20Address}
            onChange={(e) => setErc20Address(e.target.value)}
            placeholder="0x..."
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2A72E5]/30 focus:border-[#2A72E5]"
          />
        </div>

        {/* Transaction URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Transaction URL</label>
          <input
            type="text"
            value={txUrl}
            onChange={(e) => setTxUrl(e.target.value)}
            placeholder="https://etherscan.io/tx/..."
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A72E5]/30 focus:border-[#2A72E5]"
          />
        </div>

        {/* Payment month */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">지급 월 (Date of Payment / Service Fee 기간)</label>
          <input
            type="month"
            value={payMonth}
            onChange={(e) => setPayMonth(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A72E5]/30 focus:border-[#2A72E5]"
          />
          {payMonth && (
            <div className="mt-2 text-xs text-gray-400 space-y-0.5">
              <p>📅 Date of Payment (마지막 영업일): <span className="font-medium text-gray-600">{paymentDate}</span></p>
              <p>📅 Service Fee 기간: <span className="font-medium text-gray-600">{periodStart} ~ {periodEnd}</span></p>
            </div>
          )}
        </div>

        {/* Tax percentage */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">세액 비율</label>
          <div className="flex gap-2">
            {([80, 100, 120] as const).map((pct) => (
              <button
                key={pct}
                onClick={() => setTaxPct(pct)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  taxPct === pct
                    ? "bg-[#2A72E5] text-white"
                    : "bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100"
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        {/* Preview summary */}
        {payMonth && (
          <div className="rounded-lg bg-gray-50 p-4 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-gray-500">Service Fee (USDT)</span>
              <span className="font-medium">{serviceFeeUsdt.toLocaleString()} USDT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tax Total ({taxPct}%, USDT 환산)</span>
              <span className="font-medium text-red-500">
                {exchangeRate > 0 ? Math.ceil(selectedTax.total / exchangeRate / 10) * 10 : 0} USDT
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-1.5">
              <span className="text-gray-700 font-semibold">Net Service Fee (USDT)</span>
              <span className="font-bold text-[#2A72E5]">
                {exchangeRate > 0 ? serviceFeeUsdt - Math.ceil(selectedTax.total / exchangeRate / 10) * 10 : 0} USDT
              </span>
            </div>
          </div>
        )}

        {/* Download button */}
        <button
          onClick={handleDownload}
          disabled={!canDownload || downloading}
          className={`w-full py-3 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 ${
            canDownload && !downloading
              ? "bg-[#2A72E5] text-white hover:bg-[#1E5FCC]"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          {downloading ? "PDF 생성 중..." : "📥 Payslip PDF 다운로드"}
        </button>
      </div>
    </div>
  );
}
