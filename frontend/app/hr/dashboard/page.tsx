"use client";
import { useEffect, useState } from "react";

const Card = ({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) => (
  <div className={`rounded-xl p-5 bg-white border border-gray-200 ${className}`}>
    <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 text-gray-400">{title}</h3>
    {children}
  </div>
);

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(Math.round(n));

export default function Dashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/hr/dashboard").then(r => r.json()).then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="text-center py-20 text-gray-400">Loading...</div>;

  const { current_month: cm, recent_transactions, d_day, reserves, annual_usdt } = data;
  const hasKrw = cm.total_krw > 0;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">대시보드</h1>
      <p className="text-sm mb-6 text-gray-400">{cm.year}년 {cm.month}월 급여 현황</p>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card title="이번 달 총 급여">
          <div className="text-2xl font-bold text-[#2A72E5]">{fmt(cm.total_usdt)} USDT</div>
          {hasKrw && <div className="text-sm mt-1 text-gray-500">{"\u2248"} {"\u20A9"}{fmt(cm.total_krw)}</div>}
          <div className="text-xs mt-1 text-gray-400">{cm.member_count}명</div>
        </Card>
        <Card title="급여일까지">
          <div className={`text-3xl font-bold ${d_day <= 3 ? 'text-amber-500' : 'text-gray-900'}`}>
            {d_day === 0 ? "D-Day" : `D-${d_day}`}
          </div>
          <div className="text-sm mt-1 text-gray-500">{data.payday}</div>
        </Card>
        <Card title={`${cm.year}년 총 지급`}>
          <div className="text-lg font-semibold">{fmt(annual_usdt)} USDT</div>
          <div className="text-xs mt-1 text-gray-400">{cm.year}년 누적</div>
        </Card>
        <Card title="세금 적립금">
          <div className="text-lg font-semibold">{"\u20A9"}{fmt(reserves.total_tax_krw || 0)}</div>
          {reserves.total_tax_usdt > 0 && (
            <div className="text-sm text-gray-500">{"\u2248"} {fmt(reserves.total_tax_usdt)} USDT</div>
          )}
          <div className="text-xs mt-1 text-gray-400">{cm.year}년 누적 세액</div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title="세금 시뮬레이션 요약">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-500">이번 달 예상 세액</span>
            <span className="font-semibold">{hasKrw ? `\u20A9${fmt(cm.total_tax)}` : "-"}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-500">이번 달 팀원 수</span>
            <span className="font-semibold">{cm.member_count}명</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">상태</span>
            <span className={`text-xs px-2 py-0.5 rounded ${cm.total_usdt > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {cm.total_usdt > 0 ? "데이터 있음" : "미입력"}
            </span>
          </div>
        </Card>

        <Card title="최근 트랜잭션">
          {recent_transactions.length > 0 ? (
            <div className="space-y-2">
              {recent_transactions.map((tx: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-sm py-1.5 border-b border-gray-100 last:border-0">
                  <div>
                    {tx.tx_hash ? (
                      <a href={`https://etherscan.io/tx/${tx.tx_hash}`} target="_blank" rel="noopener noreferrer"
                        className="font-mono text-xs text-blue-500 hover:underline">{tx.tx_hash.slice(0, 14)}...</a>
                    ) : <span className="font-mono text-xs text-gray-400">-</span>}
                    {tx.note && <span className="ml-2 text-gray-500">{tx.note}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{fmt(tx.amount)} {tx.token}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${tx.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {tx.status === 'confirmed' ? '완료' : '대기'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-400 py-4 text-center">트랜잭션 기록이 없습니다</div>
          )}
        </Card>
      </div>
    </div>
  );
}
