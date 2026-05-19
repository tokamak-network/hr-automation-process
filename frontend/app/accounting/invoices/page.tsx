"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));

type Tab = "receivable" | "payable";

export default function InvoicesPage() {
  const [tab, setTab] = useState<Tab>("receivable");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ type: "receivable", invoice_no: "", counterparty: "", description: "", amount: 0, currency: "USD", issue_date: "", due_date: "", paid_date: "", status: "pending", fx_rate: 0, sgd_amount: 0, note: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    fetch(`/api/accounting/invoices?type=${tab}`).then(r => r.json()).then(setInvoices);
    fetch("/api/accounting/invoices/summary").then(r => r.json()).then(setSummary);
  };
  useEffect(() => { load(); }, [tab]);

  const handleSave = async () => {
    if (editingId) {
      await fetch(`/api/accounting/invoices/${editingId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    } else {
      await fetch("/api/accounting/invoices", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, type: tab }) });
    }
    setShowForm(false); setEditingId(null); await load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`/api/accounting/invoices/${id}`, { method: "DELETE" });
    await load();
  };

  const startEdit = (inv: any) => {
    setForm({ ...inv }); setEditingId(inv.id); setShowForm(true);
  };

  const tabStyle = (t: Tab) => tab === t ? "bg-[#2A72E5] text-white" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50";

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">인보이스</h1>
          <p className="text-sm text-gray-400">매출(AR) / 매입(AP) 인보이스 관리</p>
        </div>
        <div className="flex gap-2">
          <label className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#2A72E5] hover:bg-[#1E5FCC] cursor-pointer">
            {uploading ? "업로드 중..." : "PDF 업로드"}
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              setUploading(true);
              const fd = new FormData();
              fd.append("file", file);
              fd.append("type", tab);
              // Extract info from filename if possible
              const name = file.name.replace(/\.[^.]+$/, "");
              fd.append("description", name);
              fd.append("status", "pending");
              try {
                const res = await fetch("/api/accounting/invoices/upload", { method: "POST", body: fd });
                const data = await res.json();
                alert(data.message);
                await load();
              } catch { alert("업로드 실패"); }
              setUploading(false);
              e.target.value = "";
            }} className="hidden" disabled={uploading} />
          </label>
          <button onClick={() => { setForm({ type: tab, invoice_no: "", counterparty: "", description: "", amount: 0, currency: "USD", issue_date: "", due_date: "", paid_date: "", status: "pending", fx_rate: 0, sgd_amount: 0, note: "" }); setEditingId(null); setShowForm(true); }}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50">
            + 수동 입력
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab("receivable")} className={`px-4 py-2 rounded-lg text-sm font-medium ${tabStyle("receivable")}`}>
          매출 (AR) {summary ? `· ${summary.receivable.count}건` : ""}
        </button>
        <button onClick={() => setTab("payable")} className={`px-4 py-2 rounded-lg text-sm font-medium ${tabStyle("payable")}`}>
          매입 (AP) {summary ? `· ${summary.payable.count}건` : ""}
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl p-4 bg-white border border-gray-200">
            <div className="text-xs text-gray-400 mb-1">매출 (AR)</div>
            <div className="text-lg font-bold text-emerald-600">{fmt(summary.receivable.total)} USD</div>
            <div className="text-xs text-gray-400">{summary.receivable.count}건</div>
          </div>
          <div className="rounded-xl p-4 bg-white border border-gray-200">
            <div className="text-xs text-gray-400 mb-1">매입 (AP)</div>
            <div className="text-lg font-bold text-red-500">{fmt(summary.payable.total)} USD</div>
            <div className="text-xs text-gray-400">{summary.payable.count}건</div>
          </div>
          <div className="rounded-xl p-4 bg-white border border-gray-200">
            <div className="text-xs text-gray-400 mb-1">미수금 (Outstanding AR)</div>
            <div className="text-lg font-bold text-amber-500">{fmt(summary.outstanding_ar.total)} USD</div>
            <div className="text-xs text-gray-400">{summary.outstanding_ar.count}건</div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl overflow-hidden bg-white border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-3 text-gray-400">Invoice No.</th>
              <th className="text-left p-3 text-gray-400">거래상대</th>
              <th className="text-left p-3 text-gray-400">내용</th>
              <th className="text-right p-3 text-gray-400">금액</th>
              <th className="text-left p-3 text-gray-400">발행일</th>
              <th className="text-left p-3 text-gray-400">입금/지급일</th>
              <th className="text-center p-3 text-gray-400">파일</th>
              <th className="text-center p-3 text-gray-400">상태</th>
              <th className="text-right p-3 text-gray-400"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="p-3 font-mono text-xs">{inv.invoice_no || "-"}</td>
                <td className="p-3 text-xs text-gray-700">{inv.counterparty}</td>
                <td className="p-3 text-xs text-gray-500 max-w-[200px] truncate" title={inv.description}>{inv.description || "-"}</td>
                <td className="text-right p-3 font-semibold text-xs">{fmt(inv.amount)} {inv.currency}</td>
                <td className="p-3 text-xs text-gray-500">{inv.issue_date || "-"}</td>
                <td className="p-3 text-xs text-gray-500">{inv.paid_date || "-"}</td>
                <td className="text-center p-3">
                  {inv.file_url ? (
                    <a href={inv.file_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline">PDF</a>
                  ) : <span className="text-xs text-gray-300">-</span>}
                </td>
                <td className="text-center p-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${inv.status === "paid" ? "bg-emerald-100 text-emerald-700" : inv.status === "overdue" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                    {inv.status === "paid" ? "입금완료" : inv.status === "overdue" ? "연체" : "대기"}
                  </span>
                </td>
                <td className="text-right p-3">
                  <button onClick={() => startEdit(inv)} className="text-xs text-blue-500 hover:underline mr-2">수정</button>
                  <button onClick={() => handleDelete(inv.id)} className="text-xs text-red-500 hover:underline">삭제</button>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr><td colSpan={9} className="py-8 text-center text-gray-400">{tab === "receivable" ? "매출" : "매입"} 인보이스가 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => { setShowForm(false); setEditingId(null); }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editingId ? "인보이스 수정" : `${tab === "receivable" ? "매출(AR)" : "매입(AP)"} 인보이스 추가`}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Invoice No.</label>
                <input value={form.invoice_no} onChange={e => setForm({ ...form, invoice_no: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="INV-2026-001" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">거래상대</label>
                <input value={form.counterparty} onChange={e => setForm({ ...form, counterparty: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="BIT CONSULTANCY" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 mb-1 block">내용</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Monthly consulting fee" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">금액</label>
                <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">통화</label>
                <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="USD">USD</option><option value="SGD">SGD</option><option value="GBP">GBP</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">발행일</label>
                <input type="date" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">만기일</label>
                <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">입금/지급일</label>
                <input type="date" value={form.paid_date} onChange={e => setForm({ ...form, paid_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">상태</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="pending">대기</option><option value="paid">입금완료</option><option value="overdue">연체</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 mb-1 block">메모</label>
                <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="비고" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-300 hover:bg-gray-50">취소</button>
              <button onClick={handleSave} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#2A72E5] hover:bg-[#1E5FCC]">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
