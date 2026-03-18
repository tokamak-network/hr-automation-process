"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(Math.round(n));

export default function MemberDetail() {
  const { id } = useParams();
  const [member, setMember] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/members/${id}`).then(r => r.json()).then(setMember).catch(() => {
      setMember({
        id: Number(id), name: "Kevin", github: "ggs134", role: "CEO / Representative",
        monthly_usdt: 15000, wallet_address: "0x1a2b3c4d5e6f7890abcdef1234567890abcdef01",
        contract_start: "2020-01-01",
        payrolls: [
          { year: 2026, month: 3, usdt_amount: 15000, krw_rate: 1352, krw_amount: 20280000, tax_simulated: 1216800, net_pay_krw: 19063200, status: "confirmed" },
          { year: 2026, month: 2, usdt_amount: 15000, krw_rate: 1345, krw_amount: 20175000, tax_simulated: 1210500, net_pay_krw: 18964500, status: "paid" },
          { year: 2026, month: 1, usdt_amount: 15000, krw_rate: 1360, krw_amount: 20400000, tax_simulated: 1224000, net_pay_krw: 19176000, status: "paid" },
        ],
        incentives: [{ year: 2026, quarter: 1, tokamak_amount: 1500, tokamak_krw_rate: 3200, krw_amount: 4800000, status: "pending" }],
      });
    });
  }, [id]);

  if (!member) return <div className="text-center py-20" style={{ color: "var(--color-text-muted)" }}>Loading...</div>;

  return (
    <div>
      <Link href="/members" className="text-sm mb-4 inline-block" style={{ color: "var(--color-primary)" }}>← 팀원 목록</Link>
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold" style={{ background: "var(--color-primary)", color: "#fff" }}>
          {member.name[0]}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{member.name}</h1>
          <p style={{ color: "var(--color-text-secondary)" }}>{member.role} · @{member.github}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl p-4" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
          <div className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>월 급여</div>
          <div className="text-xl font-bold" style={{ color: "var(--color-primary)" }}>{fmt(member.monthly_usdt)} USDT</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
          <div className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>계약 시작일</div>
          <div className="text-xl font-bold">{member.contract_start}</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
          <div className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>지갑 주소</div>
          <div className="text-sm font-mono truncate">{member.wallet_address}</div>
        </div>
      </div>

      <div className="rounded-xl p-5 mb-6" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
        <h2 className="text-lg font-semibold mb-4">급여 이력</h2>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: "var(--color-text-muted)" }}>
              <th className="text-left pb-3">기간</th><th className="text-right pb-3">USDT</th>
              <th className="text-right pb-3">KRW</th><th className="text-right pb-3">세금</th>
              <th className="text-right pb-3">실지급</th><th className="text-right pb-3">상태</th>
            </tr>
          </thead>
          <tbody>
            {member.payrolls?.map((p: any, i: number) => (
              <tr key={i} className="border-t" style={{ borderColor: "var(--color-border)" }}>
                <td className="py-2.5">{p.year}.{String(p.month).padStart(2, "0")}</td>
                <td className="text-right">{fmt(p.usdt_amount)}</td>
                <td className="text-right">₩{fmt(p.krw_amount)}</td>
                <td className="text-right" style={{ color: "var(--color-warning)" }}>₩{fmt(p.tax_simulated)}</td>
                <td className="text-right font-semibold">₩{fmt(p.net_pay_krw)}</td>
                <td className="text-right">
                  <span className={`text-xs px-2 py-0.5 rounded ${p.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : p.status === 'confirmed' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {p.status === 'paid' ? '지급완료' : p.status === 'confirmed' ? '확정' : '예상'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {member.incentives?.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
          <h2 className="text-lg font-semibold mb-4">인센티브</h2>
          {member.incentives.map((inc: any, i: number) => (
            <div key={i} className="flex justify-between items-center py-2 border-t first:border-0" style={{ borderColor: "var(--color-border)" }}>
              <span>{inc.year} Q{inc.quarter}</span>
              <span className="font-semibold">{fmt(inc.tokamak_amount)} TON</span>
              <span style={{ color: "var(--color-text-secondary)" }}>≈ ₩{fmt(inc.krw_amount)}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${inc.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                {inc.status === 'paid' ? '지급' : '대기'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
