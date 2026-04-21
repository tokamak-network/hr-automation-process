"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Member {
  id: number; name: string; github: string; role: string;
  monthly_usdt: number; wallet_address: string; contract_start: string;
  contract_end?: string; is_active: number;
}

const empty: Omit<Member, "id" | "is_active"> = { name: "", github: "", role: "", monthly_usdt: 0, wallet_address: "", contract_start: "" };

const fields: { key: string; label: string; type?: string; placeholder: string }[] = [
  { key: "name", label: "이름", placeholder: "홍길동" },
  { key: "github", label: "GitHub", placeholder: "github-username" },
  { key: "role", label: "직책", placeholder: "Developer" },
  { key: "monthly_usdt", label: "월급 (USDT)", type: "number", placeholder: "10000" },
  { key: "wallet_address", label: "지갑 주소", placeholder: "0x..." },
  { key: "contract_start", label: "계약 시작일", type: "date", placeholder: "" },
];

type Tab = "active" | "retired";

function MemberModal({ initial, title, onClose, onSave }: {
  initial: any; title: string;
  onClose: () => void; onSave: (data: any) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (key: string, val: string | number) => setForm((prev: any) => ({ ...prev, [key]: val }));

  const submit = async () => {
    if (!form.name.trim()) return alert("이름은 필수입니다.");
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">{title}</h2>
        <div className="space-y-3">
          {fields.map(f => (
            <div key={f.key}>
              <label className="text-xs font-medium text-gray-500 mb-1 block">{f.label}</label>
              <input type={f.type || "text"} placeholder={f.placeholder}
                value={(form as any)[f.key] ?? ""}
                onChange={e => set(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]" />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-300 hover:bg-gray-50">취소</button>
          <button onClick={submit} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#2A72E5] hover:bg-[#1E5FCC] disabled:opacity-50">
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Members() {
  const [tab, setTab] = useState<Tab>("active");
  const [activeMembers, setActiveMembers] = useState<Member[]>([]);
  const [retiredMembers, setRetiredMembers] = useState<Member[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [retireTarget, setRetireTarget] = useState<Member | null>(null);
  const [retireDate, setRetireDate] = useState("");
  const [uploading, setUploading] = useState(false);

  const loadActive = () => fetch("/api/hr/members?active=1").then(r => r.json()).then(setActiveMembers).catch(() => {});
  const loadRetired = () => fetch("/api/hr/members?active=0").then(r => r.json()).then(setRetiredMembers).catch(() => {});
  const loadAll = () => { loadActive(); loadRetired(); };

  useEffect(() => { loadAll(); }, []);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}"을(를) 완전 삭제하시겠습니까?\n관련 급여 데이터도 함께 삭제됩니다.`)) return;
    setDeleting(id);
    await fetch(`/api/hr/members/${id}?permanent=true`, { method: "DELETE" });
    await loadAll();
    setDeleting(null);
  };

  const handleAdd = async (data: any) => {
    await fetch("/api/hr/members", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setShowAdd(false);
    await loadAll();
  };

  const handleRetire = async () => {
    if (!retireTarget || !retireDate) return;
    await fetch(`/api/hr/members/${retireTarget.id}/retire`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contract_end: retireDate }),
    });
    setRetireTarget(null); setRetireDate("");
    await loadAll();
  };

  const handleReinstate = async (id: number, name: string) => {
    if (!confirm(`"${name}"을(를) 복직 처리하시겠습니까?`)) return;
    await fetch(`/api/hr/members/${id}/reinstate`, { method: "POST" });
    await loadAll();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/hr/members/upload", { method: "POST", body: formData });
      const data = await res.json();
      alert(data.message);
      await loadAll();
    } catch { alert("업로드 실패"); }
    setUploading(false);
    e.target.value = "";
  };

  const handleDownload = () => {
    const param = tab === "active" ? "active=1" : "active=0";
    window.open(`/api/hr/members/download?${param}`, "_blank");
  };

  const members = tab === "active" ? activeMembers : retiredMembers;
  const tabStyle = (t: Tab) => tab === t
    ? "bg-[#2A72E5] text-white" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50";

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">팀원 관리</h1>
          <p className="text-sm text-gray-400">재직 {activeMembers.length}명 · 퇴직 {retiredMembers.length}명</p>
        </div>
        <div className="flex gap-2">
          <label className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer">
            {uploading ? "처리 중..." : "가져오기"}
            <input type="file" accept=".xlsx,.xls" onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>
          <button onClick={handleDownload}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50">
            내보내기
          </button>
          {tab === "active" && (
            <>
              <button onClick={() => setShowAdd(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#2A72E5] hover:bg-[#1E5FCC]">
                + 팀원 추가
              </button>
              <button onClick={() => setEditMode(!editMode)}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${editMode ? "bg-gray-500 hover:bg-gray-600" : "bg-red-500 hover:bg-red-600"}`}>
                {editMode ? "완료" : "- 팀원 제거"}
              </button>
            </>
          )}
          {tab === "retired" && (
            <button onClick={() => setEditMode(!editMode)}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${editMode ? "bg-gray-500 hover:bg-gray-600" : "bg-amber-500 hover:bg-amber-600"}`}>
              {editMode ? "완료" : "관리"}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={() => { setTab("active"); setEditMode(false); }} className={`px-4 py-2 rounded-lg text-sm font-medium ${tabStyle("active")}`}>
          재직자 ({activeMembers.length})
        </button>
        <button onClick={() => { setTab("retired"); setEditMode(false); }} className={`px-4 py-2 rounded-lg text-sm font-medium ${tabStyle("retired")}`}>
          퇴직자 ({retiredMembers.length})
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {members.map(m => (
          <div key={m.id} className="relative rounded-xl p-5 hover:shadow-md transition bg-white border border-gray-200">
            {/* 재직자 편집: 퇴직처리 + 삭제 */}
            {tab === "active" && editMode && (
              <div className="absolute top-3 right-3 flex gap-1">
                <button onClick={() => { setRetireTarget(m); setRetireDate(""); }}
                  className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition">
                  퇴직
                </button>
                <button onClick={() => handleDelete(m.id, m.name)} disabled={deleting === m.id}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold bg-red-100 text-red-600 hover:bg-red-500 hover:text-white transition">
                  {deleting === m.id ? "..." : "X"}
                </button>
              </div>
            )}
            {/* 퇴직자 편집: 복직 + 삭제 */}
            {tab === "retired" && editMode && (
              <div className="absolute top-3 right-3 flex gap-1">
                <button onClick={() => handleReinstate(m.id, m.name)}
                  className="px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition">
                  복직
                </button>
                <button onClick={() => handleDelete(m.id, m.name)} disabled={deleting === m.id}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold bg-red-100 text-red-600 hover:bg-red-500 hover:text-white transition">
                  {deleting === m.id ? "..." : "X"}
                </button>
              </div>
            )}
            <Link href={`/hr/members/${m.id}`} className="block cursor-pointer">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-white ${tab === "active" ? "bg-[#2A72E5]" : "bg-gray-400"}`}>
                    {m.name[0]}
                  </div>
                  <div>
                    <h3 className="font-semibold">{m.name}</h3>
                    <p className="text-xs text-gray-400">@{m.github}</p>
                  </div>
                </div>
                {!editMode && <div className="text-sm font-medium text-gray-600">{m.role}</div>}
              </div>
              <div className="mt-3 text-xs text-gray-400">
                {tab === "active"
                  ? `계약 시작: ${m.contract_start || "-"}`
                  : `재직: ${m.contract_start || "?"} ~ ${m.contract_end || "?"}`
                }
              </div>
            </Link>
          </div>
        ))}
        {members.length === 0 && (
          <div className="col-span-2 py-12 text-center text-gray-400">
            {tab === "active" ? "등록된 재직자가 없습니다" : "퇴직자가 없습니다"}
          </div>
        )}
      </div>

      {showAdd && (
        <MemberModal initial={empty} title="팀원 추가" onClose={() => setShowAdd(false)} onSave={handleAdd} />
      )}

      {retireTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setRetireTarget(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{retireTarget.name} 퇴직 처리</h2>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">퇴직일</label>
              <input type="date" value={retireDate} onChange={e => setRetireDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]" />
            </div>
            <p className="text-xs text-gray-400 mt-3">퇴직 처리 시 급여이력은 보존됩니다.</p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setRetireTarget(null)} className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-300 hover:bg-gray-50">취소</button>
              <button onClick={handleRetire} disabled={!retireDate}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50">
                퇴직 처리
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
