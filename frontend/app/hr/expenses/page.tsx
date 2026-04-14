"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(Math.round(n));
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

const categories = ["출장비", "장비", "교통비", "식비", "소프트웨어", "교육", "기타"];

interface Expense {
  id: number; member_id: number; name: string; role: string;
  year: number; month: number; amount_usdt: number; category: string;
  description: string; tx_hash: string; status: string; expense_date: string;
}

const emptyForm = { member_id: 0, year: currentYear, month: currentMonth, amount_usdt: 0, category: "기타", description: "", tx_hash: "", status: "pending", expense_date: "" };

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState<number | null>(currentMonth);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const loadExpenses = () => {
    const q = month ? `year=${year}&month=${month}` : `year=${year}`;
    fetch(`/api/hr/expenses?${q}`).then(r => r.json()).then(setExpenses).catch(() => {});
  };
  const loadMembers = () => fetch("/api/hr/members?active=1").then(r => r.json()).then(setMembers).catch(() => {});

  useEffect(() => { loadMembers(); }, []);
  useEffect(() => { loadExpenses(); }, [year, month]);

  const handleSave = async () => {
    if (!form.member_id || !form.amount_usdt) return alert("팀원과 금액을 입력하세요.");
    setSaving(true);
    if (editingId) {
      await fetch(`/api/hr/expenses/${editingId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_usdt: Number(form.amount_usdt), category: form.category, description: form.description, tx_hash: form.tx_hash, status: form.status, expense_date: form.expense_date }),
      });
    } else {
      await fetch("/api/hr/expenses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount_usdt: Number(form.amount_usdt), member_id: Number(form.member_id) }),
      });
    }
    setShowForm(false); setEditingId(null); setForm(emptyForm);
    setSaving(false); await loadExpenses();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("이 경비 항목을 삭제하시겠습니까?")) return;
    await fetch(`/api/hr/expenses/${id}`, { method: "DELETE" });
    await loadExpenses();
  };

  const startEdit = (e: Expense) => {
    setForm({ member_id: e.member_id, year: e.year, month: e.month, amount_usdt: e.amount_usdt, category: e.category, description: e.description, tx_hash: e.tx_hash, status: e.status, expense_date: e.expense_date });
    setEditingId(e.id); setShowForm(true);
  };

  const totalUsdt = expenses.reduce((s, e) => s + e.amount_usdt, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">경비 정산</h1>
      <p className="text-sm mb-6 text-gray-400">{year}년 경비 정산 현황</p>

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 focus:outline-none focus:border-[#2A72E5]">
            {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <div className="flex gap-1">
            <button onClick={() => setMonth(null)}
              className={`px-3 py-1.5 rounded text-xs font-medium ${!month ? 'bg-[#2A72E5] text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
              전체
            </button>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
              <button key={m} onClick={() => setMonth(m)}
                className={`px-3 py-1.5 rounded text-xs font-medium ${m === month ? 'bg-[#2A72E5] text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                {m}월
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.open(`/api/hr/expenses/download?year=${year}${month ? `&month=${month}` : ""}`, "_blank")}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50">
            다운로드
          </button>
          <button onClick={() => { setForm({ ...emptyForm, year, month: month || currentMonth }); setEditingId(null); setShowForm(true); }}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#2A72E5] hover:bg-[#1E5FCC]">
            + 경비 추가
          </button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden bg-white border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-3 text-gray-400">팀원</th>
              <th className="text-left p-3 text-gray-400">발생일</th>
              <th className="text-left p-3 text-gray-400">카테고리</th>
              <th className="text-left p-3 text-gray-400">내용</th>
              <th className="text-right p-3 text-gray-400">금액 (USDT)</th>
              <th className="text-left p-3 text-gray-400">TX Hash</th>
              <th className="text-right p-3 text-gray-400">상태</th>
              <th className="text-right p-3 text-gray-400"></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map(e => (
              <tr key={e.id} className="border-t border-gray-100">
                <td className="p-3">
                  <div className="font-medium">{e.name}</div>
                  <div className="text-xs text-gray-400">{e.role}</div>
                </td>
                <td className="p-3 text-gray-500">{e.expense_date || `${e.year}.${String(e.month).padStart(2, "0")}`}</td>
                <td className="p-3">
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{e.category}</span>
                </td>
                <td className="p-3 text-gray-500 text-xs">{e.description || "-"}</td>
                <td className="text-right p-3 font-semibold">{fmt(e.amount_usdt)}</td>
                <td className="p-3 font-mono text-xs">
                  {e.tx_hash ? (
                    <a href={`https://etherscan.io/tx/${e.tx_hash}`} target="_blank" rel="noopener noreferrer"
                      className="text-blue-500 hover:underline">{e.tx_hash.slice(0, 12)}...</a>
                  ) : <span className="text-gray-300">-</span>}
                </td>
                <td className="text-right p-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    e.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                    e.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'}`}>
                    {e.status === 'paid' ? '지급완료' : e.status === 'approved' ? '승인' : '대기'}
                  </span>
                </td>
                <td className="text-right p-3">
                  <button onClick={() => startEdit(e)} className="text-xs text-blue-500 hover:underline mr-2">수정</button>
                  <button onClick={() => handleDelete(e.id)} className="text-xs text-red-500 hover:underline">삭제</button>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-gray-400">경비 정산 내역이 없습니다</td></tr>
            )}
          </tbody>
          {expenses.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 font-semibold">
                <td className="p-3" colSpan={4}>합계 ({expenses.length}건)</td>
                <td className="text-right p-3">{fmt(totalUsdt)} USDT</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* 경비 추가/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => { setShowForm(false); setEditingId(null); }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editingId ? "경비 수정" : "경비 추가"}</h2>
            <div className="grid grid-cols-2 gap-3">
              {!editingId && (
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 mb-1 block">팀원</label>
                  <select value={form.member_id} onChange={e => setForm({ ...form, member_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]">
                    <option value={0}>선택하세요</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">발생일</label>
                <input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">금액 (USDT)</label>
                <input type="number" step="0.01" value={form.amount_usdt} onChange={e => setForm({ ...form, amount_usdt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">카테고리</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]">
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">상태</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]">
                  <option value="pending">대기</option>
                  <option value="approved">승인</option>
                  <option value="paid">지급완료</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 mb-1 block">내용</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]"
                  placeholder="예: 서버 장비 구매" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 mb-1 block">TX Hash (급여와 동일 TX 가능)</label>
                <input value={form.tx_hash} onChange={e => setForm({ ...form, tx_hash: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:border-[#2A72E5]"
                  placeholder="0x..." />
              </div>
              {!editingId && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">연도</label>
                    <input type="number" value={form.year} onChange={e => setForm({ ...form, year: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">월</label>
                    <select value={form.month} onChange={e => setForm({ ...form, month: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]">
                      {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>{i + 1}월</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { setShowForm(false); setEditingId(null); }}
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
