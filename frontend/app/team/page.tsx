"use client";
import { useState, useEffect } from "react";

const API = "http://localhost:8001";

interface TeamProfile {
  id: number;
  github_username: string;
  display_name: string;
  avatar_url: string;
  expertise_areas: Record<string, number>;
  top_repos: { name: string; commits: number; language: string }[];
  languages: Record<string, number>;
  review_count: number;
  last_active: string;
  last_profiled: string;
  is_active: number;
}

export default function TeamPage() {
  const [profiles, setProfiles] = useState<TeamProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);

  const loadProfiles = () => {
    setLoading(true);
    fetch(`${API}/api/team/profiles`)
      .then(r => r.json())
      .then(data => { setProfiles(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadProfiles(); }, []);

  const triggerScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch(`${API}/api/team/profile-scan`, { method: "POST" });
      const data = await res.json();
      setScanResult(data);
      loadProfiles();
    } catch (e: any) {
      setScanResult({ error: e.message });
    } finally {
      setScanning(false);
    }
  };

  const topExpertise = (areas: Record<string, number>) => {
    return Object.entries(areas || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  };

  const strengthColor = (score: number) => {
    if (score >= 0.7) return "bg-green-900/50 text-green-300 border-green-700/50";
    if (score >= 0.4) return "bg-blue-900/50 text-blue-300 border-blue-700/50";
    return "bg-gray-800/50 text-gray-400 border-gray-700/50";
  };

  const topLangs = (langs: Record<string, number>) => {
    return Object.entries(langs || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Team Profiles</h1>
          <p className="text-gray-500 text-sm mt-1">Auto-detected expertise from GitHub activity</p>
        </div>
        <button
          onClick={triggerScan}
          disabled={scanning}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition"
        >
          {scanning ? "Scanning..." : "🔄 Scan Profiles"}
        </button>
      </div>

      {scanResult && (
        <div className={`mb-6 p-4 rounded-lg text-sm ${scanResult.error ? "bg-red-900/30 text-red-300" : "bg-green-900/30 text-green-300"}`}>
          {scanResult.error
            ? `Error: ${scanResult.error}`
            : `Scanned ${scanResult.repos_scanned} repos · Found ${scanResult.members_found} members · Created ${scanResult.profiles_created} profiles`}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading profiles...</p>
      ) : profiles.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No team profiles yet</p>
          <p className="text-sm">Click &quot;Scan Profiles&quot; to analyze GitHub activity</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profiles.map(p => (
            <div key={p.github_username} className="bg-gray-900 rounded-lg p-5 border border-gray-800 hover:border-gray-700 transition">
              <div className="flex items-start gap-3 mb-3">
                {p.avatar_url && (
                  <img src={p.avatar_url} alt={p.github_username} className="w-12 h-12 rounded-full" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white">{p.display_name || p.github_username}</div>
                  <a
                    href={`https://github.com/${p.github_username}`}
                    target="_blank"
                    className="text-sm text-gray-500 hover:text-blue-400"
                  >
                    @{p.github_username}
                  </a>
                </div>
                {p.review_count > 0 && (
                  <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                    {p.review_count} reviews
                  </span>
                )}
              </div>

              {/* Expertise Tags */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {topExpertise(p.expertise_areas).map(([area, score]) => (
                  <span
                    key={area}
                    className={`text-xs px-2 py-0.5 rounded border ${strengthColor(score)}`}
                    title={`Score: ${score}`}
                  >
                    {area}
                    <span className="ml-1 opacity-60">{Math.round(score * 100)}%</span>
                  </span>
                ))}
              </div>

              {/* Top Repos */}
              {p.top_repos && p.top_repos.length > 0 && (
                <div className="text-xs text-gray-500 mb-2">
                  <span className="text-gray-600">Top repos: </span>
                  {p.top_repos.slice(0, 4).map((r, i) => (
                    <span key={r.name}>
                      {i > 0 && " · "}
                      <span className="text-gray-400">{r.name}</span>
                      <span className="text-gray-600"> ({r.commits})</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Languages */}
              <div className="flex flex-wrap gap-1.5">
                {topLangs(p.languages).map(([lang, count]) => (
                  <span key={lang} className="text-xs text-gray-500 bg-gray-800/50 px-1.5 py-0.5 rounded">
                    {lang}
                  </span>
                ))}
              </div>

              {p.last_profiled && (
                <div className="text-xs text-gray-600 mt-2">
                  Profiled: {new Date(p.last_profiled).toLocaleDateString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
