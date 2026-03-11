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
  const [newUsername, setNewUsername] = useState("");
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<any>(null);

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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min timeout
      const res = await fetch(`${API}/api/team/profile-scan`, { method: "POST", signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) {
        setScanResult({ error: data.detail || "Scan failed" });
      } else {
        setScanResult(data);
        loadProfiles();
      }
    } catch (e: any) {
      setScanResult({ error: e.message });
    } finally {
      setScanning(false);
    }
  };

  const deleteProfile = async (username: string) => {
    if (!confirm(`Remove ${username} from team profiles?`)) return;
    try {
      const res = await fetch(`${API}/api/team/profiles/${username}`, { method: "DELETE" });
      if (res.ok) loadProfiles();
      else alert("Failed to delete");
    } catch { alert("Error deleting profile"); }
  };

  const addMember = async () => {
    const username = newUsername.trim().replace(/^@/, "");
    if (!username) return;
    setAdding(true);
    setAddResult(null);
    try {
      const res = await fetch(`${API}/api/team/profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github_username: username }),
      });
      const data = await res.json();
      if (res.ok) {
        setAddResult({ success: `Added ${data.display_name || username} (${data.commits_found} commits found)` });
        setNewUsername("");
        loadProfiles();
      } else {
        setAddResult({ error: data.detail || "Failed to add" });
      }
    } catch (e: any) {
      setAddResult({ error: e.message });
    } finally { setAdding(false); }
  };

  const topSkills = (areas: Record<string, number>) =>
    Object.entries(areas || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const topRepos = (repos: { name: string; commits: number; language: string }[]) =>
    (repos || []).slice(0, 3);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Profiles</h1>
          <p className="text-sm mt-1 text-gray-400">Reviewer pool — auto-matched to candidates for interviews</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addMember()}
            placeholder="GitHub username"
            className="px-3 py-2 border border-gray-300 rounded text-sm w-44 focus:outline-none focus:border-[#2A72E5]"
          />
          <button
            onClick={addMember}
            disabled={adding || !newUsername.trim()}
            className="px-4 py-2 disabled:opacity-50 rounded text-sm font-medium text-white bg-[#2A72E5] hover:bg-blue-600 transition"
          >
            {adding ? "Adding..." : "+ Add"}
          </button>
          <button
            onClick={triggerScan}
            disabled={scanning}
            className="px-4 py-2 disabled:opacity-50 rounded text-sm font-medium text-white bg-[#1C1C1C] hover:bg-gray-800 transition"
          >
            {scanning ? "⏳ Scanning..." : "🔄 Scan All"}
          </button>
        </div>
      </div>

      {addResult && (
        <div className={`mb-4 p-3 rounded text-sm border ${addResult.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
          {addResult.error ? <span className="text-red-600">⚠️ {addResult.error}</span> : <span className="text-green-700">✅ {addResult.success}</span>}
        </div>
      )}

      {scanResult && (
        <div className={`mb-6 p-4 rounded text-sm border ${scanResult.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
          {scanResult.error
            ? <span className="text-red-600">⚠️ {scanResult.error}</span>
            : <span className="text-green-700">✅ Scanned {scanResult.repos_scanned} repos · Found {scanResult.members_found} members · Created {scanResult.profiles_created} profiles</span>}
        </div>
      )}

      {loading ? (
        <p className="text-gray-400">Loading profiles...</p>
      ) : profiles.length === 0 ? (
        <div className="text-center py-16 border border-gray-200 rounded-lg bg-gray-50">
          <p className="text-lg mb-2 text-gray-600">No team profiles yet</p>
          <p className="text-sm text-gray-400 mb-4">Scan GitHub activity to build the reviewer pool. This requires GITHUB_TOKEN in your backend .env file.</p>
          <button
            onClick={triggerScan}
            disabled={scanning}
            className="px-6 py-3 rounded text-sm font-medium text-white bg-[#1C1C1C] hover:bg-gray-800"
          >
            {scanning ? "Scanning..." : "🔍 Scan Profiles Now"}
          </button>
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">GitHub</th>
                <th className="py-3 px-4">Main Work</th>
                <th className="py-3 px-4">Key Skills</th>
                <th className="py-3 px-4">Last Active</th>
                <th className="py-3 px-4 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(p => (
                <tr key={p.github_username} className="hover:bg-gray-50 transition border-b border-gray-200">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {p.avatar_url && <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full" />}
                      <span className="font-medium text-gray-900">{p.display_name || p.github_username}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <a href={`https://github.com/${p.github_username}`} target="_blank" className="text-[#2A72E5] hover:underline">
                      @{p.github_username}
                    </a>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {topRepos(p.top_repos).map(r => (
                        <span key={r.name} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {r.name} <span className="text-gray-400">({r.commits})</span>
                        </span>
                      ))}
                      {(!p.top_repos || p.top_repos.length === 0) && <span className="text-gray-400 text-xs">—</span>}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {topSkills(p.expertise_areas).map(([skill, score]) => (
                        <span key={skill} className={`text-xs px-2 py-0.5 rounded ${
                          score >= 0.7 ? 'bg-green-100 text-green-700' :
                          score >= 0.4 ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-400">
                    {p.last_profiled ? new Date(p.last_profiled).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => deleteProfile(p.github_username)}
                      className="text-xs text-red-400 hover:text-red-600 transition"
                      title="Remove from team"
                    >✕</button>
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
