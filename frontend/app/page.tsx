"use client";
import { useEffect, useState } from "react";

const API = "http://localhost:8001";

interface Candidate {
  id: number; name: string; email: string; repo_url: string; status: string;
  scores: Record<string, number> | null; recommendation: string | null; created_at: string;
  reward_amount?: number; reward_token?: string; reward_tx?: string; reward_date?: string;
}

const STATUS_OPTIONS = ["submitted", "analyzed", "hired", "rejected"];
const statusStyle: Record<string, string> = {
  submitted: "bg-gray-100 text-gray-500",
  analyzed: "bg-green-100 text-green-700",
  hired: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-600",
};

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [rewardModal, setRewardModal] = useState<Candidate | null>(null);
  const [rewardForm, setRewardForm] = useState({ amount: 0, token: "TON", tx_hash: "", date: "" });

  const load = () => fetch(`${API}/api/candidates`).then(r => r.json()).then(setCandidates).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const triggerAnalysis = async (id: number) => {
    await fetch(`${API}/api/candidates/${id}/analyze`, { method: "POST" });
    await load();
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}" 후보자를 삭제하시겠습니까?`)) return;
    await fetch(`${API}/api/candidates/${id}`, { method: "DELETE" });
    setCandidates(prev => prev.filter(c => c.id !== id));
  };

  const handleStatusChange = async (id: number, status: string) => {
    await fetch(`${API}/api/candidates/${id}/status`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  };

  const handleRewardSave = async () => {
    if (!rewardModal) return;
    await fetch(`${API}/api/candidates/${rewardModal.id}/reward`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rewardForm),
    });
    setRewardModal(null);
    await load();
  };

  const avgScore = (scores: Record<string, number> | null) => {
    if (!scores) return "-";
    const vals = Object.values(scores);
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  };

  const recColor: Record<string, string> = {
    "Strong Hire": "text-green-700", "Hire": "text-emerald-600", "Maybe": "text-yellow-600", "Pass": "text-red-600"
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Candidates</h1>
      {loading ? <p className="text-gray-400">Loading...</p> : candidates.length === 0 ? (
        <p className="text-gray-400">No candidates yet. <a href="/submit" className="text-[#2A72E5] underline">Submit one</a>.</p>
      ) : (
        <div className="rounded-lg overflow-hidden border border-gray-200">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Avg Score</th>
              <th className="py-3 px-4">Recommendation</th>
              <th className="py-3 px-4">Reward</th>
              <th className="py-3 px-4">Actions</th>
              <th className="py-3 px-4 w-[50px]"></th>
            </tr></thead>
            <tbody>
              {candidates.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition border-b border-gray-200">
                  <td className="py-3 px-4"><a href={`/candidates/${c.id}`} className="text-[#2A72E5] hover:underline">{c.name}</a></td>
                  <td className="py-3 px-4 text-gray-500">{c.email}</td>
                  <td className="py-3 px-4">
                    <select value={c.status} onChange={e => handleStatusChange(c.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded border-0 cursor-pointer ${statusStyle[c.status] || "bg-gray-100 text-gray-500"}`}>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="py-3 px-4">{avgScore(c.scores)}</td>
                  <td className={`py-3 px-4 font-medium ${recColor[c.recommendation || ""] || ""}`}>{c.recommendation || "-"}</td>
                  <td className="py-3 px-4">
                    {c.reward_amount && c.reward_amount > 0 ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-purple-600">{c.reward_amount} {c.reward_token}</span>
                        {c.reward_tx && (
                          <a href={`https://etherscan.io/tx/${c.reward_tx}`} target="_blank" rel="noopener noreferrer"
                            className="text-[10px] text-blue-500 hover:underline">TX</a>
                        )}
                      </div>
                    ) : (
                      <button onClick={() => { setRewardForm({ amount: 0, token: "TON", tx_hash: "", date: "" }); setRewardModal(c); }}
                        className="text-[10px] text-gray-400 hover:text-purple-600">+ 보상</button>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2 items-center">
                      {c.status === "submitted" && <button onClick={() => triggerAnalysis(c.id)} className="text-xs px-3 py-1 rounded font-medium text-white bg-[#1C1C1C] hover:bg-gray-800">Analyze</button>}
                      {c.status !== "submitted" && <a href={`/candidates/${c.id}`} className="text-[#2A72E5] text-xs hover:underline">View</a>}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => handleDelete(c.id, c.name)} className="text-xs text-red-500 hover:underline">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reward Modal */}
      {rewardModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setRewardModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{rewardModal.name} — 보상 기록</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">금액</label>
                  <input type="number" value={rewardForm.amount} onChange={e => setRewardForm({ ...rewardForm, amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="100" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">토큰</label>
                  <select value={rewardForm.token} onChange={e => setRewardForm({ ...rewardForm, token: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="TON">TON (TOKAMAK)</option>
                    <option value="USDT">USDT</option>
                    <option value="ETH">ETH</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">TX Hash</label>
                <input value={rewardForm.tx_hash} onChange={e => setRewardForm({ ...rewardForm, tx_hash: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" placeholder="0x..." />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">지급일</label>
                <input type="date" value={rewardForm.date} onChange={e => setRewardForm({ ...rewardForm, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setRewardModal(null)} className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-300 hover:bg-gray-50">취소</button>
              <button onClick={handleRewardSave}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-700">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
