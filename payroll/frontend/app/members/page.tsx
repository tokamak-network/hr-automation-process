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
    fetch("/api/members").then(r => r.json()).then(setMembers).catch(() => {
      setMembers([
        { id: 1, name: "Kevin", github: "ggs134", role: "CEO / Representative", monthly_usdt: 15000, wallet_address: "0x1a2b...ef01", contract_start: "2020-01-01" },
        { id: 2, name: "Jaden", github: "Jaden-Kong", role: "Directing Manager", monthly_usdt: 12000, wallet_address: "0x2b3c...0102", contract_start: "2020-03-15" },
        { id: 3, name: "Sujin Park", github: "sujin-park", role: "Senior Developer", monthly_usdt: 10000, wallet_address: "0x3c4d...0203", contract_start: "2021-06-01" },
        { id: 4, name: "Minho Lee", github: "minho-dev", role: "Backend Developer", monthly_usdt: 9000, wallet_address: "0x4d5e...0304", contract_start: "2022-01-10" },
        { id: 5, name: "Yuna Kim", github: "yuna-kim", role: "Frontend Developer", monthly_usdt: 9000, wallet_address: "0x5e6f...0405", contract_start: "2022-04-01" },
        { id: 6, name: "Hyunwoo Cho", github: "hyunwoo-cho", role: "Smart Contract Developer", monthly_usdt: 10000, wallet_address: "0x6f78...0506", contract_start: "2021-09-15" },
        { id: 7, name: "Eunji Hwang", github: "eunji-design", role: "UI/UX Designer", monthly_usdt: 8000, wallet_address: "0x7890...0607", contract_start: "2023-02-01" },
        { id: 8, name: "Dongwon Shin", github: "dongwon-r", role: "Researcher", monthly_usdt: 8500, wallet_address: "0x890a...0708", contract_start: "2022-07-01" },
        { id: 9, name: "Jiyeon Oh", github: "jiyeon-ops", role: "Operations Manager", monthly_usdt: 7500, wallet_address: "0x90ab...0809", contract_start: "2023-05-15" },
        { id: 10, name: "Taehoon Ryu", github: "taehoon-sec", role: "Security Engineer", monthly_usdt: 9500, wallet_address: "0xa0bc...0910", contract_start: "2022-11-01" },
      ]);
    });
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">팀원 관리</h1>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>총 {members.length}명</p>
        </div>
        <button className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "var(--color-primary)" }}>
          + 팀원 추가
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {members.map(m => (
          <Link key={m.id} href={`/members/${m.id}`}
            className="rounded-xl p-5 hover:scale-[1.01] transition-transform cursor-pointer"
            style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold" style={{ background: "var(--color-primary)", color: "#fff" }}>
                    {m.name[0]}
                  </div>
                  <div>
                    <h3 className="font-semibold">{m.name}</h3>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>@{m.github}</p>
                  </div>
                </div>
                <p className="text-sm mt-2" style={{ color: "var(--color-text-secondary)" }}>{m.role}</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold" style={{ color: "var(--color-primary)" }}>{fmt(m.monthly_usdt)} USDT</div>
                <div className="text-xs font-mono mt-1" style={{ color: "var(--color-text-muted)" }}>
                  {m.wallet_address.slice(0, 8)}...{m.wallet_address.slice(-4)}
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs" style={{ color: "var(--color-text-muted)" }}>계약 시작: {m.contract_start}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
