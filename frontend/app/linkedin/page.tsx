"use client";

import { useState, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

const SUGGESTED_KEYWORDS = [
  "ethereum solidity developer",
  "layer 2 rollup engineer",
  "ZK zero knowledge engineer",
  "smart contract auditor",
  "DeFi developer rust",
  "blockchain protocol engineer",
  "tokamak network",
];

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "discovered", label: "Discovered" },
  { value: "outreach", label: "Outreach" },
  { value: "contacted", label: "Contacted" },
  { value: "responded", label: "Responded" },
  { value: "rejected", label: "Rejected" },
];

interface Candidate {
  id: number;
  linkedin_username: string;
  full_name: string;
  headline: string;
  location: string;
  profile_url: string;
  open_to_work: number;
  score: number;
  status: string;
  created_at: string;
  source: string;
  notes: string;
}

export default function LinkedInPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);
  const [bridging, setBridging] = useState(false);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "100");
      const res = await fetch(`${API}/api/linkedin/candidates?${params}`);
      const data = await res.json();
      setCandidates(data);
    } catch (e) {
      console.error("Failed to fetch candidates", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCandidates();
  }, [statusFilter]);

  const runSearch = async (keywords?: string) => {
    setSearching(true);
    setSearchResult(null);
    try {
      const body: any = {};
      if (keywords) body.keywords = keywords;
      const res = await fetch(`${API}/api/linkedin/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setSearchResult(data);
      fetchCandidates();
    } catch (e) {
      console.error("Search failed", e);
      setSearchResult({ error: "Search failed" });
    }
    setSearching(false);
  };

  const markOutreach = async (id: number, status: string) => {
    try {
      await fetch(`${API}/api/linkedin/candidates/${id}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchCandidates();
    } catch (e) {
      console.error("Failed to update status", e);
    }
  };

  const runBridge = async () => {
    setBridging(true);
    try {
      const res = await fetch(`${API}/api/linkedin/bridge`, { method: "POST" });
      const data = await res.json();
      alert(`Bridge complete: ${data.linkedin_profiles_found} profiles found from ${data.candidates_checked} GitHub users`);
      fetchCandidates();
    } catch (e) {
      console.error("Bridge failed", e);
    }
    setBridging(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-gray-900">🔗 LinkedIn Sourcing</h1>

      {/* Search Section */}
      <div className="rounded-lg p-6 mb-6 bg-white border border-gray-200">
        <h2 className="text-lg font-semibold mb-3 text-gray-900">Search for Candidates</h2>
        <div className="flex gap-3 mb-3">
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="Enter keywords (e.g., 'solidity developer')"
            className="flex-1 rounded px-3 py-2 text-sm outline-none border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:border-[#2A72E5] focus:ring-1 focus:ring-[#2A72E5]"
            onKeyDown={(e) => e.key === "Enter" && runSearch(searchKeyword)}
          />
          <button
            onClick={() => runSearch(searchKeyword)}
            disabled={searching}
            className="disabled:opacity-50 px-4 py-2 rounded text-sm font-medium text-white bg-[#1C1C1C] hover:bg-gray-800"
          >
            {searching ? "Searching..." : "Search"}
          </button>
          <button
            onClick={() => fetchCandidates()}
            className="px-4 py-2 rounded text-sm font-medium border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
          >
            🔄 Refresh
          </button>
        </div>

        <div className="flex gap-3 mb-3">
          <button
            onClick={() => runSearch()}
            disabled={searching}
            className="disabled:opacity-50 px-4 py-2 rounded text-sm font-medium border border-[#2A72E5] text-[#2A72E5] bg-white hover:bg-blue-50"
          >
            🚀 Run Full Search (all 18 keywords)
          </button>
          <button
            onClick={runBridge}
            disabled={bridging}
            className="px-4 py-2 rounded text-sm font-medium border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
          >
            {bridging ? "Bridging..." : "🔄 Find LinkedIn for GitHub candidates"}
          </button>
        </div>

        {/* Keyword suggestions */}
        <div className="flex flex-wrap gap-2 mb-3">
          {SUGGESTED_KEYWORDS.map((kw) => (
            <button
              key={kw}
              onClick={() => setSearchKeyword(kw)}
              className="text-xs rounded-full px-3 py-1 border border-gray-200 text-gray-500 hover:border-[#2A72E5] hover:text-[#2A72E5] transition bg-gray-50"
            >
              {kw}
            </button>
          ))}
        </div>

        {/* Search result */}
        {searchResult && (
          <div className={`mt-3 text-sm p-3 rounded border ${searchResult.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
            {searchResult.error ? (
              <span className="text-red-600">❌ {searchResult.error}</span>
            ) : (
              <span className="text-green-700">
                ✅ Found {searchResult.total_found} candidates, {searchResult.total_saved} new saved
                ({searchResult.search_method})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Filter + Count */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-500">Filter:</span>
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`text-xs px-3 py-1 rounded-full transition border ${
              statusFilter === opt.value
                ? 'bg-[#1C1C1C] border-[#1C1C1C] text-white'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <span className="text-sm font-semibold ml-auto text-gray-700">📊 {candidates.length} candidates</span>
      </div>

      {/* Candidates Table */}
      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : candidates.length === 0 ? (
        <p className="text-gray-400">No candidates found. Run a search to discover candidates.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Headline</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4 text-center">Score</th>
                <th className="py-3 px-4 text-center">Open To Work</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition border-b border-gray-200">
                  <td className="py-2.5 px-4">
                    <a
                      href={c.profile_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-[#2A72E5] hover:underline"
                    >
                      {c.full_name}
                    </a>
                    {c.source === "github_bridge" && (
                      <span className="ml-1 text-[10px] bg-purple-100 text-purple-700 px-1.5 rounded">
                        GitHub
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 max-w-xs truncate text-gray-500">{c.headline}</td>
                  <td className="py-2.5 px-4 text-xs text-gray-400">{c.location}</td>
                  <td className="py-2.5 px-4 text-center">
                    <span
                      className={`font-mono text-xs px-2 py-0.5 rounded ${
                        c.score >= 8
                          ? "bg-green-100 text-green-700"
                          : c.score >= 6
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {c.score?.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {c.open_to_work ? (
                      <span className="text-green-600 text-xs">🟢</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        c.status === "outreach"
                          ? "bg-blue-100 text-blue-700"
                          : c.status === "contacted"
                          ? "bg-yellow-100 text-yellow-700"
                          : c.status === "responded"
                          ? "bg-green-100 text-green-700"
                          : c.status === "rejected"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex gap-1">
                      {c.status === "discovered" && (
                        <button
                          onClick={() => markOutreach(c.id, "outreach")}
                          className="text-[10px] bg-[#2A72E5] hover:bg-[#1E5FCC] px-2 py-0.5 rounded text-white"
                        >
                          Mark Outreach
                        </button>
                      )}
                      {c.status === "outreach" && (
                        <button
                          onClick={() => markOutreach(c.id, "contacted")}
                          className="text-[10px] bg-yellow-500 hover:bg-yellow-600 px-2 py-0.5 rounded text-white"
                        >
                          Contacted
                        </button>
                      )}
                      {c.status !== "rejected" && (
                        <button
                          onClick={() => markOutreach(c.id, "rejected")}
                          className="text-[10px] px-2 py-0.5 rounded text-gray-400 hover:text-red-500 bg-gray-100 hover:bg-red-50 transition"
                        >
                          ✕
                        </button>
                      )}
                    </div>
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
