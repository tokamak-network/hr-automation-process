"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(Math.round(n));

export default function TaxSimulation() {
  const [members, setMembers] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [taxData, setTaxData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/members").then(r => r.json()).then(d => { setMembers(d); if (d.length) setSelectedId(d[0].id); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    fetch(`/api/tax/simulate/${selectedId}?year=2026`).then(r => r.json()).then(setTaxData).catch(() => {});
  }, [selectedId]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">세금 시뮬레이션</h1>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>2026년 근로소득세 시뮬레이션</p>

      <div className="mb-6">
        <label className="text-sm font-medium mb-2 block" style={{ color: "var(--color-text-secondary)" }}>팀원 선택</label>
        <select value={selectedId || ""} onChange={e => setSelectedId(Number(e.target.value))}
          className="px-4 py-2.5 rounded-lg text-sm w-64"
          style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}>
          {members.map(m => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}
        </select>
      </div>

      {taxData && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl p-5" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
              <div className="text-xs mb-1 uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>연간 누적 소득</div>
              <div className="text-2xl font-bold">₩{fmt(taxData.annual_income_krw)}</div>
              <div className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
                급여 ₩{fmt(taxData.payroll_income_krw)} + 인센티브 ₩{fmt(taxData.incentive_income_krw)}
              </div>
            </div>
            <div className="rounded-xl p-5" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
              <div className="text-xs mb-1 uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>예상 총 세액</div>
              <div className="text-2xl font-bold" style={{ color: "var(--color-warning)" }}>₩{fmt(taxData.tax.total_tax)}</div>
              <div className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
                실효세율 {taxData.tax.effective_rate}%
              </div>
            </div>
            <div className="rounded-xl p-5" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
              <div className="text-xs mb-1 uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>적립금 현황</div>
              <div className="text-2xl font-bold" style={{ color: "var(--color-success)" }}>{taxData.reserves.total_tokamak.toFixed(2)} TON</div>
              <div className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>≈ ₩{fmt(taxData.reserves.krw_value)}</div>
            </div>
          </div>

          <div className="rounded-xl p-5" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
            <h2 className="text-lg font-semibold mb-4">근로소득세 계산 내역</h2>
            <div className="space-y-3 text-sm">
              {[
                ["연간 총소득", `₩${fmt(taxData.tax.annual_income_krw)}`],
                ["근로소득공제", `- ₩${fmt(taxData.tax.employment_deduction)}`],
                ["공제 후 소득", `₩${fmt(taxData.tax.after_deduction)}`],
                ["기본공제 (본인)", `- ₩${fmt(taxData.tax.basic_deduction)}`],
                ["과세표준", `₩${fmt(taxData.tax.taxable_income)}`],
                ["적용세율", `${(taxData.tax.applicable_rate * 100).toFixed(0)}%`],
                ["산출세액 (소득세)", `₩${fmt(taxData.tax.income_tax)}`],
                ["지방소득세 (10%)", `₩${fmt(taxData.tax.local_tax)}`],
                ["총 세액", `₩${fmt(taxData.tax.total_tax)}`],
              ].map(([label, value], i) => (
                <div key={i} className={`flex justify-between py-2 ${i === 8 ? 'border-t-2 font-bold' : 'border-t'}`}
                  style={{ borderColor: "var(--color-border)" }}>
                  <span style={{ color: i === 8 ? "var(--color-text)" : "var(--color-text-secondary)" }}>{label}</span>
                  <span style={{ color: i === 8 ? "var(--color-warning)" : "var(--color-text)" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-5" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
            <h2 className="text-lg font-semibold mb-4">월별 세부담 추이</h2>
            <div className="flex items-end gap-2 h-48">
              {taxData.monthly_burden?.map((m: any, i: number) => {
                const maxTax = Math.max(...taxData.monthly_burden.map((b: any) => b.estimated_monthly_tax));
                const h = maxTax > 0 ? (m.estimated_monthly_tax / maxTax * 100) : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>₩{fmt(m.estimated_monthly_tax / 10000)}만</div>
                    <div className="w-full rounded-t" style={{ height: `${Math.max(h, 4)}%`, background: i < 3 ? "var(--color-primary)" : "var(--color-border)" }}></div>
                    <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{m.month}월</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
