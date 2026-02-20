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
              <th className="py-3 px-4">Name</th><th className="py-3 px-4">Email</th><th className="py-3 px-4">Status</th><th className="py-3 px-4">Avg Score</th><th className="py-3 px-4">Recommendation</th><th className="py-3 px-4">Actions</th>
            </tr></thead>
            <tbody>
              {candidates.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition border-b border-gray-200">
                  <td className="py-3 px-4"><a href={`/candidates/${c.id}`} className="text-[#2A72E5] hover:underline">{c.name}</a></td>
                  <td className="py-3 px-4 text-gray-500">{c.email}</td>
                  <td className="py-3 px-4"><span className={`px-2 py-0.5 rounded text-xs ${c.status === 'analyzed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.status}</span></td>
                  <td className="py-3 px-4">{avgScore(c.scores)}</td>
                  <td className={`py-3 px-4 font-medium ${recColor[c.recommendation || ""] || ""}`}>{c.recommendation || "-"}</td>
                  <td className="py-3 px-4">
                    {c.status === "submitted" && <button onClick={() => triggerAnalysis(c.id)} className="text-xs px-3 py-1 rounded font-medium text-white bg-[#1C1C1C] hover:bg-gray-800">Analyze</button>}
                    {c.status === "analyzed" && <a href={`/candidates/${c.id}`} className="text-[#2A72E5] text-xs hover:underline">View</a>}
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
