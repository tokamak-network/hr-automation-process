"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export default function FiatPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<any[]>([]);
  const [currency, setCurrency] = useState("");
  const [direction, setDirection] = useState("");
  const [page, setPage] = useState(0);
  const [uploading, setUploading] = useState(false);
  const PAGE_SIZE = 100;

  const load = async (p?: number) => {
    const currentPage = p ?? page;
    const params = new URLSearchParams();
    if (currency) params.set("currency", currency);
    if (direction) params.set("direction", direction);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(currentPage * PAGE_SIZE));
    const res = await fetch(`/api/hr/fiat?${params}`);
    const data = await res.json();
    setTransactions(data.transactions || []);
    setTotal(data.total || 0);
  };

  const loadSummary = async () => {
    const res = await fetch("/api/hr/fiat/summary");
    setSummary(await res.json());
  };

  useEffect(() => { load(0); setPage(0); }, [currency, direction]);
  useEffect(() => { load(page); }, [page]);
  useEffect(() => { loadSummary(); }, []);

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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">법인 입출금</h1>
      <p className="text-sm mb-6 text-gray-400">WISE / Aspire 법인통장 입출금 내역 (관리자 전용)</p>

      {/* Summary Cards */}
      {summary.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {["USD", "SGD", "GBP", "KRW"].map(cur => {
            const inAmt = summary.find(s => s.currency === cur && s.direction === "IN")?.total_amount || 0;
            const outAmt = summary.find(s => s.currency === cur && (s.direction === "OUT" || s.direction === "NEUTRAL"))?.total_amount || 0;
            const inCnt = summary.find(s => s.currency === cur && s.direction === "IN")?.count || 0;
            const outCnt = summary.find(s => s.currency === cur && (s.direction === "OUT" || s.direction === "NEUTRAL"))?.count || 0;
            if (!inCnt && !outCnt) return null;
            return (
              <div key={cur} className="rounded-xl p-4 bg-white border border-gray-200">
                <div className="text-xs text-gray-400 mb-1">{cur}</div>
                <div className="text-sm text-emerald-600">+{fmt(Math.abs(inAmt))} ({inCnt})</div>
                <div className="text-sm text-red-500">-{fmt(Math.abs(outAmt))} ({outCnt})</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload + Filters */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <select value={currency} onChange={e => setCurrency(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm border border-gray-300">
            <option value="">전체 통화</option>
            <option value="USD">USD</option>
            <option value="SGD">SGD</option>
            <option value="GBP">GBP</option>
          </select>
          <select value={direction} onChange={e => setDirection(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm border border-gray-300">
            <option value="">전체 방향</option>
            <option value="IN">입금</option>
            <option value="OUT">출금</option>
          </select>
          <span className="text-sm text-gray-500">{total}건 (page {page + 1}/{totalPages})</span>
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
              <tr><td colSpan={9} className="py-8 text-center text-gray-400">입출금 내역이 없습니다. WISE CSV 또는 Aspire Excel을 업로드하세요.</td></tr>
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
