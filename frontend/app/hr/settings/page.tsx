"use client";

export default function Settings() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">설정</h1>
      <p className="text-sm mb-6 text-gray-400">시스템 환경 설정</p>

      <div className="space-y-4 max-w-xl">
        {[
          { label: "USDT/KRW 환율 소스", value: "수동 입력 (전날 종가)", desc: "업비트/바이낸스 종가 기준" },
          { label: "TOKAMAK/KRW 가격 소스", value: "Upbit API", desc: "업비트 종가 자동 조회" },
          { label: "급여일", value: "매월 마지막 영업일", desc: "주말/공휴일 제외" },
          { label: "인센티브 주기", value: "분기 1회", desc: "3월, 6월, 9월, 12월" },
          { label: "텔레그램 알림", value: "활성화", desc: "D-7, D-1 자동 알림" },
          { label: "Kevin 지갑 주소", value: "0x1a2b...ef01", desc: "메인 송금 계정" },
          { label: "Jaden 지갑 주소", value: "0x2b3c...0102", desc: "급여 배분 계정" },
        ].map((item, i) => (
          <div key={i} className="rounded-xl p-4 flex justify-between items-center bg-white border border-gray-200">
            <div>
              <div className="font-medium text-sm">{item.label}</div>
              <div className="text-xs mt-0.5 text-gray-400">{item.desc}</div>
            </div>
            <div className="text-sm font-mono text-[#2A72E5]">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
