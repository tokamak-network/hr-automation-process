"use client";

import { useState, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

// Dropdown categories with related keywords
const KEYWORD_CATEGORIES: Record<string, string[]> = {
  "Core Blockchain": [
    "ethereum solidity developer",
    "blockchain protocol engineer",
    "smart contract developer",
    "EVM developer",
  ],
  "Layer 2 / Rollup": [
    "layer 2 rollup engineer",
    "optimistic rollup developer",
    "ZK zero knowledge engineer",
    "L2 scaling engineer",
  ],
  "DeFi / Security": [
    "DeFi developer rust",
    "DeFi protocol engineer",
    "smart contract auditor",
    "blockchain security engineer",
  ],
  "Full-stack / Frontend": [
    "web3 frontend developer",
    "dApp full-stack developer",
    "react typescript blockchain",
  ],
  "Ecosystem": [
    "tokamak network",
    "ethereum developer Korea Seoul",
    "blockchain developer open to work",
  ],
};

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
  const [customInput, setCustomInput] = useState("");
  const [activeKeywords, setActiveKeywords] = useState<string[]>([
    "ethereum solidity developer",
    "layer 2 rollup engineer",
    "ZK zero knowledge engineer",
    "smart contract auditor",
    "DeFi developer rust",
    "blockchain protocol engineer",
    "tokamak network",
  ]);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);
  const [bridging, setBridging] = useState(false);
  const [dropdownCategory, setDropdownCategory] = useState("");

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

  const addKeyword = (kw: string) => {
    const trimmed = kw.trim();
    if (trimmed && !activeKeywords.includes(trimmed)) {
      setActiveKeywords([...activeKeywords, trimmed]);
    }
  };

  const removeKeyword = (kw: string) => {
    setActiveKeywords(activeKeywords.filter(k => k !== kw));
  };

  const handleAddCustom = () => {
    if (customInput.trim()) {
      addKeyword(customInput.trim());
      setCustomInput("");
    }
  };

  const handleDropdownAdd = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val) {
      addKeyword(val);
      e.target.value = "";
    }
  };

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

  const runAllActive = async () => {
    if (activeKeywords.length === 0) return;
    setSearching(true);
    setSearchResult(null);
    let totalFound = 0;
    let totalSaved = 0;
    let method = "";
    for (const kw of activeKeywords) {
      try {
        const res = await fetch(`${API}/api/linkedin/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keywords: kw }),
        });
        const data = await res.json();
        totalFound += data.total_found || 0;
        totalSaved += data.total_saved || 0;
        method = data.search_method || method;
      } catch (e) {
        console.error("Search failed for:", kw);
      }
    }
    setSearchResult({
      total_found: totalFound,
      total_saved: totalSaved,
      search_method: method,
      keywords_searched: activeKeywords.length,
    });
    fetchCandidates();
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
      alert(`Bridge complete: ${data.linkedin_profiles_found || 0} profiles found from ${data.candidates_checked || 0} GitHub users`);
      fetchCandidates();
    } catch (e) {
      console.error("Bridge failed", e);
    }
    setBridging(false);
  };

  // All keywords from all categories for the dropdown
  const allDropdownKeywords = Object.entries(KEYWORD_CATEGORIES).flatMap(
    ([cat, kws]) => kws.map(kw => ({ category: cat, keyword: kw }))
  ).filter(item => !activeKeywords.includes(item.keyword));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-gray-900">🔗 LinkedIn Sourcing</h1>

      {/* Search Section */}
      <div className="rounded-lg p-6 mb-6 bg-white border border-gray-200">

        {/* Active Keywords */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">Search Keywords ({activeKeywords.length})</h3>
            <div className="flex gap-2">
              <button
                onClick={runAllActive}
                disabled={searching || activeKeywords.length === 0}
                className="disabled:opacity-50 px-3 py-1.5 rounded text-sm font-medium text-white bg-[#1C1C1C] hover:bg-gray-800"
              >
                {searching ? `⏳ Searching ${activeKeywords.length} keywords...` : `🚀 Search All (${activeKeywords.length})`}
              </button>
              <button
                onClick={() => fetchCandidates()}
                className="px-3 py-1.5 rounded text-sm font-medium border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeKeywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 text-xs rounded-full px-3 py-1.5 bg-gray-100 text-gray-700 border border-gray-200"
              >
                {kw}
                <button
                  onClick={() => removeKeyword(kw)}
                  className="text-gray-400 hover:text-red-500 ml-0.5 font-bold"
                  title="Remove keyword"
                >
                  ×
                </button>
              </span>
            ))}
            {activeKeywords.length === 0 && (
              <span className="text-xs text-gray-400">No keywords added. Add from dropdown or type custom.</span>
            )}
          </div>
        </div>

        {/* Add Keywords */}
        <div className="flex gap-3 mb-3">
          {/* Dropdown: Category-based */}
          <select
            onChange={handleDropdownAdd}
            defaultValue=""
            className="text-sm rounded px-3 py-2 border border-gray-200 bg-white text-gray-700 outline-none focus:border-[#2A72E5] min-w-[220px]"
          >
            <option value="">+ Add from list...</option>
            {Object.entries(KEYWORD_CATEGORIES).map(([cat, kws]) => (
              <optgroup key={cat} label={cat}>
                {kws.filter(kw => !activeKeywords.includes(kw)).map(kw => (
                  <option key={kw} value={kw}>{kw}</option>
                ))}
              </optgroup>
            ))}
          </select>

          {/* Custom input */}
          <div className="flex flex-1 gap-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Type custom keyword and press Enter or Add"
              className="flex-1 rounded px-3 py-2 text-sm outline-none border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:border-[#2A72E5] focus:ring-1 focus:ring-[#2A72E5]"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCustom();
                }
              }}
            />
            <button
              onClick={handleAddCustom}
              disabled={!customInput.trim()}
              className="disabled:opacity-30 px-3 py-2 rounded text-sm font-medium border border-[#2A72E5] text-[#2A72E5] bg-white hover:bg-blue-50"
            >
              + Add
            </button>
          </div>
        </div>

        {/* Single keyword search */}
        <div className="flex gap-3 mb-3">
          <button
            onClick={runBridge}
            disabled={bridging}
            className="px-3 py-1.5 rounded text-sm font-medium border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
          >
            {bridging ? "Bridging..." : "🔄 Find LinkedIn for GitHub candidates"}
          </button>
        </div>

        {/* Dedup notice */}
        <p className="text-xs text-gray-400 mb-2">
          ℹ️ 동일 후보자는 최초 검색 후 <strong>30일 이내</strong> 재검색 시 중복으로 처리되어 건너뜁니다. 30일 이후에는 갱신됩니다.
        </p>

        {/* Search result */}
        {searchResult && (
          <div className={`mt-3 text-sm p-3 rounded border ${searchResult.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
            {searchResult.error ? (
              <span className="text-red-600">❌ {searchResult.error}</span>
            ) : (
              <span className="text-green-700">
                ✅ Found {searchResult.total_found} candidates, {searchResult.total_saved} new saved
                {searchResult.keywords_searched ? ` (${searchResult.keywords_searched} keywords searched)` : ""}
                {" "}({searchResult.search_method})
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
                    {(c.source === "github_bridge" || c.source === "github") && (
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
