"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Member {
  id: number; name: string; github: string; role: string;
  monthly_usdt: number; wallet_address: string; contract_start: string;
}

const empty: Omit<Member, "id"> = { name: "", github: "", role: "", monthly_usdt: 0, wallet_address: "", contract_start: "" };
const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(Math.round(n));

const fields: { key: keyof Omit<Member, "id">; label: string; type?: string; placeholder: string }[] = [
  { key: "name", label: "이름", placeholder: "홍길동" },
  { key: "github", label: "GitHub", placeholder: "github-username" },
  { key: "role", label: "직책", placeholder: "Developer" },
  { key: "monthly_usdt", label: "월급 (USDT)", type: "number", placeholder: "10000" },
  { key: "wallet_address", label: "지갑 주소", placeholder: "0x..." },
  { key: "contract_start", label: "계약 시작일", type: "date", placeholder: "" },
];

function MemberModal({ initial, title, onClose, onSave }: {
  initial: Omit<Member, "id">; title: string;
  onClose: () => void; onSave: (data: Omit<Member, "id">) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (key: string, val: string | number) => setForm(prev => ({ ...prev, [key]: val }));

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
              <input
                type={f.type || "text"}
                placeholder={f.placeholder}
                value={form[f.key] ?? ""}
                onChange={e => set(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]"
              />
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
  const [members, setMembers] = useState<Member[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = () => fetch("/api/hr/members").then(r => r.json()).then(setMembers).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}" 팀원을 삭제하시겠습니까?\n관련 급여/인센티브 데이터도 함께 삭제됩니다.`)) return;
    setDeleting(id);
    await fetch(`/api/hr/members/${id}?permanent=true`, { method: "DELETE" });
    await load();
    setDeleting(null);
  };

  const handleAdd = async (data: Omit<Member, "id">) => {
    await fetch("/api/hr/members", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setShowAdd(false);
    await load();
  };


  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">팀원 관리</h1>
          <p className="text-sm text-gray-400">총 {members.length}명</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#2A72E5] hover:bg-[#1E5FCC]">
            + 팀원 추가
          </button>
          <button
            onClick={() => setEditMode(!editMode)}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${editMode ? "bg-gray-500 hover:bg-gray-600" : "bg-red-500 hover:bg-red-600"}`}
          >
            {editMode ? "완료" : "- 팀원 제거"}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {members.map(m => (
          <div key={m.id} className="relative rounded-xl p-5 hover:shadow-md transition bg-white border border-gray-200">
            {editMode && (
              <button
                onClick={() => handleDelete(m.id, m.name)}
                disabled={deleting === m.id}
                className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold bg-red-100 text-red-600 hover:bg-red-500 hover:text-white transition"
              >
                {deleting === m.id ? "..." : "X"}
              </button>
            )}
            <Link href={`/hr/members/${m.id}`} className="block cursor-pointer">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold bg-[#2A72E5] text-white">
                      {m.name[0]}
                    </div>
                    <div>
                      <h3 className="font-semibold">{m.name}</h3>
                      <p className="text-xs text-gray-400">@{m.github}</p>
                    </div>
                  </div>
                  <p className="text-sm mt-2 text-gray-500">{m.role}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-[#2A72E5]">{fmt(m.monthly_usdt)} USDT</div>
                  <div className="text-xs font-mono mt-1 text-gray-400">
                    {m.wallet_address?.slice(0, 8)}...{m.wallet_address?.slice(-4)}
                  </div>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-400">계약 시작: {m.contract_start}</div>
            </Link>
          </div>
        ))}
      </div>

      {showAdd && (
        <MemberModal initial={empty} title="팀원 추가" onClose={() => setShowAdd(false)} onSave={handleAdd} />
      )}
    </div>
  );
}
