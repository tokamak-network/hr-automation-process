"use client";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/AuthContext";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface Expense {
  id: number;
  member_id: number;
  name: string | null;       // from LEFT JOIN hr_members
  year: number;
  month: number;
  vendor: string | null;
  description: string | null;
  category: string | null;
  amount_original: number | null;
  currency_original: string | null;
  amount_usdt: number | null;
  amount_usdt_estimate: number | null;
  amount_usdt_confirmed: number | null;
  evidence_status: string | null;
  evidence_ref: string | null;
  flags: string | null;
  status: string;
  decided_by: string | null;
  decided_at: string | null;
  expense_date: string | null;
}

const fmt = (n: number | null | undefined) =>
  n != null ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-";

const statusBadge: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  hold: "bg-red-100 text-red-700",
  more_docs: "bg-orange-100 text-orange-700",
};

const statusLabel: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  paid: "Paid",
  hold: "Hold",
  more_docs: "More Docs",
};

const evidenceBadge: Record<string, string> = {
  complete: "bg-green-50 text-green-600",
  incomplete: "bg-gray-100 text-gray-500",
};

const now = new Date();

export default function ExpenseDecisionsPage() {
  const { user } = useAuth();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState<{ id: number; label: string } | null>(null);
  const [paymentDate, setPaymentDate] = useState(now.toISOString().split("T")[0]);
  const [actionLoading, setActionLoading] = useState(false);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(user?.email ? { "X-User-Email": user.email } : {}),
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/hr/expenses?year=${year}&month=${month}`, { headers });
      if (res.ok) setExpenses(await res.json());
      else setExpenses([]);
    } catch {
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [year, month, user]);

  // Split: actionable (pending + hold + more_docs) vs decided (approved + paid)
  const actionable = useMemo(() => expenses.filter((e) => ["pending", "hold", "more_docs"].includes(e.status)), [expenses]);
  const decided = useMemo(() => expenses.filter((e) => ["approved", "paid"].includes(e.status)), [expenses]);

  const handleDecision = async (id: number, decision: string, payDate?: string) => {
    setActionLoading(true);
    try {
      await fetch(`${API}/api/hr/expenses/${id}/decision`, {
        method: "POST",
        headers,
        body: JSON.stringify({ decision, payment_date: payDate }),
      });
      setPayModal(null);
      fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  const displayName = (e: Expense) => {
    if (e.flags?.includes("매핑실패")) return `[unmapped] member_id=${e.member_id}`;
    return e.name || `member #${e.member_id}`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expense Decisions</h1>
          <p className="text-sm text-gray-500 mt-1">Operator console — review and approve expense claims</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="border rounded-lg px-2 py-1.5 text-sm">
            {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="border rounded-lg px-2 py-1.5 text-sm">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}月</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading...</div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-20 text-gray-400">No expenses for {year}-{String(month).padStart(2, "0")}</div>
      ) : (
        <>
          {/* Actionable — pending / hold / more_docs */}
          {actionable.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Needs Action ({actionable.length})
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Vendor</th>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3 text-right">Original</th>
                      <th className="px-4 py-3 text-right">Est. USDT</th>
                      <th className="px-4 py-3">Evidence</th>
                      <th className="px-4 py-3">Flags</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actionable.map((e) => (
                      <tr key={e.id} className={`border-b hover:bg-gray-50 ${e.flags?.includes("매핑실패") ? "bg-red-50" : ""}`}>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[e.status] || ""}`}>
                            {statusLabel[e.status] || e.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium">{displayName(e)}</td>
                        <td className="px-4 py-3 text-gray-600">{e.vendor || "-"}</td>
                        <td className="px-4 py-3 text-gray-600">{e.description || "-"}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          {e.amount_original != null ? fmt(e.amount_original) : "-"}{" "}
                          <span className="text-xs text-gray-400">{e.currency_original || ""}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{fmt(e.amount_usdt_estimate)}</td>
                        <td className="px-4 py-3">
                          {e.evidence_status && (
                            <span className={`px-2 py-0.5 rounded-full text-xs ${evidenceBadge[e.evidence_status] || evidenceBadge.incomplete}`}>
                              {e.evidence_status}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {e.flags ? (
                            <span className="text-xs text-red-600 font-medium bg-red-50 px-1.5 py-0.5 rounded">{e.flags}</span>
                          ) : "-"}
                        </td>
                        <td className="px-4 py-3 text-right space-x-1">
                          <button onClick={() => setPayModal({ id: e.id, label: displayName(e) })}
                            className="px-2 py-1 text-xs font-medium text-white bg-green-500 rounded hover:bg-green-600" disabled={actionLoading}>Pay</button>
                          <button onClick={() => handleDecision(e.id, "hold")}
                            className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100" disabled={actionLoading}>Hold</button>
                          <button onClick={() => handleDecision(e.id, "more_docs")}
                            className="px-2 py-1 text-xs font-medium text-orange-600 bg-orange-50 rounded hover:bg-orange-100" disabled={actionLoading}>More Docs</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Decided — approved / paid */}
          {decided.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Decided ({decided.length})
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Vendor / Item</th>
                      <th className="px-4 py-3 text-right">Original</th>
                      <th className="px-4 py-3 text-right">Confirmed USDT</th>
                      <th className="px-4 py-3">Payment Date</th>
                      <th className="px-4 py-3">Decided By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decided.map((e) => (
                      <tr key={e.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[e.status] || ""}`}>
                            {statusLabel[e.status] || e.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium">{displayName(e)}</td>
                        <td className="px-4 py-3 text-gray-600">{[e.vendor, e.description].filter(Boolean).join(" / ") || "-"}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          {e.amount_original != null ? fmt(e.amount_original) : fmt(e.amount_usdt)}{" "}
                          <span className="text-xs text-gray-400">{e.currency_original || "USDT"}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold">{fmt(e.amount_usdt_confirmed ?? e.amount_usdt)}</td>
                        <td className="px-4 py-3 text-gray-500">{e.expense_date || "-"}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{e.decided_by || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Pay Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setPayModal(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1">Confirm Payment</h3>
            <p className="text-sm text-gray-500 mb-4">
              {payModal.label} — Backend will calculate confirmed USDT from D-1 exchange rate. No actual payment is made.
            </p>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Payment Date</label>
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setPayModal(null)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
              <button onClick={() => handleDecision(payModal.id, "paid", paymentDate)}
                className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600" disabled={actionLoading}>
                {actionLoading ? "Processing..." : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
