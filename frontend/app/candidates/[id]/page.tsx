"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const API = "http://localhost:8001";

export default function CandidateDetail() {
  const { id } = useParams();
  const [candidate, setCandidate] = useState<any>(null);

  useEffect(() => {
    fetch(`${API}/api/candidates/${id}`).then(r => r.json()).then(setCandidate);
  }, [id]);

  if (!candidate) return <p className="text-gray-500">Loading...</p>;

  const scores = candidate.scores || {};
  const scoreLabels: Record<string, string> = {
    technical_completeness: "Technical Completeness",
    ecosystem_fit: "Ecosystem Fit",
    tokenomics_impact: "Tokenomics Impact",
    innovation: "Innovation",
    ai_proficiency: "AI Proficiency",
  };

  return (
    <div>
      <a href="/" className="text-sm text-gray-500 hover:text-gray-300">← Back</a>
      <h1 className="text-2xl font-bold mt-2 mb-1">{candidate.name}</h1>
      <p className="text-gray-400 text-sm mb-6">{candidate.email} · <a href={candidate.repo_url} className="text-blue-400 hover:underline" target="_blank">{candidate.repo_url}</a></p>

      <div className="grid grid-cols-5 gap-3 mb-8">
        {Object.entries(scoreLabels).map(([key, label]) => (
          <div key={key} className="bg-gray-900 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-400">{scores[key] ?? "-"}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {candidate.recommendation && (
        <div className="mb-6 p-4 bg-gray-900 rounded-lg">
          <span className="text-sm text-gray-500">Recommendation: </span>
          <span className="font-bold text-lg">{candidate.recommendation}</span>
        </div>
      )}

      {candidate.report && (
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="font-semibold mb-3">AI Evaluation Report</h2>
          <div className="text-gray-300 text-sm whitespace-pre-wrap">{candidate.report}</div>
        </div>
      )}

      {candidate.repo_analysis && (
        <div className="mt-6 bg-gray-900 rounded-lg p-6">
          <h2 className="font-semibold mb-3">Repository Analysis</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Files:</span> {candidate.repo_analysis.file_count}</div>
            <div><span className="text-gray-500">Size:</span> {candidate.repo_analysis.total_size_kb} KB</div>
            <div><span className="text-gray-500">Commits:</span> {candidate.repo_analysis.commit_count}</div>
            <div><span className="text-gray-500">Tests:</span> {candidate.repo_analysis.has_tests ? "Yes" : "No"}</div>
            <div className="col-span-2"><span className="text-gray-500">Languages:</span> {Object.keys(candidate.repo_analysis.languages || {}).join(", ")}</div>
          </div>
        </div>
      )}
    </div>
  );
}
