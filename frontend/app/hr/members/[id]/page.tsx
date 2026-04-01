"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(Math.round(n));

export default function MemberDetail() {
  const { id } = useParams();
  const [member, setMember] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/hr/members/${id}`).then(r => r.json()).then(setMember).catch(() => {});
  }, [id]);

  if (!member) return <div className="text-center py-20 text-gray-400">Loading...</div>;

  return (
    <div>
      <Link href="/hr/members" className="text-sm mb-4 inline-block text-[#2A72E5]">← 팀원 목록</Link>
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold bg-[#2A72E5] text-white">
          {member.name[0]}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{member.name}</h1>
          <p className="text-gray-500">{member.role} · @{member.github}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl p-4 bg-white border border-gray-200">
          <div className="text-xs mb-1 text-gray-400">월 급여</div>
          <div className="text-xl font-bold text-[#2A72E5]">{fmt(member.monthly_usdt)} USDT</div>
        </div>
        <div className="rounded-xl p-4 bg-white border border-gray-200">
          <div className="text-xs mb-1 text-gray-400">계약 시작일</div>
          <div className="text-xl font-bold">{member.contract_start}</div>
        </div>
        <div className="rounded-xl p-4 bg-white border border-gray-200">
          <div className="text-xs mb-1 text-gray-400">지갑 주소</div>
          <div className="text-sm font-mono truncate">{member.wallet_address}</div>
        </div>
      </div>

      <div className="rounded-xl p-5 mb-6 bg-white border border-gray-200">
        <h2 className="text-lg font-semibold mb-4">급여 이력</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400">
              <th className="text-left pb-3">기간</th><th className="text-right pb-3">USDT</th>
              <th className="text-right pb-3">KRW</th><th className="text-right pb-3">세금</th>
              <th className="text-right pb-3">실지급</th><th className="text-right pb-3">상태</th>
            </tr>
          </thead>
          <tbody>
            {member.payrolls?.map((p: any, i: number) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="py-2.5">{p.year}.{String(p.month).padStart(2, "0")}</td>
                <td className="text-right">{fmt(p.usdt_amount)}</td>
                <td className="text-right">₩{fmt(p.krw_amount)}</td>
                <td className="text-right text-amber-600">₩{fmt(p.tax_simulated)}</td>
                <td className="text-right font-semibold">₩{fmt(p.net_pay_krw)}</td>
                <td className="text-right">
                  <span className={`text-xs px-2 py-0.5 rounded ${p.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : p.status === 'confirmed' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                    {p.status === 'paid' ? '지급완료' : p.status === 'confirmed' ? '확정' : '예상'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 인센티브 섹션 — 일시 중지 (2026-04-01) */}
    </div>
  );
}
