"use client";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/AuthContext";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface Expense {
  id: number;
  period: string;
  submitter: string;
  vendor: string | null;
  item: string | null;
  reason: string | null;
  amount_original: number;
  currency_original: string;
  amount_usd_estimate: number | null;
  amount_usd_confirmed: number | null;
  evidence_status: string;
  flags: string | null;
  decision: string;
  decided_by: string | null;
  decided_at: string | null;
  payment_date: string | null;
}

interface Summary {
  submitter: string;
  count: number;
  total_usd_confirmed: number;
  pending_count: number;
  paid_count: number;
  hold_count: number;
}

const fmt = (n: number | null) => n != null ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-";

const decisionBadge: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  paid: "bg-green-100 text-green-700",
  hold: "bg-red-100 text-red-700",
  more_docs: "bg-orange-100 text-orange-700",
};

const evidenceBadge: Record<string, string> = {
  complete: "bg-green-50 text-green-600",
  incomplete: "bg-gray-100 text-gray-500",
};

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ExpenseDecisionsPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState(currentPeriod());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState<{ id: number; submitter: string } | null>(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [actionLoading, setActionLoading] = useState(false);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(user?.email ? { "X-User-Email": user.email } : {}),
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [expRes, sumRes] = await Promise.all([
        fetch(`${API}/api/expenses?period=${period}`, { headers }),
        fetch(`${API}/api/expenses/summary?period=${period}`, { headers }),
      ]);
      if (expRes.ok) setExpenses(await expRes.json());
      else setExpenses([]);
      if (sumRes.ok) setSummary(await sumRes.json());
      else setSummary([]);
    } catch {
      setExpenses([]);
      setSummary([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [period, user]);

  const pendingExpenses = useMemo(() => expenses.filter((e) => e.decision === "pending"), [expenses]);
  const decidedExpenses = useMemo(() => expenses.filter((e) => e.decision !== "pending"), [expenses]);

  const handleDecision = async (id: number, decision: string, payDate?: string) => {
    setActionLoading(true);
    try {
      await fetch(`${API}/api/expenses/${id}/decision`, {
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expense Decisions</h1>
          <p className="text-sm text-gray-500 mt-1">Operator console — review and approve expense claims</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Period</label>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {/* Summary Cards */}
      {summary.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {summary.map((s) => (
            <div key={s.submitter} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-sm font-medium text-gray-900">{s.submitter}</div>
              <div className="text-xs text-gray-400 mt-1">
                {s.pending_count} pending / {s.paid_count} paid / {s.hold_count} hold
              </div>
              <div className="text-lg font-bold text-[#2A72E5] mt-1">
                ${fmt(s.total_usd_confirmed)} <span className="text-xs font-normal text-gray-400">confirmed</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading...</div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-20 text-gray-400">No expenses for {period}</div>
      ) : (
        <>
          {/* Pending — needs action */}
          {pendingExpenses.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Pending ({pendingExpenses.length})
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3">Submitter</th>
                      <th className="px-4 py-3">Vendor</th>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3 text-right">Original</th>
                      <th className="px-4 py-3 text-right">Est. USD</th>
                      <th className="px-4 py-3">Evidence</th>
                      <th className="px-4 py-3">Flags</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingExpenses.map((e) => (
                      <tr key={e.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{e.submitter}</td>
                        <td className="px-4 py-3 text-gray-600">{e.vendor || "-"}</td>
                        <td className="px-4 py-3 text-gray-600">{e.item || "-"}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          {fmt(e.amount_original)} <span className="text-xs text-gray-400">{e.currency_original}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">${fmt(e.amount_usd_estimate)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${evidenceBadge[e.evidence_status] || evidenceBadge.incomplete}`}>
                            {e.evidence_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-red-500">{e.flags || "-"}</td>
                        <td className="px-4 py-3 text-right space-x-1">
                          <button
                            onClick={() => setPayModal({ id: e.id, submitter: e.submitter })}
                            className="px-2 py-1 text-xs font-medium text-white bg-green-500 rounded hover:bg-green-600"
                            disabled={actionLoading}
                          >Pay</button>
                          <button
                            onClick={() => handleDecision(e.id, "hold")}
                            className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100"
                            disabled={actionLoading}
                          >Hold</button>
                          <button
                            onClick={() => handleDecision(e.id, "more_docs")}
                            className="px-2 py-1 text-xs font-medium text-orange-600 bg-orange-50 rounded hover:bg-orange-100"
                            disabled={actionLoading}
                          >More Docs</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Decided */}
          {decidedExpenses.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Decided ({decidedExpenses.length})
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Submitter</th>
                      <th className="px-4 py-3">Vendor / Item</th>
                      <th className="px-4 py-3 text-right">Original</th>
                      <th className="px-4 py-3 text-right">Confirmed USD</th>
                      <th className="px-4 py-3">Payment Date</th>
                      <th className="px-4 py-3">Decided By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decidedExpenses.map((e) => (
                      <tr key={e.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${decisionBadge[e.decision] || ""}`}>
                            {e.decision}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium">{e.submitter}</td>
                        <td className="px-4 py-3 text-gray-600">{[e.vendor, e.item].filter(Boolean).join(" / ") || "-"}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          {fmt(e.amount_original)} <span className="text-xs text-gray-400">{e.currency_original}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold">${fmt(e.amount_usd_confirmed)}</td>
                        <td className="px-4 py-3 text-gray-500">{e.payment_date || "-"}</td>
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

      {/* Pay Modal — payment_date input */}
      {payModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setPayModal(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1">Confirm Payment</h3>
            <p className="text-sm text-gray-500 mb-4">
              {payModal.submitter} — Backend will calculate confirmed USD from D-1 exchange rate. No actual payment is made.
            </p>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setPayModal(null)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
              <button
                onClick={() => handleDecision(payModal.id, "paid", paymentDate)}
                className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600"
                disabled={actionLoading}
              >
                {actionLoading ? "Processing..." : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
