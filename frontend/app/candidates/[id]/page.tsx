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

export default function CandidateDetail() {
  const { id } = useParams();
  const [candidate, setCandidate] = useState<any>(null);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);

  useEffect(() => {
    fetch(`${API}/api/candidates/${id}`).then(r => r.json()).then(setCandidate);
    fetch(`${API}/api/candidates/${id}/recommended-reviewers`)
      .then(r => r.json())
      .then(data => setReviewers(data.reviewers || []))
      .catch(() => {});
  }, [id]);

  if (!candidate) return <p style={{ color: "var(--color-text-muted)" }}>Loading...</p>;

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
    strong: "text-green-400 bg-green-900/30",
    adequate: "text-yellow-400 bg-yellow-900/30",
    weak: "text-red-400 bg-red-900/30",
  };

  return (
    <div>
      <a href="/" className="text-sm hover:text-white transition" style={{ color: "var(--color-text-muted)" }}>← Back</a>
      <h1 className="text-2xl font-bold mt-2 mb-1">{candidate.name}</h1>
      <p className="text-sm mb-2" style={{ color: "var(--color-text-secondary)" }}>
        {candidate.email} · <a href={candidate.repo_url} className="hover:underline" style={{ color: "var(--color-primary)" }} target="_blank">{candidate.repo_url}</a>
      </p>
      {candidate.analyzed_by && (
        <p className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>Analyzed by: {candidate.analyzed_by}</p>
      )}
      {candidate.reviewed_by && (
        <p className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>Reviewed by: {candidate.reviewed_by}</p>
      )}

      {/* Weighted Score */}
      {candidate.weighted_score != null && (
        <div className="mb-6 mt-4 p-4 rounded-lg" style={{ background: "linear-gradient(135deg, rgba(42, 114, 229, 0.15), rgba(139, 92, 246, 0.15))", border: "1px solid rgba(42, 114, 229, 0.3)" }}>
          <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Weighted Score (Track B): </span>
          <span className="text-3xl font-bold ml-2" style={{ color: "var(--color-primary)" }}>{candidate.weighted_score}</span>
          <span className="text-sm" style={{ color: "var(--color-text-muted)" }}> / 10</span>
        </div>
      )}

      {/* 5 Dimension Scores */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        {Object.entries(scoreLabels).map(([key, label]) => (
          <div key={key} className="rounded-lg p-4 text-center" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
            <div className="text-3xl font-bold" style={{ color: "var(--color-primary)" }}>{scores[key] ?? "-"}</div>
            <div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Track B Evaluation */}
      {(trackB.problem_definition || trackB.implementation || trackB.deliverable) && (
        <div className="mb-6 rounded-lg p-6" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
          <h2 className="font-semibold mb-3">🛤 Track B Evaluation</h2>
          <div className="grid grid-cols-3 gap-4 mb-3">
            {[
              { key: "problem_definition", label: "Problem Definition" },
              { key: "implementation", label: "Implementation" },
              { key: "deliverable", label: "Deliverable" },
            ].map(({ key, label }) => (
              <div key={key} className="text-center">
                <div className="text-sm mb-1" style={{ color: "var(--color-text-secondary)" }}>{label}</div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${trackBColor[trackB[key]] || "text-gray-400"}`}>
                  {trackB[key] || "-"}
                </span>
              </div>
            ))}
          </div>
          {trackB.track_b_summary && (
            <p className="text-sm mt-3" style={{ color: "var(--color-text-secondary)" }}>{trackB.track_b_summary}</p>
          )}
        </div>
      )}

      {/* Recommended Reviewers */}
      {reviewers.length > 0 && (
        <div className="mb-6 rounded-lg p-6" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
          <h2 className="font-semibold mb-3">👥 Recommended Reviewers</h2>
          <div className="grid grid-cols-3 gap-3">
            {reviewers.map(r => (
              <div key={r.github} className="rounded-lg p-4" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
                <div className="flex items-center gap-2 mb-2">
                  {r.avatar_url && (
                    <img src={r.avatar_url} alt={r.github} className="w-8 h-8 rounded-full" />
                  )}
                  <div>
                    <div className="font-medium" style={{ color: "var(--color-primary)" }}>{r.name}</div>
                    <a href={`https://github.com/${r.github}`} className="text-xs hover:underline" style={{ color: "var(--color-text-muted)" }} target="_blank">@{r.github}</a>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {r.matching_skills.map(s => {
                    const score = r.expertise?.[s];
                    const color = score && score >= 0.7 ? "bg-green-900/40 text-green-300" : "bg-blue-900/40 text-blue-300";
                    return (
                      <span key={s} className={`${color} text-xs px-2 py-0.5 rounded`}>
                        {s}{score ? ` ${Math.round(score * 100)}%` : ""}
                      </span>
                    );
                  })}
                </div>
                {r.why && (
                  <p className="text-xs italic" style={{ color: "var(--color-text-muted)" }}>{r.why}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {candidate.recommendation && (
        <div className="mb-6 p-4 rounded-lg" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
          <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>Recommendation: </span>
          <span className="font-bold text-lg">{candidate.recommendation}</span>
        </div>
      )}

      {candidate.report && (
        <div className="rounded-lg p-6" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
          <h2 className="font-semibold mb-3">AI Evaluation Report</h2>
          <div className="text-sm whitespace-pre-wrap" style={{ color: "var(--color-text-secondary)" }}>{candidate.report}</div>
        </div>
      )}

      {candidate.repo_analysis && (
        <div className="mt-6 rounded-lg p-6" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
          <h2 className="font-semibold mb-3">Repository Analysis</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span style={{ color: "var(--color-text-muted)" }}>Files:</span> {candidate.repo_analysis.file_count}</div>
            <div><span style={{ color: "var(--color-text-muted)" }}>Size:</span> {candidate.repo_analysis.total_size_kb} KB</div>
            <div><span style={{ color: "var(--color-text-muted)" }}>Commits:</span> {candidate.repo_analysis.commit_count}</div>
            <div><span style={{ color: "var(--color-text-muted)" }}>Tests:</span> {candidate.repo_analysis.has_tests ? "Yes" : "No"}</div>
            <div className="col-span-2"><span style={{ color: "var(--color-text-muted)" }}>Languages:</span> {Object.keys(candidate.repo_analysis.languages || {}).join(", ")}</div>
          </div>
        </div>
      )}
    </div>
  );
}
