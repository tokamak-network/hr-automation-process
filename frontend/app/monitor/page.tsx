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
          className="px-3 py-1.5 rounded text-sm disabled:opacity-50 text-white hover:brightness-110" style={{ background: "var(--color-primary)" }}>
          {scanning ? "Scanning..." : "Scan Now"}
        </button>
      </div>

      {scanResult && (
        <div className="mb-4 p-3 rounded text-sm" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
          {scanResult.error ? <span className="text-red-400">{scanResult.error}</span> :
            <span className="text-green-400">Scanned {scanResult.repos_scanned} repos, found {scanResult.external_users_found} external users, analyzed {scanResult.profiles_analyzed} profiles</span>}
        </div>
      )}

      {candidates.length === 0 ? <p style={{ color: "var(--color-text-muted)" }}>No candidates detected yet. Click Scan Now.</p> : (
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
          <table className="w-full text-sm">
            <thead><tr className="text-left" style={{ color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border)", background: "var(--color-card)" }}>
              <th className="py-3 px-4">Username</th><th className="py-3 px-4">Repos</th><th className="py-3 px-4">Followers</th><th className="py-3 px-4">Languages</th><th className="py-3 px-4">Avg Score</th>
            </tr></thead>
            <tbody>
              {candidates.map(c => (
                <tr key={c.github_username} className="hover:brightness-125 transition" style={{ borderBottom: "1px solid var(--color-border)", background: "rgba(26, 27, 46, 0.5)" }}>
                  <td className="py-3 px-4"><a href={c.profile_url} style={{ color: "var(--color-primary)" }} className="hover:underline" target="_blank">{c.github_username}</a></td>
                  <td className="py-3 px-4">{c.public_repos}</td>
                  <td className="py-3 px-4">{c.followers}</td>
                  <td className="py-3 px-4" style={{ color: "var(--color-text-secondary)" }}>{Object.keys(c.languages || {}).slice(0, 3).join(", ")}</td>
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
