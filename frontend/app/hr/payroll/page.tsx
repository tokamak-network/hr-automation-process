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
    fetch(`/api/hr/payroll?year=2026&month=${month}`).then(r => r.json()).then(setPayrolls).catch(() => {});
    fetch("/api/hr/incentives?year=2026").then(r => r.json()).then(setIncentives).catch(() => {});
    fetch("/api/hr/transactions").then(r => r.json()).then(setTransactions).catch(() => {});
  }, [month]);

  const tabStyle = (t: Tab) =>
    tab === t
      ? "bg-[#2A72E5] text-white"
      : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50";

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">급여 관리</h1>
      <p className="text-sm mb-6 text-gray-400">2026년 급여 및 인센티브 현황</p>

      <div className="flex gap-2 mb-6">
        {(["monthly", "incentive", "transactions"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium ${tabStyle(t)}`}>
            {t === "monthly" ? "월별 급여" : t === "incentive" ? "분기 인센티브" : "트랜잭션"}
          </button>
        ))}
      </div>

      {tab === "monthly" && (
        <div>
          <div className="flex gap-2 mb-4">
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
              <button key={m} onClick={() => setMonth(m)}
                className={`px-3 py-1.5 rounded text-xs font-medium ${m === month ? 'bg-[#2A72E5] text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                {m}월
              </button>
            ))}
          </div>
          <div className="rounded-xl overflow-hidden bg-white border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-3 text-gray-400">팀원</th>
                  <th className="text-right p-3 text-gray-400">USDT</th>
                  <th className="text-right p-3 text-gray-400">KRW 환산</th>
                  <th className="text-right p-3 text-gray-400">세금 시뮬레이션</th>
                  <th className="text-right p-3 text-gray-400">실 지급액</th>
                  <th className="text-right p-3 text-gray-400">적립금(KRW)</th>
                  <th className="text-right p-3 text-gray-400">상태</th>
                </tr>
              </thead>
              <tbody>
                {payrolls.map((p, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="p-3">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-gray-400">{p.role}</div>
                    </td>
                    <td className="text-right p-3 font-semibold">{fmt(p.usdt_amount)}</td>
                    <td className="text-right p-3">₩{fmt(p.krw_amount)}</td>
                    <td className="text-right p-3 text-amber-600">₩{fmt(p.tax_simulated)}</td>
                    <td className="text-right p-3 font-semibold">₩{fmt(p.net_pay_krw)}</td>
                    <td className="text-right p-3 text-gray-500">₩{fmt(p.tax_simulated || 0)}</td>
                    <td className="text-right p-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        p.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                        p.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'}`}>
                        {p.status === 'paid' ? '지급완료' : p.status === 'confirmed' ? '확정' : '예상'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {payrolls.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-200 font-semibold">
                    <td className="p-3">합계</td>
                    <td className="text-right p-3">{fmt(payrolls.reduce((s,p) => s + p.usdt_amount, 0))}</td>
                    <td className="text-right p-3">₩{fmt(payrolls.reduce((s,p) => s + p.krw_amount, 0))}</td>
                    <td className="text-right p-3 text-amber-600">₩{fmt(payrolls.reduce((s,p) => s + p.tax_simulated, 0))}</td>
                    <td className="text-right p-3">₩{fmt(payrolls.reduce((s,p) => s + p.net_pay_krw, 0))}</td>
                    <td className="text-right p-3">₩{fmt(payrolls.reduce((s,p) => s + (p.tax_simulated || 0), 0))}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {tab === "incentive" && (
        <div className="rounded-xl overflow-hidden bg-white border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-3 text-gray-400">팀원</th>
                <th className="text-right p-3 text-gray-400">분기</th>
                <th className="text-right p-3 text-gray-400">TOKAMAK</th>
                <th className="text-right p-3 text-gray-400">KRW 환산</th>
                <th className="text-right p-3 text-gray-400">업비트 종가</th>
                <th className="text-right p-3 text-gray-400">상태</th>
              </tr>
            </thead>
            <tbody>
              {incentives.map((inc, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="p-3 font-medium">{inc.name}</td>
                  <td className="text-right p-3">Q{inc.quarter}</td>
                  <td className="text-right p-3 font-semibold">{fmt(inc.tokamak_amount)} TON</td>
                  <td className="text-right p-3">₩{fmt(inc.krw_amount)}</td>
                  <td className="text-right p-3 text-gray-400">₩{fmt(inc.tokamak_krw_rate)}</td>
                  <td className="text-right p-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700">{inc.status === 'paid' ? '지급' : '대기'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "transactions" && (
        <div className="rounded-xl overflow-hidden bg-white border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-3 text-gray-400">TX Hash</th>
                <th className="text-left p-3 text-gray-400">From → To</th>
                <th className="text-right p-3 text-gray-400">금액</th>
                <th className="text-right p-3 text-gray-400">일시</th>
                <th className="text-right p-3 text-gray-400">상태</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="p-3 font-mono text-xs">{tx.tx_hash}</td>
                  <td className="p-3 text-xs text-gray-500">
                    {tx.from_address?.slice(0,8)}... → {tx.to_address?.slice(0,8)}...
                  </td>
                  <td className="text-right p-3 font-semibold">{fmt(tx.amount)} {tx.token}</td>
                  <td className="text-right p-3 text-xs text-gray-400">{tx.timestamp?.slice(0,10)}</td>
                  <td className="text-right p-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${tx.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
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
