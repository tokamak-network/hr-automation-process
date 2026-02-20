"use client";
import { useEffect, useState } from "react";

const API = "http://localhost:8001";

const ACTIVITY_FILTERS = [
  { value: "", label: "All" },
  { value: "1w", label: "1주 이내" },
  { value: "1m", label: "1개월 이내" },
  { value: "3m", label: "3개월 이내" },
];

const ACTIVITY_ICONS: Record<string, string> = {
  star: "⭐",
  fork: "🍴",
  pr: "🔀",
  issue: "🐛",
  commit: "📝",
  comment: "💬",
};

interface Activity {
  activity_type: string;
  repo_name: string;
  activity_url: string;
  activity_date: string;
  details: string;
}

function ActivityBadges({ types }: { types: Record<string, number> }) {
  if (!types || Object.keys(types).length === 0) return null;
  return (
    <span className="flex gap-1">
      {Object.entries(types).map(([t, count]) => (
        <span key={t} className="inline-flex items-center gap-0.5 text-xs bg-gray-100 rounded px-1.5 py-0.5" title={`${t}: ${count}`}>
          {ACTIVITY_ICONS[t] || "📌"}{count}
        </span>
      ))}
    </span>
  );
}

function LastActivity({ activities }: { activities: Activity[] }) {
  if (!activities || activities.length === 0) return <span className="text-gray-300">-</span>;
  const a = activities[0];
  const shortRepo = a.repo_name.split("/").pop() || a.repo_name;
  const icon = ACTIVITY_ICONS[a.activity_type] || "📌";
  const label = a.details
    ? `${a.details.length > 40 ? a.details.slice(0, 40) + "…" : a.details}`
    : a.activity_type;
  return (
    <a href={a.activity_url} target="_blank" className="text-[#2A72E5] hover:underline text-xs" title={a.details}>
      {icon} {shortRepo}: {label}
    </a>
  );
}

function ActivityHistory({ username }: { username: string }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/monitor/candidates/${username}/activities`)
      .then(r => r.json())
      .then(setActivities)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) return <div className="p-2 text-xs text-gray-400">Loading...</div>;
  if (activities.length === 0) return <div className="p-2 text-xs text-gray-400">No activities recorded</div>;

  return (
    <div className="p-3 bg-gray-50 border-t border-gray-100">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-400 text-left">
            <th className="pb-1 pr-2">Type</th>
            <th className="pb-1 pr-2">Repo</th>
            <th className="pb-1 pr-2">Details</th>
            <th className="pb-1">Date</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((a, i) => (
            <tr key={i} className="border-t border-gray-100">
              <td className="py-1 pr-2">{ACTIVITY_ICONS[a.activity_type] || "📌"} {a.activity_type}</td>
              <td className="py-1 pr-2 text-gray-500">{a.repo_name.split("/").pop()}</td>
              <td className="py-1 pr-2">
                <a href={a.activity_url} target="_blank" className="text-[#2A72E5] hover:underline">
                  {a.details ? (a.details.length > 50 ? a.details.slice(0, 50) + "…" : a.details) : "View"}
                </a>
              </td>
              <td className="py-1 text-gray-400">{a.activity_date ? new Date(a.activity_date).toLocaleDateString("ko-KR") : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MonitorPage() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [activityFilter, setActivityFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = (filter?: string) => {
    const f = filter ?? activityFilter;
    const params = f ? `?activity_within=${f}` : "";
    fetch(`${API}/api/monitor/candidates${params}`).then(r => r.json()).then(setCandidates).catch(() => {});
  };

  useEffect(() => { load(); }, [activityFilter]);

  const scan = async () => {
    setScanning(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);
      const res = await fetch(`${API}/api/monitor/scan`, { method: "POST", signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) {
        setScanResult({ error: data.detail || "Scan failed" });
      } else {
        setScanResult(data);
        load();
      }
    } catch (e: any) {
      setScanResult({ error: e.name === "AbortError" ? "Scan timed out" : "Scan failed — check network connection" });
    }
    setScanning(false);
  };

  const avgScore = (scores: Record<string, number>) => {
    if (!scores) return "-";
    const vals = Object.values(scores);
    if (vals.length === 0) return "-";
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">GitHub Monitor</h1>
        <button onClick={scan} disabled={scanning}
          className="px-3 py-1.5 rounded text-sm disabled:opacity-50 text-white bg-[#1C1C1C] hover:bg-gray-800">
          {scanning ? "⏳ Scanning (약 2분 소요)..." : "Scan Now"}
        </button>
      </div>

      {scanResult && (
        <div className={`mb-4 p-3 rounded text-sm border ${scanResult.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
          {scanResult.error ? (
            <div>
              <span className="text-red-600 font-medium">⚠️ {scanResult.error}</span>
              {String(scanResult.error).includes("GITHUB_TOKEN") && (
                <p className="text-red-500 text-xs mt-1">Add GITHUB_TOKEN to your backend .env file to enable GitHub scanning.</p>
              )}
            </div>
          ) : (
            <span className="text-green-700">✅ Scanned {scanResult.repos_scanned} repos, found {scanResult.external_users_found} external users, analyzed {scanResult.profiles_analyzed} profiles</span>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-500">마지막 활동:</span>
        {ACTIVITY_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setActivityFilter(f.value)}
            className={`text-xs px-3 py-1 rounded-full transition border ${
              activityFilter === f.value
                ? 'bg-[#1C1C1C] border-[#1C1C1C] text-white'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="text-sm font-semibold ml-auto text-gray-700">{candidates.length} candidates</span>
      </div>

      {candidates.length === 0 ? (
        <p className="text-gray-400">
          {activityFilter ? `${ACTIVITY_FILTERS.find(f => f.value === activityFilter)?.label} 기간 내 활동한 외부 기여자가 없습니다.` : "No candidates detected yet. Click Scan Now."}
        </p>
      ) : (
        <div className="rounded-lg overflow-hidden border border-gray-200">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
              <th className="py-3 px-4">Username</th>
              <th className="py-3 px-4">Activities</th>
              <th className="py-3 px-4">Last Activity</th>
              <th className="py-3 px-4">Repos</th>
              <th className="py-3 px-4">Languages</th>
              <th className="py-3 px-4">Avg Score</th>
              <th className="py-3 px-4">Last Active</th>
            </tr></thead>
            <tbody>
              {candidates.map(c => (
                <>
                  <tr
                    key={c.github_username}
                    className="hover:bg-gray-50 transition border-b border-gray-200 cursor-pointer"
                    onClick={() => setExpanded(expanded === c.github_username ? null : c.github_username)}
                  >
                    <td className="py-3 px-4">
                      <a href={c.profile_url} className="text-[#2A72E5] hover:underline" target="_blank" onClick={e => e.stopPropagation()}>{c.github_username}</a>
                    </td>
                    <td className="py-3 px-4"><ActivityBadges types={c.activity_types} /></td>
                    <td className="py-3 px-4"><LastActivity activities={c.recent_activities} /></td>
                    <td className="py-3 px-4">{c.public_repos}</td>
                    <td className="py-3 px-4 text-gray-500">{Object.keys(c.languages || {}).slice(0, 3).join(", ")}</td>
                    <td className="py-3 px-4">
                      <span className={`font-mono text-xs px-2 py-0.5 rounded ${
                        c.scores && avgScore(c.scores) !== "-" && parseFloat(avgScore(c.scores)) >= 6
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {c.scores ? avgScore(c.scores) : "-"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-400">{c.last_scanned ? new Date(c.last_scanned).toLocaleDateString('ko-KR') : "-"}</td>
                  </tr>
                  {expanded === c.github_username && (
                    <tr key={c.github_username + "-detail"}>
                      <td colSpan={7}>
                        <ActivityHistory username={c.github_username} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
