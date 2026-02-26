"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const API = "http://localhost:8001";

interface Reviewer {
  name: string;
  email: string;
  github: string;
  avatar_url?: string;
  matching_skills: string[];
  match_score: number;
  expertise?: Record<string, number>;
  why?: string;
}

interface MatchResult {
  github_username: string;
  display_name: string;
  match_score: number;
  matched_skills: string[];
  top_repos: { name: string; commits: number; language: string }[];
}

interface MatchData {
  candidate: {
    extracted_skills: Record<string, number>;
  };
  matches: MatchResult[];
  recommended_reviewers: MatchResult[];
}

export default function CandidateDetail() {
  const { id } = useParams();
  const [candidate, setCandidate] = useState<any>(null);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [showAllMatches, setShowAllMatches] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/candidates/${id}`).then(r => r.json()).then(setCandidate);
    fetch(`${API}/api/candidates/${id}/recommended-reviewers`)
      .then(r => r.json())
      .then(data => setReviewers(data.reviewers || []))
      .catch(() => {});
    fetch(`${API}/api/candidates/${id}/match`)
      .then(r => r.json())
      .then(setMatchData)
      .catch(() => {});
  }, [id]);

  if (!candidate) return <p className="text-gray-400">Loading...</p>;

  const scores = candidate.scores || {};
  const trackB = candidate.track_b_evaluation || {};
  const scoreLabels: Record<string, string> = {
    technical_completeness: "Technical Completeness",
    ecosystem_fit: "Ecosystem Fit (2x)",
    tokenomics_impact: "Tokenomics Impact",
    innovation: "Innovation",
    ai_proficiency: "AI Proficiency",
  };

  const trackBColor: Record<string, string> = {
    strong: "text-green-700 bg-green-100",
    adequate: "text-yellow-700 bg-yellow-100",
    weak: "text-red-700 bg-red-100",
  };

  return (
    <div>
      <a href="/" className="text-sm text-gray-400 hover:text-gray-700 transition">← Back</a>
      <h1 className="text-2xl font-bold mt-2 mb-1 text-gray-900">{candidate.name}</h1>
      <p className="text-sm text-gray-500 mb-2">
        {candidate.email} · <a href={candidate.repo_url} className="text-[#2A72E5] hover:underline" target="_blank">{candidate.repo_url}</a>
      </p>
      {candidate.analyzed_by && <p className="text-xs text-gray-400 mb-1">Analyzed by: {candidate.analyzed_by}</p>}
      {candidate.reviewed_by && <p className="text-xs text-gray-400 mb-1">Reviewed by: {candidate.reviewed_by}</p>}

      {candidate.weighted_score != null && (
        <div className="mb-6 mt-4 p-4 rounded-lg border border-blue-200 bg-blue-50">
          <span className="text-sm text-gray-500">Weighted Score (Track B): </span>
          <span className="text-3xl font-bold ml-2 text-[#2A72E5]">{candidate.weighted_score}</span>
          <span className="text-sm text-gray-400"> / 10</span>
        </div>
      )}

      <div className="grid grid-cols-5 gap-3 mb-8">
        {Object.entries(scoreLabels).map(([key, label]) => (
          <div key={key} className="rounded-lg p-4 text-center border border-gray-200 bg-white">
            <div className="text-3xl font-bold text-[#2A72E5]">{scores[key] ?? "-"}</div>
            <div className="text-xs mt-1 text-gray-400">{label}</div>
          </div>
        ))}
      </div>

      {(trackB.problem_definition || trackB.implementation || trackB.deliverable) && (
        <div className="mb-6 rounded-lg p-6 border border-gray-200 bg-white">
          <h2 className="font-semibold mb-3 text-gray-900">🛤 Track B Evaluation</h2>
          <div className="grid grid-cols-3 gap-4 mb-3">
            {[
              { key: "problem_definition", label: "Problem Definition" },
              { key: "implementation", label: "Implementation" },
              { key: "deliverable", label: "Deliverable" },
            ].map(({ key, label }) => (
              <div key={key} className="text-center">
                <div className="text-sm mb-1 text-gray-500">{label}</div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${trackBColor[trackB[key]] || "text-gray-400 bg-gray-100"}`}>
                  {trackB[key] || "-"}
                </span>
              </div>
            ))}
          </div>
          {trackB.track_b_summary && <p className="text-sm mt-3 text-gray-500">{trackB.track_b_summary}</p>}
        </div>
      )}

      {reviewers.length > 0 && (
        <div className="mb-6 rounded-lg p-6 border border-gray-200 bg-white">
          <h2 className="font-semibold mb-3 text-gray-900">👥 Recommended Reviewers</h2>
          <div className="grid grid-cols-3 gap-3">
            {reviewers.map(r => (
              <div key={r.github} className="rounded-lg p-4 border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2 mb-2">
                  {r.avatar_url && <img src={r.avatar_url} alt={r.github} className="w-8 h-8 rounded-full" />}
                  <div>
                    <div className="font-medium text-[#2A72E5]">{r.name}</div>
                    <a href={`https://github.com/${r.github}`} className="text-xs text-gray-400 hover:underline" target="_blank">@{r.github}</a>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {r.matching_skills.map(s => {
                    const score = r.expertise?.[s];
                    const color = score && score >= 0.7 ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700";
                    return (
                      <span key={s} className={`${color} text-xs px-2 py-0.5 rounded`}>
                        {s}{score ? ` ${Math.round(score * 100)}%` : ""}
                      </span>
                    );
                  })}
                </div>
                {r.why && <p className="text-xs italic text-gray-400">{r.why}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {matchData && (
        <div className="mb-6 rounded-lg p-6 border border-gray-200 bg-white">
          <h2 className="font-semibold mb-4 text-gray-900">🎯 Team Matching</h2>
          
          {/* Candidate Skills */}
          <div className="mb-4">
            <h3 className="text-sm text-gray-500 mb-2">Candidate Skills (auto-detected)</h3>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(matchData.candidate.extracted_skills)
                .sort(([,a], [,b]) => b - a)
                .map(([skill, score]) => (
                  <span key={skill} className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    score >= 0.5 ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {skill} {Math.round(score * 100)}%
                  </span>
                ))}
            </div>
          </div>

          {/* Top Matches */}
          <div className="mb-3">
            <h3 className="text-sm text-gray-500 mb-2">Recommended Reviewers</h3>
          </div>
          <div className="space-y-3">
            {(showAllMatches ? matchData.matches.filter(m => m.match_score > 0) : matchData.recommended_reviewers).map((m, i) => (
              <div key={m.github_username} className={`flex items-center gap-4 p-3 rounded-lg border ${
                i === 0 ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-50"
              }`}>
                {/* Rank */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  i === 0 ? "bg-blue-500 text-white" : i === 1 ? "bg-gray-300 text-gray-700" : "bg-gray-200 text-gray-500"
                }`}>
                  {i + 1}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <a href={`https://github.com/${m.github_username}`} target="_blank" rel="noopener noreferrer"
                      className="font-medium text-[#2A72E5] hover:underline">
                      {m.display_name}
                    </a>
                    <span className="text-xs text-gray-400">@{m.github_username}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {m.matched_skills.map(s => (
                      <span key={s} className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                        {s}
                      </span>
                    ))}
                  </div>
                  {m.top_repos.length > 0 && (
                    <div className="text-[10px] text-gray-400 mt-1 truncate">
                      {m.top_repos.map(r => r.name).join(" · ")}
                    </div>
                  )}
                </div>

                {/* Match Score */}
                <div className="text-right shrink-0">
                  <div className={`text-lg font-bold ${
                    m.match_score >= 10 ? "text-green-600" : m.match_score >= 5 ? "text-yellow-600" : "text-gray-400"
                  }`}>
                    {m.match_score}%
                  </div>
                  <div className="text-[10px] text-gray-400">match</div>
                </div>
              </div>
            ))}
          </div>

          {matchData.matches.filter(m => m.match_score > 0).length > 3 && (
            <button
              onClick={() => setShowAllMatches(!showAllMatches)}
              className="mt-3 text-xs text-[#2A72E5] hover:underline"
            >
              {showAllMatches ? "Show top 3 only" : `Show all ${matchData.matches.filter(m => m.match_score > 0).length} matches`}
            </button>
          )}
        </div>
      )}

      {candidate.recommendation && (
        <div className="mb-6 p-4 rounded-lg border border-gray-200 bg-white">
          <span className="text-sm text-gray-400">Recommendation: </span>
          <span className="font-bold text-lg text-gray-900">{candidate.recommendation}</span>
        </div>
      )}

      {candidate.report && (
        <div className="rounded-lg p-6 border border-gray-200 bg-white">
          <h2 className="font-semibold mb-3 text-gray-900">AI Evaluation Report</h2>
          <div className="text-sm whitespace-pre-wrap text-gray-500">{candidate.report}</div>
        </div>
      )}

      {candidate.repo_analysis && (
        <div className="mt-6 rounded-lg p-6 border border-gray-200 bg-white">
          <h2 className="font-semibold mb-3 text-gray-900">Repository Analysis</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-400">Files:</span> {candidate.repo_analysis.file_count}</div>
            <div><span className="text-gray-400">Size:</span> {candidate.repo_analysis.total_size_kb} KB</div>
            <div><span className="text-gray-400">Commits:</span> {candidate.repo_analysis.commit_count}</div>
            <div><span className="text-gray-400">Tests:</span> {candidate.repo_analysis.has_tests ? "Yes" : "No"}</div>
            <div className="col-span-2"><span className="text-gray-400">Languages:</span> {Object.keys(candidate.repo_analysis.languages || {}).join(", ")}</div>
          </div>
        </div>
      )}
    </div>
  );
}
