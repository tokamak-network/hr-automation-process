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
  const [showGuide, setShowGuide] = useState(false);

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
          <button onClick={() => setShowGuide(!showGuide)}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50">
            {showGuide ? "닫기" : "가이드"}
          </button>
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

      {/* WHT 경고 + 리뷰 */}
      {summary?.wht_flagged?.length > 0 && (
        <div className="rounded-xl p-4 mb-6 bg-red-50 border border-red-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-red-700">원천세 검토 필요 ({summary.wht_flagged.length}건)</h3>
          </div>
          <div className="space-y-2">
            {summary.wht_flagged.slice(0, 10).map((tx: any, i: number) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className="text-gray-500 w-[70px]">{tx.tx_date?.slice(0, 10)}</span>
                <span className="text-gray-700 w-[180px] truncate">{tx.counterparty}</span>
                <span className="font-semibold w-[100px] text-right">{fmt(tx.amount)} {tx.currency}</span>
                <span className="text-gray-400 w-[60px]">{tx.residence}</span>
                <select defaultValue={tx.wht_status || "pending"} onChange={async (e) => {
                  const note = e.target.value === "exempt" ? prompt("면제 근거를 입력하세요 (예: DTA Art.7, 한국 수행, PE 없음)") || "" : "";
                  await fetch(`/api/accounting/wht/${tx.id}`, {
                    method: "PUT", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: e.target.value, note }),
                  });
                  await loadSummary();
                }} className={`text-[10px] px-2 py-0.5 rounded border-0 cursor-pointer ${
                  tx.wht_status === "exempt" ? "bg-emerald-100 text-emerald-700" :
                  tx.wht_status === "taxable" ? "bg-red-100 text-red-700" :
                  "bg-amber-100 text-amber-700"}`}>
                  <option value="pending">검토중</option>
                  <option value="exempt">면제</option>
                  <option value="taxable">과세</option>
                </select>
                {tx.wht_note && <span className="text-gray-400 truncate" title={tx.wht_note}>{tx.wht_note}</span>}
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

      {/* Guide Panel */}
      {showGuide && (
        <div className="fixed inset-0 bg-black/40 flex justify-end z-50" onClick={() => setShowGuide(false)}>
          <div className="w-full max-w-2xl bg-white h-full overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
              <h2 className="text-lg font-bold">거래 분류기 가이드</h2>
              <button onClick={() => setShowGuide(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-6 prose prose-sm max-w-none">
              <h3>이 기능은 무엇인가요?</h3>
              <p>법인 은행 거래내역(Aspire, WISE)을 <strong>회계 계정</strong>에 자동으로 분류하는 기능입니다.</p>
              <p>예를 들어:</p>
              <ul>
                <li>"고객사 A"로부터 입금 → <strong>Sales</strong> (매출)</li>
                <li>"Anthropic"에 출금 → <strong>Subscription fee</strong> (구독료)</li>
                <li>"직원 A"에 출금 → <strong>Salary</strong> (급여)</li>
              </ul>

              <h3>핵심 개념</h3>

              <h4>1. Chart of Accounts (계정 체계)</h4>
              <p>회사의 모든 수입/지출을 분류하는 카테고리입니다.</p>
              <table>
                <thead><tr><th>구분</th><th>계정</th><th>설명</th></tr></thead>
                <tbody>
                  <tr><td>수입</td><td>Sales</td><td>고객사 A 매출</td></tr>
                  <tr><td>원가</td><td>Consulting fee</td><td>외주사 B 외주비</td></tr>
                  <tr><td>비용</td><td>Salary</td><td>직원 급여</td></tr>
                  <tr><td></td><td>Director remuneration</td><td>이사 보수</td></tr>
                  <tr><td></td><td>Subscription fee</td><td>SaaS 구독</td></tr>
                  <tr><td></td><td>Professional fee</td><td>법무/세무 자문</td></tr>
                  <tr><td></td><td>Office rental</td><td>사무실 임대</td></tr>
                  <tr><td>기타수입</td><td>Other income</td><td>캐시백, 이자</td></tr>
                  <tr><td>내부</td><td>Internal transfer</td><td>계좌간 이체</td></tr>
                </tbody>
              </table>

              <h4>2. Counterparty Rules (분류 룰)</h4>
              <p><strong>거래상대 이름</strong> → <strong>계정</strong> 매핑 규칙입니다. 한 번 등록하면 같은 거래상대의 모든 거래가 자동 분류됩니다.</p>

              <h4>3. WHT Flag (원천세 플래그)</h4>
              <p>한국 거주자에게 송금 시 원천세 검토가 필요할 수 있습니다. 해당 거래는 빨간색으로 경고 표시됩니다.</p>

              <h3>사용 방법</h3>

              <h4>Step 1: 일괄 분류 실행</h4>
              <ol>
                <li><strong>"일괄 분류 실행"</strong> 버튼 클릭</li>
                <li>등록된 룰에 매칭되는 거래가 자동 분류됩니다</li>
                <li>요약 카드에서 분류 현황을 확인합니다</li>
              </ol>

              <h4>Step 2: 미분류 거래 처리</h4>
              <ol>
                <li>미분류 거래의 <strong>드롭다운</strong>에서 계정을 선택</li>
                <li>자동으로 해당 거래상대가 룰로 저장됩니다</li>
                <li>다음부터 같은 거래상대는 자동 분류</li>
              </ol>

              <h4>Step 3: 룰 관리</h4>
              <p>"룰 관리" 버튼으로 등록된 모든 룰을 확인/수정할 수 있습니다.</p>

              <h4>Step 4: FY(회계연도) 필터</h4>
              <ul>
                <li>FY24: 2023년 3월 ~ 2024년 2월</li>
                <li>FY25: 2024년 3월 ~ 2025년 2월</li>
                <li>FY26: 2025년 3월 ~ 2026년 2월</li>
              </ul>

              <h3>분류 정확도</h3>
              <table>
                <thead><tr><th>시점</th><th>예상 자동 분류율</th><th>소요 시간</th></tr></thead>
                <tbody>
                  <tr><td>최초 실행</td><td>~70%</td><td>미분류 수동 처리 1-2시간</td></tr>
                  <tr><td>2번째 FY</td><td>~90%</td><td>신규 거래상대만 처리 20분</td></tr>
                  <tr><td>3번째 FY 이후</td><td>~95%+</td><td>5분</td></tr>
                </tbody>
              </table>

              <h3>FAQ</h3>
              <p><strong>Q: 분류를 잘못했으면?</strong><br/>A: 룰 관리에서 룰을 수정/삭제할 수 있습니다.</p>
              <p><strong>Q: 같은 거래상대가 다른 계정에 해당하면?</strong><br/>A: 현재는 하나의 거래상대에 하나의 계정만 매핑됩니다. 예외적인 거래는 수동으로 분류해주세요.</p>
              <p><strong>Q: 내부 이체도 분류되나?</strong><br/>A: "Internal transfer"로 분류됩니다. 회계상 자산 이동이므로 PL에는 영향 없습니다.</p>
              <p><strong>Q: WHT 플래그는 실제 세금 계산인가?</strong><br/>A: 아닙니다. 한국 거주자 송금에 대한 <strong>검토 알림</strong>입니다. 실제 원천세 계산은 세무사와 확인이 필요합니다.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
