"use client";
import { useEffect, useState } from "react";

const CATEGORIES = [
  { key: "financial_statements", label: "재무제표 (BS/PL)" },
  { key: "tax_assessment", label: "세무 (Form C-S / NOA / Tax Comp)" },
  { key: "audit", label: "감사 / 기타" },
];

type Doc = {
  id: number;
  ya: number;
  category: string;
  subcategory: string;
  filename: string;
  file_url: string;
  description: string;
  uploaded_at: string;
  note: string;
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [selectedYa, setSelectedYa] = useState<number | null>(null);
  const [selectedCat, setSelectedCat] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState({ ya: 2025, category: "financial_statements", subcategory: "", description: "", note: "" });

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedYa) params.set("ya", String(selectedYa));
      if (selectedCat) params.set("category", selectedCat);
      const res = await fetch(`/api/accounting/documents?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setDocs(data);
    } catch { /* ignore */ }
  };

  const loadYears = async () => {
    try {
      const res = await fetch("/api/accounting/documents/years");
      if (!res.ok) return;
      const yrs: number[] = await res.json();
      if (Array.isArray(yrs) && yrs.length > 0) setYears(yrs);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadYears(); }, []);
  useEffect(() => { load(); }, [selectedYa, selectedCat]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("ya", String(form.ya));
    fd.append("category", form.category);
    fd.append("subcategory", form.subcategory);
    fd.append("description", form.description || file.name.replace(/\.[^.]+$/, ""));
    fd.append("note", form.note);
    try {
      const res = await fetch("/api/accounting/documents", { method: "POST", body: fd });
      const data = await res.json();
      alert(data.message);
      setShowUpload(false);
      setForm({ ya: 2025, category: "financial_statements", subcategory: "", description: "", note: "" });
      await loadYears();
      await load();
    } catch { alert("업로드 실패"); }
    setUploading(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`/api/accounting/documents/${id}`, { method: "DELETE" });
    await load();
  };

  // Group docs by YA
  const grouped = docs.reduce<Record<number, Doc[]>>((acc, d) => {
    (acc[d.ya] = acc[d.ya] || []).push(d);
    return acc;
  }, {});

  const catLabel = (key: string) => CATEGORIES.find(c => c.key === key)?.label || key;
  const catIcon = (key: string) => key === "financial_statements" ? "📊" : key === "tax_assessment" ? "📋" : "📎";

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">회계 문서 저장소</h1>
          <p className="text-sm text-gray-400">YA별 재무제표, 세무 신고서, 감사 자료 관리</p>
        </div>
        <button onClick={() => setShowUpload(true)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#2A72E5] hover:bg-[#1E5FCC]">
          + 문서 업로드
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setSelectedYa(null)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${!selectedYa ? "bg-[#2A72E5] text-white" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}>
          전체
        </button>
        {(years.length > 0 ? years : Array.from({ length: new Date().getFullYear() + 2 - 2019 }, (_, i) => new Date().getFullYear() + 1 - i)).map(y => (
          <button key={y} onClick={() => setSelectedYa(y)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${selectedYa === y ? "bg-[#2A72E5] text-white" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}>
            YA{y}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setSelectedCat("")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${!selectedCat ? "bg-gray-800 text-white" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}>
          전체 카테고리
        </button>
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setSelectedCat(c.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${selectedCat === c.key ? "bg-gray-800 text-white" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl p-4 bg-white border border-gray-200">
          <div className="text-xs text-gray-400 mb-1">총 문서</div>
          <div className="text-2xl font-bold">{docs.length}</div>
        </div>
        <div className="rounded-xl p-4 bg-white border border-gray-200">
          <div className="text-xs text-gray-400 mb-1">Assessment Years</div>
          <div className="text-2xl font-bold">{Object.keys(grouped).length}</div>
        </div>
        <div className="rounded-xl p-4 bg-white border border-gray-200">
          <div className="text-xs text-gray-400 mb-1">최신 업로드</div>
          <div className="text-sm font-medium text-gray-600">
            {docs.length > 0 ? docs[0].uploaded_at?.split("T")[0] || "-" : "-"}
          </div>
        </div>
      </div>

      {/* Document list grouped by YA */}
      {Object.keys(grouped).length === 0 && (
        <div className="text-center py-16 text-gray-400">
          문서가 없습니다. 위 버튼으로 업로드하세요.
        </div>
      )}

      {Object.entries(grouped)
        .sort(([a], [b]) => Number(b) - Number(a))
        .map(([ya, yaDocs]) => (
          <div key={ya} className="mb-6">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <span className="bg-[#2A72E5] text-white px-2.5 py-0.5 rounded-lg text-sm">YA{ya}</span>
              <span className="text-sm text-gray-400 font-normal">({yaDocs.length}건)</span>
            </h2>
            <div className="rounded-xl overflow-hidden bg-white border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 text-gray-400">카테고리</th>
                    <th className="text-left p-3 text-gray-400">분류</th>
                    <th className="text-left p-3 text-gray-400">파일명</th>
                    <th className="text-left p-3 text-gray-400">설명</th>
                    <th className="text-left p-3 text-gray-400">업로드일</th>
                    <th className="text-right p-3 text-gray-400"></th>
                  </tr>
                </thead>
                <tbody>
                  {yaDocs.map(doc => (
                    <tr key={doc.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="p-3 text-xs">
                        <span className="mr-1">{catIcon(doc.category)}</span>
                        {catLabel(doc.category)}
                      </td>
                      <td className="p-3 text-xs text-gray-500">{doc.subcategory || "-"}</td>
                      <td className="p-3 text-xs">
                        {doc.file_url ? (
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                            className="text-blue-500 hover:underline">{doc.filename}</a>
                        ) : doc.filename}
                      </td>
                      <td className="p-3 text-xs text-gray-500 max-w-[200px] truncate" title={doc.description}>{doc.description || "-"}</td>
                      <td className="p-3 text-xs text-gray-400">{doc.uploaded_at?.split("T")[0] || "-"}</td>
                      <td className="text-right p-3">
                        <button onClick={() => handleDelete(doc.id)} className="text-xs text-red-500 hover:underline">삭제</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowUpload(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">문서 업로드</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Assessment Year (YA)</label>
                <select value={form.ya} onChange={e => setForm({ ...form, ya: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  {Array.from({ length: new Date().getFullYear() + 2 - 2019 }, (_, i) => new Date().getFullYear() + 1 - i).map(y => (
                    <option key={y} value={y}>YA{y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">카테고리</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  {CATEGORIES.map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">세부 분류</label>
                <select value={form.subcategory} onChange={e => setForm({ ...form, subcategory: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">선택</option>
                  <optgroup label="재무제표">
                    <option value="Balance Sheet">Balance Sheet</option>
                    <option value="Profit & Loss">Profit & Loss</option>
                    <option value="Directors Report">Directors Report</option>
                  </optgroup>
                  <optgroup label="세무">
                    <option value="Form C-S">Form C-S</option>
                    <option value="NOA">NOA (Notice of Assessment)</option>
                    <option value="Tax Computation">Tax Computation</option>
                    <option value="ECI">ECI</option>
                  </optgroup>
                  <optgroup label="기타">
                    <option value="AGM Resolution">AGM Resolution</option>
                    <option value="ACRA Filing">ACRA Filing</option>
                    <option value="Fee Schedule">Fee Schedule</option>
                    <option value="Other">Other</option>
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">설명</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="YA2025 Balance Sheet" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 mb-1 block">메모</label>
                <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="비고" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 mb-1 block">파일 (PDF/이미지)</label>
                <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#2A72E5] hover:bg-blue-50/30 transition-colors">
                  <div className="text-center">
                    <div className="text-2xl text-gray-300 mb-1">+</div>
                    <div className="text-xs text-gray-400">{uploading ? "업로드 중..." : "클릭하여 파일 선택"}</div>
                  </div>
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv" onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                    e.target.value = "";
                  }} className="hidden" disabled={uploading} />
                </label>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowUpload(false)} className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-300 hover:bg-gray-50">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
