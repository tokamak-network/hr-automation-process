"use client";
import { useEffect, useState } from "react";

const Card = ({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) => (
  <div className={`rounded-xl p-5 ${className}`} style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
    <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-text-muted)" }}>{title}</h3>
    {children}
  </div>
);

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(Math.round(n));

export default function Dashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/dashboard").then(r => r.json()).then(setData).catch(() => {
      // Fallback mock
      setData({
        current_month: { year: 2026, month: 3, total_usdt: 98500, total_krw: 133_147_500, total_tax: 7_988_850, member_count: 10 },
        jaden_balance: { usdt: 45230.5, tokamak: 12500 },
        recent_transactions: [
          { tx_hash: "0xabc...001", amount: 98500, token: "USDT", status: "confirmed", timestamp: "2026-01-31T09:00:00Z", note: "Jan payroll" },
          { tx_hash: "0xabc...002", amount: 98500, token: "USDT", status: "confirmed", timestamp: "2026-02-28T09:00:00Z", note: "Feb payroll" },
          { tx_hash: "0xabc...003", amount: 98500, token: "USDT", status: "pending", timestamp: "2026-03-31T09:00:00Z", note: "Mar payroll" },
        ],
        d_day: 13,
        payday: "2026-03-31",
        reserves: { total_tokamak: 74.85, krw_value: 239_520, tokamak_price: 3200 },
      });
    });
  }, []);

  if (!data) return <div className="text-center py-20" style={{ color: "var(--color-text-muted)" }}>Loading...</div>;

  const { current_month: cm, jaden_balance, recent_transactions, d_day, reserves } = data;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">대시보드</h1>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>{cm.year}년 {cm.month}월 급여 현황</p>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card title="이번 달 총 급여">
          <div className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>{fmt(cm.total_usdt)} USDT</div>
          <div className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>≈ ₩{fmt(cm.total_krw)}</div>
        </Card>
        <Card title="급여일까지">
          <div className="text-3xl font-bold" style={{ color: d_day <= 3 ? "var(--color-warning)" : "var(--color-text)" }}>D-{d_day}</div>
          <div className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>{data.payday}</div>
        </Card>
        <Card title="Jaden 계정 잔고">
          <div className="text-lg font-semibold">{fmt(jaden_balance.usdt)} USDT</div>
          <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{fmt(jaden_balance.tokamak)} TON</div>
        </Card>
        <Card title="적립금 현황">
          <div className="text-lg font-semibold">{reserves.total_tokamak.toFixed(2)} TON</div>
          <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>≈ ₩{fmt(reserves.krw_value)}</div>
          <div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>@{fmt(reserves.tokamak_price)} KRW</div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title="세금 시뮬레이션 요약">
          <div className="flex justify-between items-center mb-2">
            <span style={{ color: "var(--color-text-secondary)" }}>이번 달 예상 세액</span>
            <span className="font-semibold">₩{fmt(cm.total_tax)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span style={{ color: "var(--color-text-secondary)" }}>팀원 수</span>
            <span className="font-semibold">{cm.member_count}명</span>
          </div>
        </Card>

        <Card title="Kevin → Jaden 최근 입금">
          <div className="space-y-2">
            {recent_transactions.map((tx: any, i: number) => (
              <div key={i} className="flex justify-between items-center text-sm py-1.5 border-b last:border-0" style={{ borderColor: "var(--color-border)" }}>
                <div>
                  <span className="font-mono text-xs" style={{ color: "var(--color-text-muted)" }}>{tx.tx_hash?.slice(0, 14)}...</span>
                  <span className="ml-2" style={{ color: "var(--color-text-secondary)" }}>{tx.note}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{fmt(tx.amount)} {tx.token}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${tx.status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {tx.status === 'confirmed' ? '완료' : '대기'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
