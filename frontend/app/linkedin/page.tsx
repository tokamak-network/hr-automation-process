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
      <h1 className="text-2xl font-bold mb-6">🔗 LinkedIn Sourcing</h1>

      {/* Search Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">Search for Candidates</h2>
        <div className="flex gap-3 mb-3">
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="Enter keywords (e.g., 'solidity developer')"
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
            onKeyDown={(e) => e.key === "Enter" && runSearch(searchKeyword)}
          />
          <button
            onClick={() => runSearch(searchKeyword)}
            disabled={searching}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded text-sm font-medium"
          >
            {searching ? "Searching..." : "Search"}
          </button>
          <button
            onClick={() => runSearch()}
            disabled={searching}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded text-sm font-medium"
          >
            Run Default Queries
          </button>
        </div>

        {/* Keyword suggestions */}
        <div className="flex flex-wrap gap-2 mb-3">
          {SUGGESTED_KEYWORDS.map((kw) => (
            <button
              key={kw}
              onClick={() => setSearchKeyword(kw)}
              className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full px-3 py-1 text-gray-400 hover:text-white"
            >
              {kw}
            </button>
          ))}
        </div>

        {/* GitHub Bridge */}
        <button
          onClick={runBridge}
          disabled={bridging}
          className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded px-3 py-1.5"
        >
          {bridging ? "Bridging..." : "🔄 Find LinkedIn for GitHub candidates"}
        </button>

        {/* Search result */}
        {searchResult && (
          <div className="mt-3 text-sm p-3 bg-gray-800 rounded">
            {searchResult.error ? (
              <span className="text-red-400">❌ {searchResult.error}</span>
            ) : (
              <span className="text-green-400">
                ✅ Found {searchResult.total_found} candidates, {searchResult.total_saved} new saved
                ({searchResult.search_method})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-400">Filter:</span>
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`text-xs px-3 py-1 rounded-full border ${
              statusFilter === opt.value
                ? "bg-blue-600 border-blue-500 text-white"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
            }`}
          >
            {opt.label}
          </button>
        ))}
        <span className="text-xs text-gray-500 ml-auto">{candidates.length} candidates</span>
      </div>

      {/* Candidates Table */}
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : candidates.length === 0 ? (
        <p className="text-gray-500">No candidates found. Run a search to discover candidates.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-left">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Headline</th>
                <th className="py-2 pr-3">Location</th>
                <th className="py-2 pr-3 text-center">Score</th>
                <th className="py-2 pr-3 text-center">OTW</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                  <td className="py-2.5 pr-3">
                    <a
                      href={c.profile_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 font-medium"
                    >
                      {c.full_name}
                    </a>
                    {c.source === "github_bridge" && (
                      <span className="ml-1 text-[10px] bg-purple-900/50 text-purple-300 px-1.5 rounded">
                        GitHub
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-gray-400 max-w-xs truncate">{c.headline}</td>
                  <td className="py-2.5 pr-3 text-gray-500 text-xs">{c.location}</td>
                  <td className="py-2.5 pr-3 text-center">
                    <span
                      className={`font-mono text-xs px-2 py-0.5 rounded ${
                        c.score >= 8
                          ? "bg-green-900/50 text-green-300"
                          : c.score >= 6
                          ? "bg-yellow-900/50 text-yellow-300"
                          : "bg-gray-800 text-gray-400"
                      }`}
                    >
                      {c.score?.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-center">
                    {c.open_to_work ? (
                      <span className="text-green-400 text-xs">🟢</span>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        c.status === "outreach"
                          ? "bg-blue-900/50 text-blue-300"
                          : c.status === "contacted"
                          ? "bg-yellow-900/50 text-yellow-300"
                          : c.status === "responded"
                          ? "bg-green-900/50 text-green-300"
                          : c.status === "rejected"
                          ? "bg-red-900/50 text-red-300"
                          : "bg-gray-800 text-gray-400"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <div className="flex gap-1">
                      {c.status === "discovered" && (
                        <button
                          onClick={() => markOutreach(c.id, "outreach")}
                          className="text-[10px] bg-blue-800 hover:bg-blue-700 px-2 py-0.5 rounded"
                        >
                          Mark Outreach
                        </button>
                      )}
                      {c.status === "outreach" && (
                        <button
                          onClick={() => markOutreach(c.id, "contacted")}
                          className="text-[10px] bg-yellow-800 hover:bg-yellow-700 px-2 py-0.5 rounded"
                        >
                          Contacted
                        </button>
                      )}
                      {c.status !== "rejected" && (
                        <button
                          onClick={() => markOutreach(c.id, "rejected")}
                          className="text-[10px] bg-gray-800 hover:bg-red-900 px-2 py-0.5 rounded text-gray-500 hover:text-red-400"
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
