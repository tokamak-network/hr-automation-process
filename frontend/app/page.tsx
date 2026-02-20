"use client";
import { useEffect, useState } from "react";

const API = "http://localhost:8001";

interface Candidate {
  id: number; name: string; email: string; repo_url: string; status: string;
  scores: Record<string, number> | null; recommendation: string | null; created_at: string;
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/candidates`).then(r => r.json()).then(setCandidates).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const triggerAnalysis = async (id: number) => {
    await fetch(`${API}/api/candidates/${id}/analyze`, { method: "POST" });
    const updated = await fetch(`${API}/api/candidates`).then(r => r.json());
    setCandidates(updated);
  };

  const avgScore = (scores: Record<string, number> | null) => {
    if (!scores) return "-";
    const vals = Object.values(scores);
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  };

  const recColor: Record<string, string> = {
    "Strong Hire": "text-green-400", "Hire": "text-emerald-400", "Maybe": "text-yellow-400", "Pass": "text-red-400"
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Candidates</h1>
      {loading ? <p style={{ color: "var(--color-text-muted)" }}>Loading...</p> : candidates.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>No candidates yet. <a href="/submit" style={{ color: "var(--color-primary)" }} className="underline">Submit one</a>.</p>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
          <table className="w-full text-sm">
            <thead><tr className="text-left" style={{ color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border)", background: "var(--color-card)" }}>
              <th className="py-3 px-4">Name</th><th className="py-3 px-4">Email</th><th className="py-3 px-4">Status</th><th className="py-3 px-4">Avg Score</th><th className="py-3 px-4">Recommendation</th><th className="py-3 px-4">Actions</th>
            </tr></thead>
            <tbody>
              {candidates.map(c => (
                <tr key={c.id} className="hover:brightness-125 transition" style={{ borderBottom: "1px solid var(--color-border)", background: "rgba(26, 27, 46, 0.5)" }}>
                  <td className="py-3 px-4"><a href={`/candidates/${c.id}`} style={{ color: "var(--color-primary)" }} className="hover:underline">{c.name}</a></td>
                  <td className="py-3 px-4" style={{ color: "var(--color-text-secondary)" }}>{c.email}</td>
                  <td className="py-3 px-4"><span className={`px-2 py-0.5 rounded text-xs ${c.status === 'analyzed' ? 'bg-green-900/50 text-green-400' : 'text-gray-400'}`} style={c.status !== 'analyzed' ? { background: "var(--color-card)", border: "1px solid var(--color-border)" } : {}}>{c.status}</span></td>
                  <td className="py-3 px-4">{avgScore(c.scores)}</td>
                  <td className={`py-3 px-4 ${recColor[c.recommendation || ""] || ""}`}>{c.recommendation || "-"}</td>
                  <td className="py-3 px-4">
                    {c.status === "submitted" && <button onClick={() => triggerAnalysis(c.id)} className="text-xs px-3 py-1 rounded font-medium text-white hover:brightness-110" style={{ background: "var(--color-primary)" }}>Analyze</button>}
                    {c.status === "analyzed" && <a href={`/candidates/${c.id}`} style={{ color: "var(--color-primary)" }} className="text-xs hover:underline">View</a>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
