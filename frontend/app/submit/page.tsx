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
            <label className="block text-sm text-gray-400 mb-1 capitalize">{field.replace("_", " ")}</label>
            {field === "description" ? (
              <textarea value={form[field]} onChange={e => setForm({ ...form, [field]: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" rows={3} />
            ) : (
              <input value={form[field]} onChange={e => setForm({ ...form, [field]: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none"
                required={field !== "description"} type={field === "email" ? "email" : "text"} />
            )}
          </div>
        ))}
        <button type="submit" disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm font-medium disabled:opacity-50">
          {loading ? "Submitting..." : "Submit"}
        </button>
      </form>
      {result && (
        <div className="mt-4 p-3 bg-gray-900 rounded text-sm">
          {result.error ? <span className="text-red-400">{result.error}</span> :
            <span className="text-green-400">Submitted! ID: {result.id}. <a href="/" className="text-blue-400 underline">View candidates</a></span>}
        </div>
      )}
    </div>
  );
}
