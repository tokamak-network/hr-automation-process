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
      setScanResult(await res.json());
      load();
    } catch (e) { setScanResult({ error: "Scan failed" }); }
    setScanning(false);
  };

  const avgScore = (scores: Record<string, number>) => {
    const vals = Object.values(scores);
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">GitHub Monitor</h1>
        <button onClick={scan} disabled={scanning}
          className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded text-sm disabled:opacity-50">
          {scanning ? "Scanning..." : "Scan Now"}
        </button>
      </div>

      {scanResult && (
        <div className="mb-4 p-3 bg-gray-900 rounded text-sm">
          {scanResult.error ? <span className="text-red-400">{scanResult.error}</span> :
            <span className="text-green-400">Scanned {scanResult.repos_scanned} repos, found {scanResult.external_users_found} external users, analyzed {scanResult.profiles_analyzed} profiles</span>}
        </div>
      )}

      {candidates.length === 0 ? <p className="text-gray-500">No candidates detected yet. Click Scan Now.</p> : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-800">
            <th className="py-2">Username</th><th>Repos</th><th>Followers</th><th>Languages</th><th>Avg Score</th>
          </tr></thead>
          <tbody>
            {candidates.map(c => (
              <tr key={c.github_username} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                <td className="py-2"><a href={c.profile_url} className="text-blue-400 hover:underline" target="_blank">{c.github_username}</a></td>
                <td>{c.public_repos}</td>
                <td>{c.followers}</td>
                <td className="text-gray-400">{Object.keys(c.languages || {}).slice(0, 3).join(", ")}</td>
                <td>{c.scores ? avgScore(c.scores) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
