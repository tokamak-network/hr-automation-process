"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));

export default function ClassifierPage() {
  const [summary, setSummary] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [unclassified, setUnclassified] = useState<any[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const loadSummary = async () => {
    const q = year ? `?year=${year}` : "";
    const res = await fetch(`/api/accounting/summary${q}`);
    setSummary(await res.json());
  };
  const loadAccounts = async () => {
    const res = await fetch("/api/accounting/chart");
    setAccounts(await res.json());
  };
  const loadRules = async () => {
    const res = await fetch("/api/accounting/rules");
    setRules(await res.json());
  };

  useEffect(() => { loadAccounts(); loadRules(); }, []);
  useEffect(() => { loadSummary(); }, [year]);

  const handleClassify = async () => {
    setClassifying(true);
    const q = year ? `?year=${year}` : "";
    const res = await fetch(`/api/accounting/classify${q}`, { method: "POST" });
    const data = await res.json();
    alert(data.message);
    setUnclassified(data.unclassified || []);
    await loadSummary();
    setClassifying(false);
  };

  const handleManualClassify = async (txId: number, accountCode: string, counterparty: string) => {
    await fetch("/api/accounting/classify-manual", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tx_id: txId, account_code: accountCode, counterparty, save_rule: true }),
    });
    setUnclassified(prev => prev.filter(t => t.id !== txId));
    await loadSummary();
  };

  const pct = summary ? Math.round((summary.classified / Math.max(summary.total, 1)) * 100) : 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">거래 분류</h1>
          <p className="text-sm text-gray-400">Transaction Classifier — 거래상대별 회계 계정 자동 매핑</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowRules(!showRules)}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50">
            {showRules ? "분류 보기" : "룰 관리"}
          </button>
          <button onClick={handleClassify} disabled={classifying}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#2A72E5] hover:bg-[#1E5FCC] disabled:opacity-50">
            {classifying ? "분류 중..." : "일괄 분류 실행"}
          </button>
        </div>
      </div>

      {/* FY 선택 */}
      <div className="flex items-center gap-4 mb-4">
        <select value={year || ""} onChange={e => setYear(e.target.value ? Number(e.target.value) : null)}
          className="px-3 py-1.5 rounded-lg text-sm border border-gray-300">
          <option value="">전체 기간</option>
          <option value="2024">FY24 (Mar23~Feb24)</option>
          <option value="2025">FY25 (Mar24~Feb25)</option>
          <option value="2026">FY26 (Mar25~Feb26)</option>
          <option value="2027">FY27 (Mar26~Feb27)</option>
        </select>
      </div>

      {/* 요약 카드 */}
      {summary && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl p-4 bg-white border border-gray-200">
            <div className="text-xs text-gray-400 mb-1">전체 거래</div>
            <div className="text-2xl font-bold">{summary.total}건</div>
          </div>
          <div className="rounded-xl p-4 bg-white border border-gray-200">
            <div className="text-xs text-gray-400 mb-1">분류 완료</div>
            <div className="text-2xl font-bold text-emerald-600">{summary.classified}건 ({pct}%)</div>
          </div>
          <div className="rounded-xl p-4 bg-white border border-gray-200">
            <div className="text-xs text-gray-400 mb-1">미분류</div>
            <div className="text-2xl font-bold text-amber-500">{summary.unclassified}건</div>
          </div>
        </div>
      )}

      {/* WHT 경고 */}
      {summary?.wht_flagged?.length > 0 && (
        <div className="rounded-xl p-4 mb-6 bg-red-50 border border-red-200">
          <h3 className="text-sm font-semibold text-red-700 mb-2">원천세 검토 필요 ({summary.wht_flagged.length}건)</h3>
          <div className="space-y-1">
            {summary.wht_flagged.slice(0, 5).map((tx: any, i: number) => (
              <div key={i} className="text-xs text-red-600">
                {tx.tx_date?.slice(0, 10)} · {tx.counterparty} · {fmt(tx.amount)} {tx.currency} · {tx.residence}
              </div>
            ))}
          </div>
        </div>
      )}

      {!showRules ? (
        <>
          {/* 계정별 요약 */}
          {summary?.by_account?.length > 0 && (
            <div className="rounded-xl overflow-hidden bg-white border border-gray-200 mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 text-gray-400">계정</th>
                    <th className="text-right p-3 text-gray-400">입금 건수</th>
                    <th className="text-right p-3 text-gray-400">입금 합계</th>
                    <th className="text-right p-3 text-gray-400">출금 건수</th>
                    <th className="text-right p-3 text-gray-400">출금 합계</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const grouped: Record<string, any> = {};
                    summary.by_account.forEach((r: any) => {
                      if (!grouped[r.account_code]) grouped[r.account_code] = { in_cnt: 0, in_amt: 0, out_cnt: 0, out_amt: 0 };
                      if (r.direction === "IN") { grouped[r.account_code].in_cnt = r.cnt; grouped[r.account_code].in_amt = r.total_amount; }
                      else { grouped[r.account_code].out_cnt += r.cnt; grouped[r.account_code].out_amt += Math.abs(r.total_amount); }
                    });
                    const acctMap: Record<string, string> = {};
                    accounts.forEach(a => { acctMap[a.code] = a.name; });
                    return Object.entries(grouped).map(([code, v]: [string, any]) => (
                      <tr key={code} className="border-t border-gray-100">
                        <td className="p-3 font-medium">{acctMap[code] || code}</td>
                        <td className="text-right p-3 text-emerald-600">{v.in_cnt || "-"}</td>
                        <td className="text-right p-3 text-emerald-600">{v.in_amt > 0 ? `+${fmt(v.in_amt)}` : "-"}</td>
                        <td className="text-right p-3 text-red-500">{v.out_cnt || "-"}</td>
                        <td className="text-right p-3 text-red-500">{v.out_amt > 0 ? `-${fmt(v.out_amt)}` : "-"}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          )}

          {/* 미분류 거래 */}
          {unclassified.length > 0 && (
            <div className="rounded-xl overflow-hidden bg-white border border-gray-200">
              <div className="p-4 border-b border-gray-100">
                <h2 className="font-semibold">미분류 거래 ({unclassified.length}건)</h2>
                <p className="text-xs text-gray-400">계정을 선택하면 자동으로 룰이 저장됩니다</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 text-gray-400">일시</th>
                    <th className="text-left p-3 text-gray-400">소스</th>
                    <th className="text-left p-3 text-gray-400">상대방</th>
                    <th className="text-right p-3 text-gray-400">금액</th>
                    <th className="text-left p-3 text-gray-400">계정 선택</th>
                  </tr>
                </thead>
                <tbody>
                  {unclassified.map(tx => (
                    <tr key={tx.id} className="border-t border-gray-100">
                      <td className="p-3 text-xs text-gray-500">{tx.tx_date?.slice(0, 10)}</td>
                      <td className="p-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${tx.source === "WISE" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>{tx.source}</span>
                      </td>
                      <td className="p-3 text-xs text-gray-700">{tx.counterparty || "-"}</td>
                      <td className={`text-right p-3 font-semibold text-xs ${tx.direction === "IN" ? "text-emerald-600" : "text-gray-900"}`}>
                        {tx.direction === "IN" ? "+" : "-"}{fmt(tx.amount)} {tx.currency}
                      </td>
                      <td className="p-3">
                        <select defaultValue="" onChange={e => {
                          if (e.target.value) handleManualClassify(tx.id, e.target.value, tx.counterparty || "");
                        }} className="text-xs px-2 py-1 border border-gray-300 rounded">
                          <option value="">선택...</option>
                          {accounts.map(a => <option key={a.code} value={a.code}>{a.name}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        /* 룰 관리 */
        <div className="rounded-xl overflow-hidden bg-white border border-gray-200">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold">분류 룰 ({rules.length}개)</h2>
            <p className="text-xs text-gray-400">거래상대 이름에 패턴이 포함되면 해당 계정으로 자동 분류</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-3 text-gray-400">패턴</th>
                <th className="text-left p-3 text-gray-400">계정</th>
                <th className="text-left p-3 text-gray-400">거주지</th>
                <th className="text-center p-3 text-gray-400">WHT</th>
                <th className="text-left p-3 text-gray-400">비고</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(r => {
                const acct = accounts.find(a => a.code === r.account_code);
                return (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="p-3 font-mono text-xs">{r.pattern}</td>
                    <td className="p-3 text-xs">{acct?.name || r.account_code}</td>
                    <td className="p-3 text-xs text-gray-500">{r.residence || "-"}</td>
                    <td className="text-center p-3">
                      {r.wht_flag ? <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600">WHT</span> : "-"}
                    </td>
                    <td className="p-3 text-xs text-gray-400">{r.note || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
