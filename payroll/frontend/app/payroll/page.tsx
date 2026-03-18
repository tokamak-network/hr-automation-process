"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(Math.round(n));

type Tab = "monthly" | "incentive" | "transactions";

export default function Payroll() {
  const [tab, setTab] = useState<Tab>("monthly");
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [incentives, setIncentives] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [month, setMonth] = useState(3);

  useEffect(() => {
    fetch(`/api/payroll?year=2026&month=${month}`).then(r => r.json()).then(setPayrolls).catch(() => {});
    fetch("/api/incentives?year=2026").then(r => r.json()).then(setIncentives).catch(() => {});
    fetch("/api/transactions").then(r => r.json()).then(setTransactions).catch(() => {});
  }, [month]);

  const tabStyle = (t: Tab) => ({
    background: tab === t ? "var(--color-primary)" : "transparent",
    color: tab === t ? "#fff" : "var(--color-text-secondary)",
    border: tab === t ? "none" : "1px solid var(--color-border)",
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">급여 관리</h1>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>2026년 급여 및 인센티브 현황</p>

      <div className="flex gap-2 mb-6">
        {(["monthly", "incentive", "transactions"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className="px-4 py-2 rounded-lg text-sm font-medium" style={tabStyle(t)}>
            {t === "monthly" ? "월별 급여" : t === "incentive" ? "분기 인센티브" : "트랜잭션"}
          </button>
        ))}
      </div>

      {tab === "monthly" && (
        <div>
          <div className="flex gap-2 mb-4">
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
              <button key={m} onClick={() => setMonth(m)}
                className={`px-3 py-1.5 rounded text-xs font-medium ${m === month ? 'text-white' : ''}`}
                style={{ background: m === month ? "var(--color-primary)" : "var(--color-card)", color: m === month ? "#fff" : "var(--color-text-muted)" }}>
                {m}월
              </button>
            ))}
          </div>
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--color-bg-secondary)" }}>
                  <th className="text-left p-3" style={{ color: "var(--color-text-muted)" }}>팀원</th>
                  <th className="text-right p-3" style={{ color: "var(--color-text-muted)" }}>USDT</th>
                  <th className="text-right p-3" style={{ color: "var(--color-text-muted)" }}>KRW 환산</th>
                  <th className="text-right p-3" style={{ color: "var(--color-text-muted)" }}>세금 시뮬레이션</th>
                  <th className="text-right p-3" style={{ color: "var(--color-text-muted)" }}>실 지급액</th>
                  <th className="text-right p-3" style={{ color: "var(--color-text-muted)" }}>적립금(TON)</th>
                  <th className="text-right p-3" style={{ color: "var(--color-text-muted)" }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {payrolls.map((p, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: "var(--color-border)" }}>
                    <td className="p-3">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{p.role}</div>
                    </td>
                    <td className="text-right p-3 font-semibold">{fmt(p.usdt_amount)}</td>
                    <td className="text-right p-3">₩{fmt(p.krw_amount)}</td>
                    <td className="text-right p-3" style={{ color: "var(--color-warning)" }}>₩{fmt(p.tax_simulated)}</td>
                    <td className="text-right p-3 font-semibold">₩{fmt(p.net_pay_krw)}</td>
                    <td className="text-right p-3" style={{ color: "var(--color-text-secondary)" }}>{p.reserve_tokamak?.toFixed(2)}</td>
                    <td className="text-right p-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        p.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 
                        p.status === 'confirmed' ? 'bg-blue-500/20 text-blue-400' : 
                        'bg-yellow-500/20 text-yellow-400'}`}>
                        {p.status === 'paid' ? '지급완료' : p.status === 'confirmed' ? '확정' : '예상'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {payrolls.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 font-semibold" style={{ borderColor: "var(--color-border)" }}>
                    <td className="p-3">합계</td>
                    <td className="text-right p-3">{fmt(payrolls.reduce((s,p) => s + p.usdt_amount, 0))}</td>
                    <td className="text-right p-3">₩{fmt(payrolls.reduce((s,p) => s + p.krw_amount, 0))}</td>
                    <td className="text-right p-3" style={{ color: "var(--color-warning)" }}>₩{fmt(payrolls.reduce((s,p) => s + p.tax_simulated, 0))}</td>
                    <td className="text-right p-3">₩{fmt(payrolls.reduce((s,p) => s + p.net_pay_krw, 0))}</td>
                    <td className="text-right p-3">{payrolls.reduce((s,p) => s + (p.reserve_tokamak||0), 0).toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {tab === "incentive" && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--color-bg-secondary)" }}>
                <th className="text-left p-3" style={{ color: "var(--color-text-muted)" }}>팀원</th>
                <th className="text-right p-3" style={{ color: "var(--color-text-muted)" }}>분기</th>
                <th className="text-right p-3" style={{ color: "var(--color-text-muted)" }}>TOKAMAK</th>
                <th className="text-right p-3" style={{ color: "var(--color-text-muted)" }}>KRW 환산</th>
                <th className="text-right p-3" style={{ color: "var(--color-text-muted)" }}>업비트 종가</th>
                <th className="text-right p-3" style={{ color: "var(--color-text-muted)" }}>상태</th>
              </tr>
            </thead>
            <tbody>
              {incentives.map((inc, i) => (
                <tr key={i} className="border-t" style={{ borderColor: "var(--color-border)" }}>
                  <td className="p-3 font-medium">{inc.name}</td>
                  <td className="text-right p-3">Q{inc.quarter}</td>
                  <td className="text-right p-3 font-semibold">{fmt(inc.tokamak_amount)} TON</td>
                  <td className="text-right p-3">₩{fmt(inc.krw_amount)}</td>
                  <td className="text-right p-3" style={{ color: "var(--color-text-muted)" }}>₩{fmt(inc.tokamak_krw_rate)}</td>
                  <td className="text-right p-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400">{inc.status === 'paid' ? '지급' : '대기'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "transactions" && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--color-bg-secondary)" }}>
                <th className="text-left p-3" style={{ color: "var(--color-text-muted)" }}>TX Hash</th>
                <th className="text-left p-3" style={{ color: "var(--color-text-muted)" }}>From → To</th>
                <th className="text-right p-3" style={{ color: "var(--color-text-muted)" }}>금액</th>
                <th className="text-right p-3" style={{ color: "var(--color-text-muted)" }}>일시</th>
                <th className="text-right p-3" style={{ color: "var(--color-text-muted)" }}>상태</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, i) => (
                <tr key={i} className="border-t" style={{ borderColor: "var(--color-border)" }}>
                  <td className="p-3 font-mono text-xs">{tx.tx_hash}</td>
                  <td className="p-3 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    {tx.from_address?.slice(0,8)}... → {tx.to_address?.slice(0,8)}...
                  </td>
                  <td className="text-right p-3 font-semibold">{fmt(tx.amount)} {tx.token}</td>
                  <td className="text-right p-3 text-xs" style={{ color: "var(--color-text-muted)" }}>{tx.timestamp?.slice(0,10)}</td>
                  <td className="text-right p-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${tx.status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                      {tx.status === 'confirmed' ? '완료' : '대기'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
