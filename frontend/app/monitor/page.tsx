"use client";
import { useEffect, useState } from "react";

const API = "http://localhost:8001";

export default function MonitorPage() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);

  const load = () => fetch(`${API}/api/monitor/candidates`).then(r => r.json()).then(setCandidates).catch(() => {});

  useEffect(() => { load(); }, []);

  const scan = async () => {
    setScanning(true);
    try {
      const res = await fetch(`${API}/api/monitor/scan`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setScanResult({ error: data.detail || "Scan failed" });
      } else {
        setScanResult(data);
        load();
      }
    } catch (e) { setScanResult({ error: "Scan failed — check network connection" }); }
    setScanning(false);
  };

  const avgScore = (scores: Record<string, number>) => {
    const vals = Object.values(scores);
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">GitHub Monitor</h1>
        <button onClick={scan} disabled={scanning}
          className="px-3 py-1.5 rounded text-sm disabled:opacity-50 text-white bg-[#1C1C1C] hover:bg-gray-800">
          {scanning ? "Scanning..." : "Scan Now"}
        </button>
      </div>

      {scanResult && (
        <div className={`mb-4 p-3 rounded text-sm border ${scanResult.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
          {scanResult.error ? (
            <div>
              <span className="text-red-600 font-medium">⚠️ {scanResult.error}</span>
              {scanResult.error.includes("GITHUB_TOKEN") && (
                <p className="text-red-500 text-xs mt-1">Add GITHUB_TOKEN to your backend .env file to enable GitHub scanning.</p>
              )}
            </div>
          ) : (
            <span className="text-green-700">✅ Scanned {scanResult.repos_scanned} repos, found {scanResult.external_users_found} external users, analyzed {scanResult.profiles_analyzed} profiles</span>
          )}
        </div>
      )}

      {candidates.length === 0 ? <p className="text-gray-400">No candidates detected yet. Click Scan Now.</p> : (
        <div className="rounded-lg overflow-hidden border border-gray-200">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
              <th className="py-3 px-4">Username</th><th className="py-3 px-4">Repos</th><th className="py-3 px-4">Followers</th><th className="py-3 px-4">Languages</th><th className="py-3 px-4">Avg Score</th>
            </tr></thead>
            <tbody>
              {candidates.map(c => (
                <tr key={c.github_username} className="hover:bg-gray-50 transition border-b border-gray-200">
                  <td className="py-3 px-4"><a href={c.profile_url} className="text-[#2A72E5] hover:underline" target="_blank">{c.github_username}</a></td>
                  <td className="py-3 px-4">{c.public_repos}</td>
                  <td className="py-3 px-4">{c.followers}</td>
                  <td className="py-3 px-4 text-gray-500">{Object.keys(c.languages || {}).slice(0, 3).join(", ")}</td>
                  <td className="py-3 px-4">{c.scores ? avgScore(c.scores) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
