"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Member {
  id: number; name: string; github: string; role: string;
  monthly_usdt: number; wallet_address: string; contract_start: string;
}

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(Math.round(n));

export default function Members() {
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    fetch("/api/hr/members").then(r => r.json()).then(setMembers).catch(() => {});
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">팀원 관리</h1>
          <p className="text-sm text-gray-400">총 {members.length}명</p>
        </div>
        <button className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#2A72E5] hover:bg-[#1E5FCC]">
          + 팀원 추가
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {members.map(m => (
          <Link key={m.id} href={`/hr/members/${m.id}`}
            className="rounded-xl p-5 hover:shadow-md transition bg-white border border-gray-200 cursor-pointer">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold bg-[#2A72E5] text-white">
                    {m.name[0]}
                  </div>
                  <div>
                    <h3 className="font-semibold">{m.name}</h3>
                    <p className="text-xs text-gray-400">@{m.github}</p>
                  </div>
                </div>
                <p className="text-sm mt-2 text-gray-500">{m.role}</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-[#2A72E5]">{fmt(m.monthly_usdt)} USDT</div>
                <div className="text-xs font-mono mt-1 text-gray-400">
                  {m.wallet_address?.slice(0, 8)}...{m.wallet_address?.slice(-4)}
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-400">계약 시작: {m.contract_start}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
