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
      {loading ? <p className="text-gray-500">Loading...</p> : candidates.length === 0 ? (
        <p className="text-gray-500">No candidates yet. <a href="/submit" className="text-blue-400 underline">Submit one</a>.</p>
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-800">
            <th className="py-2">Name</th><th>Email</th><th>Status</th><th>Avg Score</th><th>Recommendation</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {candidates.map(c => (
              <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                <td className="py-2"><a href={`/candidates/${c.id}`} className="text-blue-400 hover:underline">{c.name}</a></td>
                <td className="text-gray-400">{c.email}</td>
                <td><span className={`px-2 py-0.5 rounded text-xs ${c.status === 'analyzed' ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'}`}>{c.status}</span></td>
                <td>{avgScore(c.scores)}</td>
                <td className={recColor[c.recommendation || ""] || ""}>{c.recommendation || "-"}</td>
                <td>
                  {c.status === "submitted" && <button onClick={() => triggerAnalysis(c.id)} className="text-xs bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded">Analyze</button>}
                  {c.status === "analyzed" && <a href={`/candidates/${c.id}`} className="text-xs text-blue-400 hover:underline">View</a>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
