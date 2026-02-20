"use client";
import { useState } from "react";

const API = "http://localhost:8001";

export default function SubmitPage() {
  const [form, setForm] = useState({ name: "", email: "", repo_url: "", description: "" });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/candidates/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      setResult(await res.json());
      setForm({ name: "", email: "", repo_url: "", description: "" });
    } catch { setResult({ error: "Failed to submit" }); }
    setLoading(false);
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Submit Candidate</h1>
      <form onSubmit={submit} className="space-y-4">
        {(["name", "email", "repo_url", "description"] as const).map(field => (
          <div key={field}>
            <label className="block text-sm mb-1 capitalize" style={{ color: "var(--color-text-secondary)" }}>{field.replace("_", " ")}</label>
            {field === "description" ? (
              <textarea value={form[field]} onChange={e => setForm({ ...form, [field]: e.target.value })}
                className="w-full rounded px-3 py-2 text-sm outline-none" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", color: "var(--color-text)" }} rows={3} />
            ) : (
              <input value={form[field]} onChange={e => setForm({ ...form, [field]: e.target.value })}
                className="w-full rounded px-3 py-2 text-sm outline-none" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                required type={field === "email" ? "email" : "text"} />
            )}
          </div>
        ))}
        <button type="submit" disabled={loading}
          className="px-4 py-2 rounded text-sm font-medium disabled:opacity-50 text-white hover:brightness-110" style={{ background: "var(--color-primary)" }}>
          {loading ? "Submitting..." : "Submit"}
        </button>
      </form>
      {result && (
        <div className="mt-4 p-3 rounded text-sm" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
          {result.error ? <span className="text-red-400">{result.error}</span> :
            <span className="text-green-400">Submitted! ID: {result.id}. <a href="/" style={{ color: "var(--color-primary)" }} className="underline">View candidates</a></span>}
        </div>
      )}
    </div>
  );
}
