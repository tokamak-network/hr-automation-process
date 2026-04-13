"use client";
import { useEffect, useState } from "react";

interface Wallet {
  id: number; label: string; address: string; chain: string;
}

export default function Settings() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ label: "", address: "", chain: "ERC-20" });
  const [editing, setEditing] = useState<Wallet | null>(null);
  const [saving, setSaving] = useState(false);

  const loadWallets = () => fetch("/api/hr/wallets").then(r => r.json()).then(setWallets).catch(() => {});
  useEffect(() => { loadWallets(); }, []);

  const handleSave = async () => {
    if (!form.label.trim() || !form.address.trim()) return alert("라벨과 주소를 입력하세요.");
    setSaving(true);
    if (editing) {
      await fetch(`/api/hr/wallets/${editing.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/hr/wallets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setShowAdd(false); setEditing(null);
    setForm({ label: "", address: "", chain: "ERC-20" });
    setSaving(false);
    await loadWallets();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("이 지갑을 삭제하시겠습니까?")) return;
    await fetch(`/api/hr/wallets/${id}`, { method: "DELETE" });
    await loadWallets();
  };

  const startEdit = (w: Wallet) => {
    setForm({ label: w.label, address: w.address, chain: w.chain });
    setEditing(w); setShowAdd(true);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">설정</h1>
      <p className="text-sm mb-6 text-gray-400">시스템 환경 설정</p>

      <div className="space-y-6 max-w-2xl">
        {/* 기본 설정 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 mb-3">기본 설정</h2>
          <div className="space-y-2">
            {[
              { label: "환율 소스", value: "한국은행 ECOS API (전일 종가)", desc: "급여 계산 시 자동 조회" },
              { label: "급여일", value: "매월 마지막 영업일", desc: "주말/공휴일 제외" },
              { label: "세금 기준", value: "2026 간이세액표", desc: "소득세 + 지방소득세 (100%)" },
            ].map((item, i) => (
              <div key={i} className="rounded-xl p-4 flex justify-between items-center bg-white border border-gray-200">
                <div>
                  <div className="font-medium text-sm">{item.label}</div>
                  <div className="text-xs mt-0.5 text-gray-400">{item.desc}</div>
                </div>
                <div className="text-sm font-mono text-[#2A72E5]">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 지갑 관리 */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-semibold text-gray-500">급여 지갑 관리</h2>
            <button onClick={() => { setForm({ label: "", address: "", chain: "ERC-20" }); setEditing(null); setShowAdd(true); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[#2A72E5] hover:bg-[#1E5FCC]">
              + 지갑 추가
            </button>
          </div>
          {wallets.length > 0 ? (
            <div className="space-y-2">
              {wallets.map(w => (
                <div key={w.id} className="rounded-xl p-4 bg-white border border-gray-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{w.label}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">{w.chain}</span>
                      </div>
                      <div className="text-xs font-mono mt-1 text-gray-500">{w.address}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(w)} className="text-xs text-blue-500 hover:underline">수정</button>
                      <button onClick={() => handleDelete(w.id)} className="text-xs text-red-500 hover:underline">삭제</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl p-8 bg-white border border-gray-200 text-center text-gray-400 text-sm">
              등록된 지갑이 없습니다
            </div>
          )}
        </div>
      </div>

      {/* 지갑 추가/수정 모달 */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => { setShowAdd(false); setEditing(null); }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editing ? "지갑 수정" : "지갑 추가"}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">라벨</label>
                <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]"
                  placeholder="예: Jaden 급여 지갑 1" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">지갑 주소</label>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:border-[#2A72E5]"
                  placeholder="0x..." />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">체인</label>
                <select value={form.chain} onChange={e => setForm({ ...form, chain: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]">
                  <option value="ERC-20">ERC-20 (Ethereum)</option>
                  <option value="Titan L2">Titan L2</option>
                  <option value="Polygon">Polygon</option>
                  <option value="Arbitrum">Arbitrum</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { setShowAdd(false); setEditing(null); }}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-300 hover:bg-gray-50">취소</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#2A72E5] hover:bg-[#1E5FCC] disabled:opacity-50">
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
