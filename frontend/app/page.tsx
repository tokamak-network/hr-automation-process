"use client";
import { useEffect, useState } from "react";

const API = "http://localhost:8001";

interface Candidate {
  id: number; name: string; email: string; repo_url: string; status: string;
  scores: Record<string, number> | null; recommendation: string | null; created_at: string;
  reward_amount?: number; reward_token?: string; reward_tx?: string; reward_date?: string;
  reviewer?: string; review_comment?: string; result_shared?: number; source?: string;
}

interface IntakeItem {
  id: number; sender_email: string; sender_name: string | null;
  repo_url: string | null; wallet_address: string | null; status: string;
  source_email_ids: string[]; first_detected_at: string | null;
  registered_candidate_id: number | null;
  ready_to_register: boolean; hold_reasons: string[];
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
  const [expandedComment, setExpandedComment] = useState<number | null>(null);
  const [rewardForm, setRewardForm] = useState({ amount: 0, token: "TON", tx_hash: "", date: "" });
  const [editingReview, setEditingReview] = useState<number | null>(null);
  const [reviewForm, setReviewForm] = useState({ reviewer: "", comment: "" });

  const load = () => fetch(`${API}/api/candidates`).then(r => r.json()).then(setCandidates).catch(() => {}).finally(() => setLoading(false));

  // C-1 §6: 감지됨(검토 대기) 목록
  const [intake, setIntake] = useState<IntakeItem[]>([]);
  const [scanning, setScanning] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const loadIntake = () => fetch(`${API}/api/candidates/intake`).then(r => r.json()).then(setIntake).catch(() => {});

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch(`${API}/api/candidates/scan-inbox`, { method: "POST" });
      const d = await res.json();
      await loadIntake();
      const found = (d.created || 0) + (d.updated || 0);
      alert(`스캔 완료 — 스캔 ${d.scanned_messages ?? 0}통 / 신규 ${d.created ?? 0} · 보강 ${d.updated ?? 0}건.\n${found > 0 ? "감지된 건은 아래 '감지됨(검토 대기)'에서 승인하세요." : "새 지원 없음."}`);
    } catch { alert("스캔 실패"); }
    setScanning(false);
  };

  const handleApprove = async (item: IntakeItem) => {
    setApprovingId(item.id);
    try {
      const res = await fetch(`${API}/api/candidates/intake/${item.id}/approve`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        const reasons = d?.detail?.hold_reasons?.join(", ") || d?.detail?.message || d?.detail || "등록 보류";
        alert(`등록 보류 — ${reasons}`);
      } else if (d.status === "submitted") {
        alert(`등록 완료 — ${item.sender_name || item.sender_email} → Candidates (source=email_auto)`);
      } else if (d.status === "duplicate_skipped" || d.status === "already_registered") {
        alert(`이미 등록됨 (candidate #${d.candidate_id}) — 재등록하지 않음`);
      }
      await Promise.all([loadIntake(), load()]);
    } catch { alert("승인 처리 실패"); }
    setApprovingId(null);
  };

  const handleDeleteIntake = async (item: IntakeItem) => {
    if (!confirm(`감지된 "${item.sender_name || item.sender_email}" 건을 목록에서 삭제할까요?\n(감지 목록에서만 지웁니다. 등록된 후보는 영향 없음)`)) return;
    setApprovingId(item.id);
    try {
      const res = await fetch(`${API}/api/candidates/intake/${item.id}`, { method: "DELETE" });
      if (!res.ok) alert("삭제 실패");
      await loadIntake();
    } catch { alert("삭제 처리 실패"); }
    setApprovingId(null);
  };

  useEffect(() => { load(); loadIntake(); }, []);

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

  const handleReviewSave = async (id: number) => {
    try {
      const res = await fetch(`${API}/api/candidates/${id}/review`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewForm),
      });
      if (!res.ok) throw new Error("Failed");
    } catch (e) {
      alert("리뷰 저장에 실패했습니다.");
      return;
    }
    setEditingReview(null);
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

  const [benchmarkStatus, setBenchmarkStatus] = useState<any>(null);
  const [refreshingBenchmark, setRefreshingBenchmark] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/benchmark/latest`).then(r => r.json()).then(setBenchmarkStatus).catch(() => {});
  }, []);

  const handleRefreshBenchmark = async () => {
    setRefreshingBenchmark(true);
    try {
      const res = await fetch(`${API}/api/benchmark/refresh`, { method: "POST" });
      const data = await res.json();
      setBenchmarkStatus({ ...data, exists: true });
      alert(`벤치마크 갱신 완료: ${data.repo_count}개 레포 분석`);
    } catch { alert("벤치마크 갱신 실패"); }
    setRefreshingBenchmark(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Candidates</h1>
        <div className="flex items-center gap-3">
          {benchmarkStatus?.exists && (
            <span className="text-xs text-gray-400">
              Benchmark: {benchmarkStatus.repo_count} repos · {benchmarkStatus.created_at?.slice(0, 10)}
            </span>
          )}
          <button onClick={handleScan} disabled={scanning}
            className="text-xs px-3 py-1.5 rounded-lg bg-[#2A72E5] text-white hover:bg-[#1E5FCC] disabled:opacity-50">
            {scanning ? "확인 중..." : "새 지원 확인"}
          </button>
          <button onClick={handleRefreshBenchmark} disabled={refreshingBenchmark}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            {refreshingBenchmark ? "분석 중..." : benchmarkStatus?.exists ? "Benchmark 갱신" : "Benchmark 생성"}
          </button>
        </div>
      </div>

      {/* C-1 §6: 감지됨(검토 대기) 섹션 — GET /api/candidates/intake */}
      {intake.filter(i => !i.registered_candidate_id).length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-bold text-gray-700">감지됨 (검토 대기)</h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {intake.filter(i => !i.registered_candidate_id).length}
            </span>
            <span className="text-xs text-gray-400">hr@ 자동 감지 · 승인 시에만 Candidates 등록</span>
          </div>
          <div className="rounded-lg overflow-hidden border border-amber-200">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500 border-b border-amber-200 bg-amber-50">
                <th className="py-2 px-3">발신자</th>
                <th className="py-2 px-3">Repo</th>
                <th className="py-2 px-3">지갑</th>
                <th className="py-2 px-3">감지일</th>
                <th className="py-2 px-3">상태 / 사유</th>
                <th className="py-2 px-3 text-right">승인</th>
              </tr></thead>
              <tbody>
                {intake.filter(i => !i.registered_candidate_id).map(i => (
                  <tr key={i.id} className="border-b border-amber-100 hover:bg-amber-50/40">
                    <td className="py-2 px-3">
                      <div className="font-medium text-gray-800">{i.sender_name || "—"}</div>
                      <div className="text-[11px] text-gray-500">{i.sender_email}</div>
                    </td>
                    <td className="py-2 px-3 text-xs">
                      {i.repo_url ? (
                        <a href={i.repo_url} target="_blank" rel="noreferrer" className="text-[#2A72E5] hover:underline">
                          {i.repo_url.replace("https://github.com/", "")}
                        </a>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-2 px-3 text-xs font-mono">
                      {i.wallet_address
                        ? <span title={i.wallet_address}>{i.wallet_address.slice(0, 6)}…{i.wallet_address.slice(-4)}</span>
                        : <span className="text-amber-600">대기</span>}
                    </td>
                    <td className="py-2 px-3 text-xs text-gray-500">{i.first_detected_at?.slice(0, 10) || "—"}</td>
                    <td className="py-2 px-3 text-xs">
                      {i.ready_to_register
                        ? <span className="text-green-700">등록 가능</span>
                        : <span className="text-amber-600">{i.hold_reasons.join(", ")}</span>}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleApprove(i)}
                        disabled={!i.ready_to_register || approvingId === i.id}
                        title={i.ready_to_register ? "Candidates에 등록" : i.hold_reasons.join(", ")}
                        className="text-xs px-2.5 py-1 rounded font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed">
                        {approvingId === i.id ? "등록 중..." : "등록 승인"}
                      </button>
                      <button
                        onClick={() => handleDeleteIntake(i)}
                        disabled={approvingId === i.id}
                        title="감지 목록에서 삭제 (등록된 후보는 영향 없음)"
                        className="ml-1.5 text-xs px-2 py-1 rounded border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {loading ? <p className="text-gray-400">Loading...</p> : candidates.length === 0 ? (
        <p className="text-gray-400">No candidates yet. <a href="/submit" className="text-[#2A72E5] underline">Submit one</a>.</p>
      ) : (
        <div className="rounded-lg overflow-hidden border border-gray-200">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
              <th className="py-2 px-3">Name</th>
              <th className="py-2 px-3">Email</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3">Score</th>
              <th className="py-2 px-3">Rec.</th>
              <th className="py-2 px-3">Reviewer</th>
              <th className="py-2 px-3">Comment</th>
              <th className="py-2 px-3">Reward</th>
              <th className="py-2 px-3 text-right"></th>
            </tr></thead>
            <tbody>
              {candidates.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition border-b border-gray-200">
                  <td className="py-2 px-3">
                    <a href={`/candidates/${c.id}`} className="text-[#2A72E5] hover:underline whitespace-nowrap">{c.name}</a>
                    {c.source === "email_auto" && (
                      <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-blue-50 text-blue-600 align-middle" title="hr@ 메일에서 자동 감지·승인 등록">auto</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-gray-500 text-xs">{c.email}</td>
                  <td className="py-2 px-3">
                    <select value={c.status} onChange={e => handleStatusChange(c.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded border-0 cursor-pointer ${statusStyle[c.status] || "bg-gray-100 text-gray-500"}`}>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="py-2 px-3">{avgScore(c.scores)}</td>
                  <td className={`py-2 px-3 text-xs font-medium ${recColor[c.recommendation || ""] || ""}`}>{c.recommendation || "-"}</td>
                  <td className="py-2 px-3 text-xs text-gray-600">
                    {editingReview === c.id ? (
                      <input value={reviewForm.reviewer} onChange={e => setReviewForm({ ...reviewForm, reviewer: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs" placeholder="리뷰어" />
                    ) : (
                      <span className="cursor-pointer hover:text-[#2A72E5]" onClick={() => { setReviewForm({ reviewer: c.reviewer || "", comment: c.review_comment || "" }); setEditingReview(c.id); }}>
                        {c.reviewer || <span className="text-gray-300">+ 리뷰어</span>}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-xs text-gray-500 max-w-[180px]">
                    {editingReview === c.id ? (
                      <div className="flex flex-col gap-1">
                        <textarea value={reviewForm.comment} onChange={e => setReviewForm({ ...reviewForm, comment: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs resize-none" rows={2} placeholder="코멘트" />
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => setEditingReview(null)} className="text-[10px] text-gray-400 hover:text-gray-600 px-2 py-0.5">취소</button>
                          <button onClick={() => handleReviewSave(c.id)} className="text-[10px] text-white bg-[#2A72E5] hover:bg-[#1E5FCC] px-2 py-0.5 rounded">저장</button>
                        </div>
                      </div>
                    ) : (
                      c.review_comment ? (
                        <div
                          className="cursor-pointer hover:text-[#2A72E5] line-clamp-2"
                          onClick={() => { setReviewForm({ reviewer: c.reviewer || "", comment: c.review_comment || "" }); setEditingReview(c.id); }}
                        >{c.review_comment}</div>
                      ) : (
                        <span className="text-gray-300 cursor-pointer hover:text-[#2A72E5]" onClick={() => { setReviewForm({ reviewer: c.reviewer || "", comment: "" }); setEditingReview(c.id); }}>+ 코멘트</span>
                      )
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <button onClick={() => {
                      setRewardForm({
                        amount: c.reward_amount || 0,
                        token: c.reward_token || "TON",
                        tx_hash: c.reward_tx || "",
                        date: c.reward_date || "",
                      });
                      setRewardModal(c);
                    }} className="text-left hover:opacity-70">
                      {c.reward_amount && c.reward_amount > 0 ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium text-purple-600">{c.reward_amount} {c.reward_token}</span>
                          {c.reward_tx && <span className="text-[10px] text-blue-500">TX</span>}
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400">+ 보상</span>
                      )}
                    </button>
                  </td>
                  <td className="py-2 px-3 text-right whitespace-nowrap">
                    <div className="flex gap-1.5 items-center justify-end">
                      {c.status === "submitted" && <button onClick={() => triggerAnalysis(c.id)} className="text-xs px-2 py-0.5 rounded font-medium text-white bg-[#1C1C1C] hover:bg-gray-800">Analyze</button>}
                      {c.status !== "submitted" && (
                        <button onClick={() => { if (confirm(`${c.name}을(를) 재분석하시겠습니까?`)) triggerAnalysis(c.id); }}
                          className="text-[10px] px-1.5 py-0.5 rounded border border-gray-300 text-gray-400 hover:bg-gray-50">재분석</button>
                      )}
                      <button onClick={() => handleDelete(c.id, c.name)} className="text-[10px] text-red-400 hover:text-red-600">삭제</button>
                    </div>
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
