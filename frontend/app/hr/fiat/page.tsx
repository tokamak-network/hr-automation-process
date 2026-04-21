"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

export default function FiatPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<any[]>([]);
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState<number | null>(null);
  const [currency, setCurrency] = useState("");
  const [source, setSource] = useState("");
  const [direction, setDirection] = useState("");
  const [page, setPage] = useState(0);
  const [uploading, setUploading] = useState(false);
  const PAGE_SIZE = 100;

  const buildParams = (p?: number) => {
    const params = new URLSearchParams();
    if (currency) params.set("currency", currency);
    if (direction) params.set("direction", direction);
    if (source) params.set("source", source);
    params.set("year", String(year));
    if (month) params.set("month", String(month));
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String((p ?? page) * PAGE_SIZE));
    return params;
  };

  const load = async (p?: number) => {
    const res = await fetch(`/api/hr/fiat?${buildParams(p)}`);
    const data = await res.json();
    setTransactions(data.transactions || []);
    setTotal(data.total || 0);
  };

  const loadSummary = async () => {
    const params = new URLSearchParams();
    params.set("year", String(year));
    if (month) params.set("month", String(month));
    if (source) params.set("source", source);
    const res = await fetch(`/api/hr/fiat/summary?${params}`);
    setSummary(await res.json());
  };

  useEffect(() => { setPage(0); load(0); loadSummary(); }, [year, month, currency, direction, source]);
  useEffect(() => { load(page); }, [page]);

  const handleUpload = async (type: "wise" | "aspire", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const endpoint = type === "wise" ? "/api/hr/fiat/upload-wise" : "/api/hr/fiat/upload-aspire";
    try {
      const res = await fetch(endpoint, { method: "POST", body: formData });
      const data = await res.json();
      alert(data.message);
      await load(0); setPage(0); await loadSummary();
    } catch { alert("업로드 실패"); }
    setUploading(false);
    e.target.value = "";
  };

  const handleDelete = async (id: number) => {
    if (!confirm("이 내역을 삭제하시겠습니까?")) return;
    await fetch(`/api/hr/fiat/${id}`, { method: "DELETE" });
    await load(); await loadSummary();
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currencies = ["USD", "SGD", "GBP"];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">법인 입출금</h1>
          <p className="text-sm text-gray-400">WISE / Aspire 법인통장 입출금 내역 (관리자 전용)</p>
        </div>
        <div className="flex gap-2">
          <label className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer">
            {uploading ? "업로드 중..." : "WISE CSV"}
            <input type="file" accept=".csv" onChange={e => handleUpload("wise", e)} className="hidden" disabled={uploading} />
          </label>
          <label className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer">
            {uploading ? "업로드 중..." : "Aspire Excel"}
            <input type="file" accept=".xlsx,.xls" onChange={e => handleUpload("aspire", e)} className="hidden" disabled={uploading} />
          </label>
        </div>
      </div>

      {/* 연도 + 월 선택 */}
      <div className="flex items-center gap-4 mb-4">
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="px-3 py-1.5 rounded-lg text-sm border border-gray-300">
          {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
        <div className="flex gap-1">
          <button onClick={() => setMonth(null)}
            className={`px-3 py-1.5 rounded text-xs font-medium ${!month ? "bg-[#2A72E5] text-white" : "bg-gray-50 text-gray-400 hover:bg-gray-100"}`}>
            전체
          </button>
          {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
            <button key={m} onClick={() => setMonth(m)}
              className={`px-3 py-1.5 rounded text-xs font-medium ${m === month ? "bg-[#2A72E5] text-white" : "bg-gray-50 text-gray-400 hover:bg-gray-100"}`}>
              {m}월
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards - 선택 기간 기준 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {currencies.map(cur => {
          const inData = summary.find(s => s.currency === cur && s.direction === "IN");
          const outData = summary.find(s => s.currency === cur && (s.direction === "OUT" || s.direction === "NEUTRAL"));
          const inAmt = inData?.total_amount || 0;
          const outAmt = outData?.total_amount || 0;
          const inCnt = inData?.count || 0;
          const outCnt = outData?.count || 0;
          return (
            <div key={cur} className={`rounded-xl p-4 bg-white border ${currency === cur ? "border-[#2A72E5] ring-1 ring-[#2A72E5]" : "border-gray-200"} cursor-pointer hover:shadow-sm transition`}
              onClick={() => setCurrency(currency === cur ? "" : cur)}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold">{cur}</span>
                {currency === cur && <span className="text-[10px] text-[#2A72E5]">selected</span>}
              </div>
              <div className="flex justify-between">
                <div>
                  <div className="text-xs text-gray-400">입금</div>
                  <div className="text-sm font-semibold text-emerald-600">+{fmt(Math.abs(inAmt))}</div>
                  <div className="text-[10px] text-gray-400">{inCnt}건</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">출금</div>
                  <div className="text-sm font-semibold text-red-500">-{fmt(Math.abs(outAmt))}</div>
                  <div className="text-[10px] text-gray-400">{outCnt}건</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 추가 필터: 소스 + 방향 + 건수 */}
      <div className="flex items-center gap-3 mb-4">
        <select value={source} onChange={e => setSource(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm border border-gray-300">
          <option value="">전체 소스</option>
          <option value="WISE">WISE</option>
          <option value="Aspire">Aspire</option>
        </select>
        <select value={direction} onChange={e => setDirection(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm border border-gray-300">
          <option value="">전체 방향</option>
          <option value="IN">입금</option>
          <option value="OUT">출금</option>
        </select>
        <span className="text-sm text-gray-500 ml-auto">{total}건 (page {page + 1}/{totalPages})</span>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden bg-white border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-3 text-gray-400">일시</th>
              <th className="text-left p-3 text-gray-400">소스</th>
              <th className="text-left p-3 text-gray-400">방향</th>
              <th className="text-left p-3 text-gray-400">상대방</th>
              <th className="text-right p-3 text-gray-400">금액</th>
              <th className="text-right p-3 text-gray-400">수수료</th>
              <th className="text-right p-3 text-gray-400">총액</th>
              <th className="text-left p-3 text-gray-400">카테고리</th>
              <th className="text-left p-3 text-gray-400">참고</th>
              <th className="text-right p-3 text-gray-400">상태</th>
              <th className="text-right p-3 text-gray-400"></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => (
              <tr key={tx.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="p-3 text-xs text-gray-500">{tx.tx_date?.slice(0, 16)}</td>
                <td className="p-3">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${tx.source === "WISE" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                    {tx.source}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`text-xs font-medium ${tx.direction === "IN" ? "text-emerald-600" : tx.direction === "OUT" ? "text-red-500" : "text-gray-400"}`}>
                    {tx.direction === "IN" ? "입금" : tx.direction === "OUT" ? "출금" : tx.direction}
                  </span>
                </td>
                <td className="p-3 text-xs text-gray-600 max-w-[200px] truncate">{tx.counterparty || "-"}</td>
                <td className={`text-right p-3 font-semibold ${tx.direction === "IN" ? "text-emerald-600" : "text-gray-900"}`}>
                  {tx.direction === "IN" ? "+" : "-"}{fmt(Math.abs(tx.amount))} {tx.currency}
                </td>
                <td className="text-right p-3 text-xs text-amber-600">{tx.fee_amount > 0 ? fmt(tx.fee_amount) : "-"}</td>
                <td className="text-right p-3 text-xs font-medium">{tx.gross_amount > 0 && tx.fee_amount > 0 ? `${fmt(tx.gross_amount)} ${tx.currency}` : "-"}</td>
                <td className="p-3 text-xs text-gray-400">{tx.category || "-"}</td>
                <td className="p-3 text-xs text-gray-400 max-w-[200px] truncate">{tx.reference || tx.note || "-"}</td>
                <td className="text-right p-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${tx.status === "COMPLETED" || tx.status === "completed" ? "bg-emerald-100 text-emerald-700" : tx.status === "CANCELLED" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                    {tx.status}
                  </span>
                </td>
                <td className="text-right p-3">
                  <button onClick={() => handleDelete(tx.id)} className="text-xs text-red-500 hover:underline">삭제</button>
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr><td colSpan={11} className="py-8 text-center text-gray-400">해당 기간의 입출금 내역이 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="px-3 py-1.5 rounded text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-30">
            Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i} onClick={() => setPage(i)}
              className={`px-3 py-1.5 rounded text-sm font-medium ${i === page ? "bg-[#1C1C1C] text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
              {i + 1}
            </button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="px-3 py-1.5 rounded text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-30">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
