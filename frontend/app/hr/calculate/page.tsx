"use client";
import { useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(Math.round(n));
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

interface CalcResult {
  name: string; usdt_amount: number; krw_rate: number; krw_amount: number;
  income_tax: number; local_tax: number; tax_total: number; net_pay_krw: number;
  dependents: number; children: number;
}

export default function PayrollCalculate() {
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [results, setResults] = useState<CalcResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fileName, setFileName] = useState("");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setUploading(true);
    setSaved(false);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/hr/calculate/preview", { method: "POST", body: formData });
      const data = await res.json();
      setResults(data.results || []);
    } catch { alert("파일 처리에 실패했습니다."); }
    setUploading(false);
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!results.length) return;
    setSaving(true);
    try {
      const res = await fetch("/api/hr/calculate/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, status: "estimated", results }),
      });
      const data = await res.json();
      alert(data.message);
      setSaved(true);
    } catch { alert("저장에 실패했습니다."); }
    setSaving(false);
  };

  const handleDownloadTemplate = () => {
    window.open("/api/hr/calculate/template", "_blank");
  };

  const totalUsdt = results.reduce((s, r) => s + r.usdt_amount, 0);
  const totalKrw = results.reduce((s, r) => s + r.krw_amount, 0);
  const totalTax = results.reduce((s, r) => s + r.tax_total, 0);
  const totalNet = results.reduce((s, r) => s + r.net_pay_krw, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">급여 계산</h1>
      <p className="text-sm mb-6 text-gray-400">엑셀 업로드로 전 팀원 급여를 일괄 계산합니다</p>

      {/* 설정 + 업로드 */}
      <div className="rounded-xl p-5 mb-6 bg-white border border-gray-200">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">연도</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="px-3 py-2 rounded-lg text-sm border border-gray-300 focus:outline-none focus:border-[#2A72E5]">
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">월</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              className="px-3 py-2 rounded-lg text-sm border border-gray-300 focus:outline-none focus:border-[#2A72E5]">
              {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>{i + 1}월</option>)}
            </select>
          </div>
          <div>
            <button onClick={handleDownloadTemplate}
              className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50">
              계산 양식
            </button>
          </div>
          <div>
            <label className="px-3 py-2 rounded-lg text-sm font-medium text-white bg-[#2A72E5] hover:bg-[#1E5FCC] cursor-pointer inline-block">
              {uploading ? "처리 중..." : "계산 실행"}
              <input type="file" accept=".xlsx,.xls" onChange={handleUpload} className="hidden" disabled={uploading} />
            </label>
          </div>
          {fileName && <span className="text-xs text-gray-400">{fileName}</span>}
        </div>
        <div className="mt-3 text-xs text-gray-400">
          엑셀 컬럼 순서: 이름 | USDT | 환율(KRW/USD) | 부양가족수(기본1) | 8-20세자녀수(기본0)
        </div>
      </div>

      {/* 결과 미리보기 */}
      {results.length > 0 && (
        <div className="rounded-xl overflow-hidden bg-white border border-gray-200 mb-6">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h2 className="font-semibold">{year}년 {month}월 급여 계산 결과 ({results.length}명)</h2>
            <button onClick={handleSave} disabled={saving || saved}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${saved ? "bg-emerald-500" : "bg-[#2A72E5] hover:bg-[#1E5FCC]"} disabled:opacity-60`}>
              {saved ? "저장 완료" : saving ? "저장 중..." : "급여 관리에 반영"}
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-3 text-gray-400">이름</th>
                <th className="text-right p-3 text-gray-400">USDT</th>
                <th className="text-right p-3 text-gray-400">환율</th>
                <th className="text-right p-3 text-gray-400">KRW</th>
                <th className="text-right p-3 text-gray-400">소득세</th>
                <th className="text-right p-3 text-gray-400">지방소득세</th>
                <th className="text-right p-3 text-gray-400">세금 합계 (KRW/USD)</th>
                <th className="text-right p-3 text-gray-400">실지급 (KRW/USD)</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="text-right p-3">{fmt(r.usdt_amount)}</td>
                  <td className="text-right p-3 text-gray-400">{fmt(r.krw_rate)}</td>
                  <td className="text-right p-3">{"\u20A9"}{fmt(r.krw_amount)}</td>
                  <td className="text-right p-3 text-amber-600">{"\u20A9"}{fmt(r.income_tax)}</td>
                  <td className="text-right p-3 text-amber-600">{"\u20A9"}{fmt(r.local_tax)}</td>
                  <td className="text-right p-3 text-amber-600 font-semibold">
                    <div>{"\u20A9"}{fmt(r.tax_total)}</div>
                    <div className="text-xs text-gray-400 font-normal">${r.krw_rate ? fmt(r.tax_total / r.krw_rate) : "-"}</div>
                  </td>
                  <td className="text-right p-3 font-semibold">
                    <div>{"\u20A9"}{fmt(r.net_pay_krw)}</div>
                    <div className="text-xs text-gray-400 font-normal">${r.krw_rate ? fmt(r.net_pay_krw / r.krw_rate) : "-"}</div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 font-semibold">
                <td className="p-3">합계</td>
                <td className="text-right p-3">{fmt(totalUsdt)}</td>
                <td className="p-3"></td>
                <td className="text-right p-3">{"\u20A9"}{fmt(totalKrw)}</td>
                <td className="text-right p-3 text-amber-600">{"\u20A9"}{fmt(results.reduce((s, r) => s + r.income_tax, 0))}</td>
                <td className="text-right p-3 text-amber-600">{"\u20A9"}{fmt(results.reduce((s, r) => s + r.local_tax, 0))}</td>
                <td className="text-right p-3 text-amber-600">
                  <div>{"\u20A9"}{fmt(totalTax)}</div>
                </td>
                <td className="text-right p-3">{"\u20A9"}{fmt(totalNet)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {results.length === 0 && !uploading && (
        <div className="rounded-xl p-12 bg-white border border-gray-200 text-center text-gray-400">
          <div className="text-4xl mb-3">📋</div>
          <p>템플릿을 다운로드하여 급여 데이터를 입력한 후 업로드하세요.</p>
          <p className="text-xs mt-2">업로드하면 세금이 자동 계산되어 미리보기가 표시됩니다.</p>
        </div>
      )}
    </div>
  );
}
