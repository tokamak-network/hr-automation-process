"use client";

import React, { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

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
  Ecosystem: [
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
  search_keyword?: string;
  github_url?: string;
  score_breakdown?: string;
  first_seen_at?: string;
  last_searched_at?: string;
  search_count?: string;
}

interface OutreachTemplate {
  id: string;
  name: string;
  language: string;
  subject: string;
  body: string;
  variables: string[];
}

interface OutreachHistoryItem {
  id: number;
  candidate_id: number;
  template_used: string;
  message_sent: string;
  channel: string;
  status: string;
  sent_at: string;
  sent_by: string;
}

function OutreachModal({
  candidate,
  templates,
  onClose,
  onSent,
}: {
  candidate: Candidate;
  templates: OutreachTemplate[];
  onClose: () => void;
  onSent: () => void;
}) {
  const [lang, setLang] = useState<"en" | "kr">("en");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  const filteredTemplates = templates.filter((t) => t.language === lang);

  const fillVariables = useCallback(
    (body: string) => {
      return body
        .replace(/\{name\}/g, candidate.full_name || "")
        .replace(
          /\{project\/skill\}/g,
          candidate.headline || candidate.search_keyword || ""
        )
        .replace(
          /\{skill_area\}/g,
          candidate.headline || candidate.search_keyword || ""
        )
        .replace(/\{skill\}/g, candidate.headline || candidate.search_keyword || "")
        .replace(/\{source\}/g, "LinkedIn")
        .replace(/\{source:[^}]*\}/g, "LinkedIn")
        .replace(/\{sender_name\}/g, process.env.NEXT_PUBLIC_SENDER_NAME || "Tokamak Team")
        .replace(/\{sender_title\}/g, "Tokamak Network")
        .replace(/\{repo_name\}/g, "")
        .replace(/\{action\}/g, "")
        .replace(/\{action:[^}]*\}/g, "")
        .replace(/\{link_to_track_b_info\}/g, "https://tokamak.network")
        .replace(/\{link\}/g, "https://tokamak.network");
    },
    [candidate]
  );

  useEffect(() => {
    if (selectedTemplateId) {
      const t = templates.find((t) => t.id === selectedTemplateId);
      if (t) {
        setMessage(fillVariables(t.body));
        setSubject(t.subject || "");
      }
    }
  }, [selectedTemplateId, templates, fillVariables]);

  // Auto-select first template
  useEffect(() => {
    if (filteredTemplates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(filteredTemplates[0].id);
    }
  }, [filteredTemplates, selectedTemplateId]);

  // When language changes, switch to equivalent template
  useEffect(() => {
    if (selectedTemplateId) {
      const currentNum = selectedTemplateId.split("_")[0];
      const newId = currentNum + "_" + lang;
      const exists = templates.find((t) => t.id === newId);
      if (exists) {
        setSelectedTemplateId(newId);
      } else if (filteredTemplates.length > 0) {
        setSelectedTemplateId(filteredTemplates[0].id);
      }
    }
  }, [lang]);

  const handleCopy = async () => {
    const clipText = subject ? `Subject: ${subject}\n\n${message}` : message;
    await navigator.clipboard.writeText(clipText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMarkSent = async () => {
    setSending(true);
    try {
      await fetch(`${API}/api/linkedin/candidates/${candidate.id}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "contacted",
          template_id: selectedTemplateId,
          message_sent: message,
          channel: "linkedin_dm",
        }),
      });
      onSent();
    } catch (e) {
      console.error("Failed to save outreach", e);
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                📨 Outreach to {candidate.full_name}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {candidate.headline}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Language Toggle + Template Selector */}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Template
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#2A72E5]"
              >
                {filteredTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Language
              </label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setLang("en")}
                  className={`px-3 py-2 text-sm font-medium transition ${
                    lang === "en"
                      ? "bg-[#1C1C1C] text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLang("kr")}
                  className={`px-3 py-2 text-sm font-medium transition ${
                    lang === "kr"
                      ? "bg-[#1C1C1C] text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  KR
                </button>
              </div>
            </div>
          </div>

          {/* Subject Line */}
          {subject && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Subject
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#2A72E5]"
              />
            </div>
          )}

          {/* Editable Message */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Message (editable)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={12}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#2A72E5] font-mono leading-relaxed resize-y"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition"
            >
              {copied ? "✅ Copied!" : "📋 Copy to Clipboard"}
            </button>
            <a
              href={candidate.profile_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium border border-[#2A72E5] text-[#2A72E5] bg-white hover:bg-blue-50 transition"
            >
              🔗 Open LinkedIn Profile
            </a>
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-500 bg-white hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleMarkSent}
              disabled={sending || !message.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
            >
              {sending ? "Saving..." : "✅ Mark as Sent"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
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
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 100;
  const [newCandidateIds, setNewCandidateIds] = useState<Set<number>>(new Set());
  const [scoreTooltip, setScoreTooltip] = useState<{ bd: any; x: number; y: number } | null>(null);
  const [bridging, setBridging] = useState(false);
  const [dropdownCategory, setDropdownCategory] = useState("");

  // Outreach modal state
  const [outreachCandidate, setOutreachCandidate] = useState<Candidate | null>(null);
  const [outreachTemplates, setOutreachTemplates] = useState<OutreachTemplate[]>([]);
  const [expandedCandidate, setExpandedCandidate] = useState<number | null>(null);
  const [outreachHistory, setOutreachHistory] = useState<Record<number, OutreachHistoryItem[]>>({});

  const fetchCandidates = async (p?: number) => {
    setLoading(true);
    const currentPage = p ?? page;
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(currentPage * PAGE_SIZE));
      const res = await fetch(`${API}/api/linkedin/candidates?${params}`);
      const data = await res.json();
      setCandidates(data.candidates || []);
      setTotalCount(data.total || 0);
    } catch (e) {
      console.error("Failed to fetch candidates", e);
    }
    setLoading(false);
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${API}/api/templates/outreach`);
      const data = await res.json();
      setOutreachTemplates(data);
    } catch (e) {
      console.error("Failed to fetch templates", e);
    }
  };

  const fetchOutreachHistory = async (candidateId: number) => {
    try {
      const res = await fetch(
        `${API}/api/linkedin/candidates/${candidateId}/outreach-history`
      );
      const data = await res.json();
      setOutreachHistory((prev) => ({ ...prev, [candidateId]: data }));
    } catch (e) {
      console.error("Failed to fetch outreach history", e);
    }
  };

  useEffect(() => {
    setPage(0);
    fetchCandidates(0);
    fetchTemplates();
  }, [statusFilter]);

  useEffect(() => {
    fetchCandidates(page);
  }, [page]);

  const addKeyword = (kw: string) => {
    const trimmed = kw.trim();
    if (trimmed && !activeKeywords.includes(trimmed)) {
      setActiveKeywords([...activeKeywords, trimmed]);
    }
  };

  const removeKeyword = (kw: string) => {
    setActiveKeywords(activeKeywords.filter((k) => k !== kw));
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
    // Remember existing candidate IDs before search
    const existingIds = new Set(candidates.map((c) => c.id));
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
      // Fetch updated candidates and detect new ones
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "100");
      const cRes = await fetch(`${API}/api/linkedin/candidates?${params}`);
      const updatedCandidates: Candidate[] = await cRes.json();
      setCandidates(updatedCandidates);
      const newIds = new Set(updatedCandidates.filter((c) => !existingIds.has(c.id)).map((c) => c.id));
      setNewCandidateIds(newIds);
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
    // Remember existing candidate IDs before search
    const existingIds = new Set(candidates.map((c) => c.id));
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
    // Fetch updated candidates and detect new ones
    setPage(0);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", "0");
    const cRes = await fetch(`${API}/api/linkedin/candidates?${params}`);
    const cData = await cRes.json();
    const updatedCandidates: Candidate[] = cData.candidates || [];
    setCandidates(updatedCandidates);
    setTotalCount(cData.total || 0);
    const newIds = new Set(updatedCandidates.filter((c) => !existingIds.has(c.id)).map((c) => c.id));
    setNewCandidateIds(newIds);
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

  const openOutreachModal = (c: Candidate) => {
    setOutreachCandidate(c);
  };

  const toggleExpanded = (id: number) => {
    if (expandedCandidate === id) {
      setExpandedCandidate(null);
    } else {
      setExpandedCandidate(id);
      fetchOutreachHistory(id);
    }
  };

  const runBridge = async () => {
    setBridging(true);
    try {
      const res = await fetch(`${API}/api/linkedin/bridge`, { method: "POST" });
      const data = await res.json();
      alert(
        `Bridge complete: ${data.linkedin_profiles_found || 0} profiles found from ${data.candidates_checked || 0} GitHub users`
      );
      fetchCandidates();
    } catch (e) {
      console.error("Bridge failed", e);
    }
    setBridging(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-gray-900">
        🔍 Developer Sourcing
      </h1>

      {/* Outreach Modal */}
      {outreachCandidate && (
        <OutreachModal
          candidate={outreachCandidate}
          templates={outreachTemplates}
          onClose={() => setOutreachCandidate(null)}
          onSent={() => {
            setOutreachCandidate(null);
            fetchCandidates();
          }}
        />
      )}

      {/* Search Section */}
      <div className="rounded-lg p-6 mb-6 bg-white border border-gray-200">
        {/* Active Keywords */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">
              Search Keywords ({activeKeywords.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={runAllActive}
                disabled={searching || activeKeywords.length === 0}
                className="disabled:opacity-50 px-3 py-1.5 rounded text-sm font-medium text-white bg-[#1C1C1C] hover:bg-gray-800"
              >
                {searching
                  ? `⏳ Searching ${activeKeywords.length} keywords...`
                  : `🚀 Search All (${activeKeywords.length})`}
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
              <span className="text-xs text-gray-400">
                No keywords added. Add from dropdown or type custom.
              </span>
            )}
          </div>
        </div>

        {/* Add Keywords */}
        <div className="flex gap-3 mb-3">
          <select
            onChange={handleDropdownAdd}
            defaultValue=""
            className="text-sm rounded px-3 py-2 border border-gray-200 bg-white text-gray-700 outline-none focus:border-[#2A72E5] min-w-[220px]"
          >
            <option value="">+ Add from list...</option>
            {Object.entries(KEYWORD_CATEGORIES).map(([cat, kws]) => (
              <optgroup key={cat} label={cat}>
                {kws
                  .filter((kw) => !activeKeywords.includes(kw))
                  .map((kw) => (
                    <option key={kw} value={kw}>
                      {kw}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>

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

        <div className="flex gap-3 mb-3">
          <button
            onClick={runBridge}
            disabled={bridging}
            className="px-3 py-1.5 rounded text-sm font-medium border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
          >
            {bridging
              ? "Bridging..."
              : "🔄 Find LinkedIn for GitHub candidates"}
          </button>
        </div>

        <p className="text-xs text-gray-400 mb-2">
          ℹ️ 동일 후보자는 <strong>30일 이내</strong> 재검색 시 건너뜁니다.
          30일 이후 재검색 시 프로필은 갱신되지만, <strong>상태(Contacted/Responded 등)와 아웃리치 이력은 보존</strong>됩니다.
        </p>

        {searchResult && (
          <div
            className={`mt-3 text-sm p-3 rounded border ${searchResult.error ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}
          >
            {searchResult.error ? (
              <span className="text-red-600">❌ {searchResult.error}</span>
            ) : (
              <span className="text-green-700">
                ✅ Found {searchResult.total_found} candidates,{" "}
                {searchResult.total_saved} new saved
                {searchResult.keywords_searched
                  ? ` (${searchResult.keywords_searched} keywords searched)`
                  : ""}{" "}
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
            onClick={() => { setStatusFilter(opt.value); setNewCandidateIds(new Set()); }}
            className={`text-xs px-3 py-1 rounded-full transition border ${
              statusFilter === opt.value
                ? "bg-[#1C1C1C] border-[#1C1C1C] text-white"
                : "bg-white border-gray-200 text-gray-500 hover:border-gray-400"
            }`}
          >
            {opt.label}
          </button>
        ))}
        <span className="text-sm font-semibold ml-auto text-gray-700">
          📊 {totalCount} candidates (page {page + 1}/{Math.max(1, Math.ceil(totalCount / PAGE_SIZE))})
        </span>
      </div>

      {/* Candidates Table */}
      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : candidates.length === 0 ? (
        <p className="text-gray-400">
          No candidates found. Run a search to discover candidates.
        </p>
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
                <React.Fragment key={c.id}>
                  <tr
                    className="hover:bg-gray-50 transition border-b border-gray-200 cursor-pointer"
                    onClick={() => toggleExpanded(c.id)}
                  >
                    <td className="py-2.5 px-4">
                      <span className="font-medium text-gray-900">
                        {c.full_name}
                      </span>
                      <span className="ml-1.5 inline-flex gap-1 items-center">
                        {(() => {
                          const linkedinUrl = c.profile_url?.includes("linkedin.com") ? c.profile_url : null;
                          const githubUrl = c.github_url || (c.profile_url?.includes("github.com") ? c.profile_url : null);
                          return (
                            <>
                              {linkedinUrl && (
                                <a href={linkedinUrl} target="_blank" rel="noopener noreferrer"
                                  className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded hover:bg-blue-200 transition"
                                  onClick={(e) => e.stopPropagation()} title="Open LinkedIn">
                                  🔗 LinkedIn
                                </a>
                              )}
                              {githubUrl && (
                                <a href={githubUrl} target="_blank" rel="noopener noreferrer"
                                  className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded hover:bg-purple-200 transition"
                                  onClick={(e) => e.stopPropagation()} title="Open GitHub">
                                  🐙 GitHub
                                </a>
                              )}
                              {!linkedinUrl && !githubUrl && c.profile_url && (
                                <a href={c.profile_url} target="_blank" rel="noopener noreferrer"
                                  className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-200 transition"
                                  onClick={(e) => e.stopPropagation()}>
                                  🔗 Profile
                                </a>
                              )}
                            </>
                          );
                        })()}
                      </span>
                      {newCandidateIds.has(c.id) && (
                        <span className="ml-1 text-[10px] bg-green-100 text-green-700 px-1.5 rounded font-semibold">
                          New
                        </span>
                      )}
                      {Number(c.search_count) > 1 && (
                        <span className="ml-1 text-[10px] bg-purple-100 text-purple-600 px-1.5 rounded">
                          {c.search_count}x seen
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 max-w-xs truncate text-gray-500">
                      {c.headline}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-gray-400">
                      {c.location}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`font-mono text-xs px-2 py-0.5 rounded cursor-help ${
                          c.score >= 8
                            ? "bg-green-100 text-green-700"
                            : c.score >= 6
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-500"
                        }`}
                        onMouseEnter={(e) => {
                          if (!c.score_breakdown) return;
                          try {
                            const bd = JSON.parse(c.score_breakdown);
                            setScoreTooltip({ bd, x: e.clientX, y: e.clientY });
                          } catch {}
                        }}
                        onMouseLeave={() => setScoreTooltip(null)}
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
                    <td
                      className="py-2.5 px-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex gap-1 items-center">
                        {/* Quick status change dropdown */}
                        <select
                          value={c.status}
                          onChange={(e) => markOutreach(c.id, e.target.value)}
                          className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 bg-white text-gray-700 outline-none focus:border-[#2A72E5] cursor-pointer"
                        >
                          <option value="discovered">Discovered</option>
                          <option value="outreach">Outreach</option>
                          <option value="contacted">Contacted</option>
                          <option value="responded">Responded</option>
                          <option value="rejected">Rejected</option>
                        </select>
                        {/* Outreach modal button */}
                        {(c.status === "discovered" || c.status === "outreach") && (
                          <button
                            onClick={() => openOutreachModal(c)}
                            className="text-[10px] bg-[#2A72E5] hover:bg-[#1E5FCC] px-2 py-0.5 rounded text-white"
                          >
                            📨
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {/* Expanded row with outreach history */}
                  {expandedCandidate === c.id && (
                    <tr key={`${c.id}-expanded`}>
                      <td colSpan={7} className="bg-gray-50 px-6 py-4">
                        <div className="text-xs text-gray-600">
                          {/* Candidate meta info */}
                          <div className="flex flex-wrap gap-4 mb-3 text-gray-400">
                            {c.first_seen_at && (
                              <span>First seen: {new Date(c.first_seen_at).toLocaleDateString()}</span>
                            )}
                            {c.last_searched_at && (
                              <span>Last searched: {new Date(c.last_searched_at).toLocaleDateString()}</span>
                            )}
                            {Number(c.search_count) > 0 && (
                              <span>Search count: {c.search_count}</span>
                            )}
                            {c.source && (
                              <span>Source: {c.source}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-gray-700">
                              📋 Outreach History
                            </span>
                            {c.notes && (
                              <span className="text-gray-400">
                                Notes: {c.notes}
                              </span>
                            )}
                          </div>
                          {outreachHistory[c.id] &&
                          outreachHistory[c.id].length > 0 ? (
                            <div className="space-y-2">
                              {outreachHistory[c.id].map((h) => (
                                <div
                                  key={h.id}
                                  className="bg-white rounded-lg border border-gray-200 p-3"
                                >
                                  <div className="flex items-center gap-3 mb-1">
                                    <span className="font-medium text-gray-700">
                                      {h.template_used || "Custom"}
                                    </span>
                                    <span className="text-gray-400">
                                      via {h.channel}
                                    </span>
                                    <span className="text-gray-400">
                                      {new Date(
                                        h.sent_at + "Z"
                                      ).toLocaleDateString()}
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                                        h.status === "replied"
                                          ? "bg-green-100 text-green-700"
                                          : h.status === "no_response"
                                            ? "bg-red-100 text-red-700"
                                            : "bg-blue-100 text-blue-700"
                                      }`}
                                    >
                                      {h.status}
                                    </span>
                                  </div>
                                  <pre className="text-[11px] text-gray-500 whitespace-pre-wrap font-mono mt-1 max-h-32 overflow-y-auto">
                                    {h.message_sent}
                                  </pre>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-400">
                              No outreach messages sent yet.
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="px-3 py-1.5 rounded text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-30">
            ← Prev
          </button>
          {Array.from({ length: Math.ceil(totalCount / PAGE_SIZE) }, (_, i) => (
            <button key={i} onClick={() => setPage(i)}
              className={`px-3 py-1.5 rounded text-sm font-medium ${i === page ? "bg-[#1C1C1C] text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
              {i + 1}
            </button>
          ))}
          <button onClick={() => setPage(p => Math.min(Math.ceil(totalCount / PAGE_SIZE) - 1, p + 1))} disabled={page >= Math.ceil(totalCount / PAGE_SIZE) - 1}
            className="px-3 py-1.5 rounded text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-30">
            Next →
          </button>
        </div>
      )}

      {/* Score Tooltip */}
      {scoreTooltip && (
        <div
          className="fixed z-[9999] w-56 p-3 bg-gray-900 text-white text-[11px] rounded-lg shadow-xl pointer-events-none"
          style={{ left: scoreTooltip.x - 112, top: scoreTooltip.y - 10, transform: "translateY(-100%)" }}
        >
          <div className="font-semibold mb-1.5 text-xs">Score Breakdown</div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>🎯 Domain Alignment</span>
              <span className="font-mono">{scoreTooltip.bd.alignment ?? 0}/3.5</span>
            </div>
            {scoreTooltip.bd.alignment_terms?.length > 0 && (
              <div className="text-gray-400 pl-4 text-[10px]">{scoreTooltip.bd.alignment_terms.join(", ")}</div>
            )}
            <div className="flex justify-between">
              <span>⚡ Execution</span>
              <span className="font-mono">{scoreTooltip.bd.execution ?? 0}/{scoreTooltip.bd.base <= 2.5 ? "2.5" : "2.0"}</span>
            </div>
            {scoreTooltip.bd.languages?.length > 0 && (
              <div className="text-gray-400 pl-4 text-[10px]">{scoreTooltip.bd.languages.join(", ")}</div>
            )}
            <div className="flex justify-between">
              <span>📞 Contactability</span>
              <span className="font-mono">{scoreTooltip.bd.contactability ?? 0}/1.5</span>
            </div>
            <div className="flex justify-between border-t border-gray-700 pt-1 mt-1 font-semibold">
              <span>Total</span>
              <span className="font-mono">{scoreTooltip.bd.total}/10</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
