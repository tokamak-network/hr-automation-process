"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(Math.round(n));
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

interface Payroll {
  id: number; member_id: number; year: number; month: number;
  usdt_amount: number; krw_rate: number; krw_amount: number;
  tax_simulated: number; net_pay_krw: number; status: string;
}

const emptyPayroll = { year: currentYear, month: currentMonth, pay_date: "", usdt_amount: 0, krw_rate: 0, krw_amount: 0, tax_simulated: 0, net_pay_krw: 0, status: "paid", rate_date: "" };

export default function MemberDetail() {
  const { id } = useParams();
  const [member, setMember] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // payroll states
  const [showPayrollForm, setShowPayrollForm] = useState(false);
  const [payrollForm, setPayrollForm] = useState<any>(emptyPayroll);
  const [editingPayroll, setEditingPayroll] = useState<number | null>(null);
  const [payrollSaving, setPayrollSaving] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [rateLoading, setRateLoading] = useState(false);

  const load = () => fetch(`/api/hr/members/${id}`).then(r => r.json()).then(d => { setMember(d); setForm(d); }).catch(() => {});
  useEffect(() => { load(); }, [id]);

  // member info save
  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/hr/members/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, github: form.github, role: form.role, monthly_usdt: Number(form.monthly_usdt), wallet_address: form.wallet_address, contract_start: form.contract_start }),
    });
    await load(); setEditing(false); setSaving(false);
  };
  const handleCancel = () => { setForm(member); setEditing(false); };

  // pay_date change → fetch prev-day closing rate → trigger full recalc
  const handlePayDateChange = async (dateVal: string) => {
    const next = { ...payrollForm, pay_date: dateVal };
    setPayrollForm(next);
    if (!dateVal) return;
    setRateLoading(true);
    try {
      const res = await fetch(`/api/hr/exchange-rate/prev-day?date=${dateVal}`);
      if (res.ok) {
        const data = await res.json();
        const rate = data.rate;
        const usdt = Number(next.usdt_amount) || 0;
        const krw = Math.round(usdt * rate);
        next.krw_rate = rate;
        next.rate_date = data.date;
        next.krw_amount = krw;
        if (krw > 0) {
          try {
            const taxRes = await fetch("/api/hr/tax/calculate", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ monthly_income: krw }),
            });
            const taxData = await taxRes.json();
            next.tax_simulated = Math.round(taxData.total_tax_100 ?? 0);
            next.net_pay_krw = krw - next.tax_simulated;
          } catch { next.net_pay_krw = krw; }
        } else {
          next.tax_simulated = 0; next.net_pay_krw = 0;
        }
        setPayrollForm({ ...next });
      }
    } catch { /* ignore */ }
    setRateLoading(false);
  };

  // payroll auto-calc: USDT or rate changes → recalc KRW, tax, net_pay
  const updatePayrollField = async (key: string, val: string) => {
    const next = { ...payrollForm, [key]: val };
    const usdt = Number(key === "usdt_amount" ? val : next.usdt_amount) || 0;
    const rate = Number(key === "krw_rate" ? val : next.krw_rate) || 0;

    if (key === "usdt_amount" || key === "krw_rate") {
      const krw = Math.round(usdt * rate);
      next.krw_amount = krw;
      // auto-calc tax from API
      if (krw > 0) {
        try {
          const res = await fetch(`/api/hr/tax/calculate`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ monthly_income: krw }),
          });
          const data = await res.json();
          const tax = data.total_tax_100 ?? 0;
          next.tax_simulated = Math.round(tax);
          next.net_pay_krw = krw - Math.round(tax);
        } catch {
          next.net_pay_krw = krw - (Number(next.tax_simulated) || 0);
        }
      } else {
        next.tax_simulated = 0;
        next.net_pay_krw = 0;
      }
    }
    if (key === "tax_simulated") {
      const krw = Number(next.krw_amount) || 0;
      next.net_pay_krw = krw - (Number(val) || 0);
    }
    if (key === "krw_amount") {
      const krw = Number(val) || 0;
      next.net_pay_krw = krw - (Number(next.tax_simulated) || 0);
    }
    setPayrollForm(next);
  };

  // payroll CRUD
  const handlePayrollSave = async () => {
    setPayrollSaving(true);
    if (editingPayroll) {
      await fetch(`/api/hr/payroll/${editingPayroll}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usdt_amount: Number(payrollForm.usdt_amount), krw_rate: Number(payrollForm.krw_rate), krw_amount: Number(payrollForm.krw_amount), tax_simulated: Number(payrollForm.tax_simulated), net_pay_krw: Number(payrollForm.net_pay_krw), status: payrollForm.status }),
      });
    } else {
      await fetch("/api/hr/payroll/add", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: Number(id), year: Number(payrollForm.year), month: Number(payrollForm.month), usdt_amount: Number(payrollForm.usdt_amount), krw_rate: Number(payrollForm.krw_rate), krw_amount: Number(payrollForm.krw_amount), tax_simulated: Number(payrollForm.tax_simulated), net_pay_krw: Number(payrollForm.net_pay_krw), status: payrollForm.status }),
      });
    }
    setShowPayrollForm(false); setEditingPayroll(null); setPayrollForm(emptyPayroll);
    setPayrollSaving(false); await load();
  };

  const handlePayrollDelete = async (pid: number) => {
    if (!confirm("이 급여 이력을 삭제하시겠습니까?")) return;
    await fetch(`/api/hr/payroll/${pid}`, { method: "DELETE" });
    await load();
  };

  const startEditPayroll = (p: Payroll) => {
    setPayrollForm({ year: p.year, month: p.month, usdt_amount: p.usdt_amount, krw_rate: p.krw_rate, krw_amount: p.krw_amount, tax_simulated: p.tax_simulated, net_pay_krw: p.net_pay_krw, status: p.status });
    setEditingPayroll(p.id); setShowPayrollForm(true);
  };

  // auto-generate from tax simulation (April onwards)
  const handleAutoGenerate = async () => {
    if (!member) return;
    const targetMonth = currentMonth;
    const existing = member.payrolls?.find((p: any) => p.year === currentYear && p.month === targetMonth);
    if (existing) return alert(`${currentYear}년 ${targetMonth}월 급여 이력이 이미 존재합니다.`);

    setAutoLoading(true);
    try {
      // fetch exchange rate
      const rateRes = await fetch("/api/hr/usdt-rate");
      const rateData = await rateRes.json();
      const krwRate = rateData.rate || 1350;

      const usdt = member.monthly_usdt;
      const krwAmount = Math.round(usdt * krwRate);

      // fetch tax simulation
      const taxRes = await fetch(`/api/hr/tax/simulate/${id}?year=${currentYear}`);
      const taxData = await taxRes.json();
      const monthlyTax = taxData.monthly_burden?.monthly_100 || 0;

      const netPay = krwAmount - monthlyTax;

      setPayrollForm({ year: currentYear, month: targetMonth, usdt_amount: usdt, krw_rate: Math.round(krwRate * 100) / 100, krw_amount: krwAmount, tax_simulated: Math.round(monthlyTax), net_pay_krw: Math.round(netPay), status: "estimated" });
      setEditingPayroll(null); setShowPayrollForm(true);
    } catch { alert("자동 생성에 실패했습니다."); }
    setAutoLoading(false);
  };

  if (!member) return <div className="text-center py-20 text-gray-400">Loading...</div>;

  return (
    <div>
      <Link href="/hr/members" className="text-sm mb-4 inline-block text-[#2A72E5]">&larr; 팀원 목록</Link>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold bg-[#2A72E5] text-white">
            {(editing ? form.name : member.name)?.[0] || "?"}
          </div>
          <div>
            {editing ? (
              <>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="text-2xl font-bold border-b-2 border-[#2A72E5] outline-none bg-transparent w-60" />
                <input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                  className="block text-gray-500 border-b border-gray-300 outline-none bg-transparent mt-1 text-sm w-60" placeholder="직책" />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{member.name}</h1>
                  {member.is_active === 0 && <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-500">퇴직</span>}
                </div>
                <p className="text-gray-500">{member.role} · @{member.github}</p>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={handleCancel} className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#2A72E5] hover:bg-[#1E5FCC] disabled:opacity-50">
                {saving ? "저장 중..." : "저장"}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50">
              정보 수정
            </button>
          )}
        </div>
      </div>

      <div className={`grid ${member.contract_end ? "grid-cols-4" : "grid-cols-3"} gap-4 mb-6`}>
        <div className="rounded-xl p-4 bg-white border border-gray-200">
          <div className="text-xs mb-1 text-gray-400">월 급여</div>
          {editing ? (
            <input type="number" value={form.monthly_usdt} onChange={e => setForm({ ...form, monthly_usdt: e.target.value })}
              className="text-xl font-bold text-[#2A72E5] border-b-2 border-[#2A72E5] outline-none bg-transparent w-full" />
          ) : (
            <div className="text-xl font-bold text-[#2A72E5]">{fmt(member.monthly_usdt)} USDT</div>
          )}
        </div>
        <div className="rounded-xl p-4 bg-white border border-gray-200">
          <div className="text-xs mb-1 text-gray-400">계약 시작일</div>
          {editing ? (
            <input type="date" value={form.contract_start} onChange={e => setForm({ ...form, contract_start: e.target.value })}
              className="text-xl font-bold border-b-2 border-[#2A72E5] outline-none bg-transparent w-full" />
          ) : (
            <div className="text-xl font-bold">{member.contract_start}</div>
          )}
        </div>
        {member.contract_end && (
          <div className="rounded-xl p-4 bg-white border border-gray-200">
            <div className="text-xs mb-1 text-gray-400">퇴직일</div>
            <div className="text-xl font-bold text-gray-400">{member.contract_end}</div>
          </div>
        )}
        <div className="rounded-xl p-4 bg-white border border-gray-200">
          <div className="text-xs mb-1 text-gray-400">지갑 주소</div>
          {editing ? (
            <input value={form.wallet_address} onChange={e => setForm({ ...form, wallet_address: e.target.value })}
              className="text-sm font-mono border-b-2 border-[#2A72E5] outline-none bg-transparent w-full" placeholder="0x..." />
          ) : (
            <div className="text-sm font-mono truncate">{member.wallet_address}</div>
          )}
        </div>
      </div>

      {editing && (
        <div className="rounded-xl p-4 mb-6 bg-white border border-gray-200">
          <div className="text-xs mb-1 text-gray-400">GitHub</div>
          <input value={form.github} onChange={e => setForm({ ...form, github: e.target.value })}
            className="text-sm font-mono border-b-2 border-[#2A72E5] outline-none bg-transparent w-full" placeholder="github-username" />
        </div>
      )}

      {/* 급여 이력 */}
      <div className="rounded-xl p-5 mb-6 bg-white border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">급여 이력</h2>
          <div className="flex gap-2">
            <button onClick={handleAutoGenerate} disabled={autoLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50">
              {autoLoading ? "계산 중..." : `${currentMonth}월 자동 생성`}
            </button>
            <button onClick={() => { setPayrollForm(emptyPayroll); setEditingPayroll(null); setShowPayrollForm(true); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[#2A72E5] hover:bg-[#1E5FCC]">
              + 수동 입력
            </button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400">
              <th className="text-left pb-3">기간</th><th className="text-right pb-3">USDT</th>
              <th className="text-right pb-3">환율</th><th className="text-right pb-3">KRW</th>
              <th className="text-right pb-3">세금 (KRW/USD)</th><th className="text-right pb-3">실지급 (KRW/USD)</th>
              <th className="text-right pb-3">상태</th><th className="text-right pb-3"></th>
            </tr>
          </thead>
          <tbody>
            {member.payrolls?.map((p: any) => (
              <tr key={p.id} className="border-t border-gray-100">
                <td className="py-2.5">{p.year}.{String(p.month).padStart(2, "0")}</td>
                <td className="text-right">{fmt(p.usdt_amount)}</td>
                <td className="text-right text-gray-400">{fmt(p.krw_rate)}</td>
                <td className="text-right">&#8361;{fmt(p.krw_amount)}</td>
                <td className="text-right text-amber-600">
                  <div>&#8361;{fmt(p.tax_simulated)}</div>
                  <div className="text-xs text-gray-400">${p.krw_rate ? fmt(p.tax_simulated / p.krw_rate) : "-"}</div>
                </td>
                <td className="text-right font-semibold">
                  <div>&#8361;{fmt(p.net_pay_krw)}</div>
                  <div className="text-xs text-gray-400 font-normal">${p.krw_rate ? fmt(p.net_pay_krw / p.krw_rate) : "-"}</div>
                </td>
                <td className="text-right">
                  <span className={`text-xs px-2 py-0.5 rounded ${p.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : p.status === 'confirmed' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                    {p.status === 'paid' ? '지급완료' : p.status === 'confirmed' ? '확정' : '예상'}
                  </span>
                </td>
                <td className="text-right">
                  <button onClick={() => startEditPayroll(p)} className="text-xs text-blue-500 hover:underline mr-2">수정</button>
                  <button onClick={() => handlePayrollDelete(p.id)} className="text-xs text-red-500 hover:underline">삭제</button>
                </td>
              </tr>
            ))}
            {(!member.payrolls || member.payrolls.length === 0) && (
              <tr><td colSpan={8} className="py-8 text-center text-gray-400">급여 이력이 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 급여 입력/수정 모달 */}
      {showPayrollForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => { setShowPayrollForm(false); setEditingPayroll(null); }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editingPayroll ? "급여 이력 수정" : "급여 이력 추가"}</h2>
            <div className="grid grid-cols-2 gap-3">
              {!editingPayroll && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">연도</label>
                    <input type="number" value={payrollForm.year} onChange={e => setPayrollForm({ ...payrollForm, year: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">월</label>
                    <select value={payrollForm.month} onChange={e => setPayrollForm({ ...payrollForm, month: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]">
                      {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>{i + 1}월</option>)}
                    </select>
                  </div>
                </>
              )}
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 mb-1 block">지급일</label>
                <div className="flex gap-2 items-center">
                  <input type="date" value={payrollForm.pay_date} onChange={e => handlePayDateChange(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]" />
                  {rateLoading && <span className="text-xs text-gray-400">환율 조회 중...</span>}
                  {payrollForm.rate_date && !rateLoading && <span className="text-xs text-gray-400">{payrollForm.rate_date} 종가 적용</span>}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">USDT 지급액</label>
                <input type="number" value={payrollForm.usdt_amount} onChange={e => updatePayrollField("usdt_amount", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">환율 (KRW/USD){payrollForm.rate_date ? " - 자동" : ""}</label>
                <input type="number" step="0.01" value={payrollForm.krw_rate} onChange={e => updatePayrollField("krw_rate", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">KRW 환산액</label>
                <input type="number" value={payrollForm.krw_amount} onChange={e => updatePayrollField("krw_amount", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5] bg-gray-50" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">세금 (KRW)</label>
                <input type="number" value={payrollForm.tax_simulated} onChange={e => updatePayrollField("tax_simulated", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">실지급 (KRW)</label>
                <input type="number" value={payrollForm.net_pay_krw} onChange={e => updatePayrollField("net_pay_krw", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5] bg-gray-50" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">상태</label>
                <select value={payrollForm.status} onChange={e => setPayrollForm({ ...payrollForm, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]">
                  <option value="estimated">예상</option>
                  <option value="confirmed">확정</option>
                  <option value="paid">지급완료</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { setShowPayrollForm(false); setEditingPayroll(null); }}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-300 hover:bg-gray-50">취소</button>
              <button onClick={handlePayrollSave} disabled={payrollSaving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#2A72E5] hover:bg-[#1E5FCC] disabled:opacity-50">
                {payrollSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 인센티브 섹션 — 일시 중지 (2026-04-01) */}
    </div>
  );
}
