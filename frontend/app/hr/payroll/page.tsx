"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(Math.round(n));
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

type Tab = "monthly" | "transactions";

export default function Payroll() {
  const [tab, setTab] = useState<Tab>("monthly");
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [showTxForm, setShowTxForm] = useState(false);
  const [txForm, setTxForm] = useState({ tx_hash: "", from_address: "", to_address: "", amount: 0, token: "USDT", status: "confirmed", timestamp: "", note: "" });
  const [txSaving, setTxSaving] = useState(false);
  const [historyUploading, setHistoryUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [editingPayroll, setEditingPayroll] = useState<any>(null);
  const [pForm, setPForm] = useState({ usdt_amount: 0, krw_rate: 0, krw_amount: 0, tax_simulated: 0, net_pay_krw: 0, status: "estimated" });
  const [pSaving, setPSaving] = useState(false);
  const [addrMap, setAddrMap] = useState<Record<string, string>>({});

  const loadPayrolls = () => fetch(`/api/hr/payroll?year=${year}&month=${month}`).then(r => r.json()).then(setPayrolls).catch(() => {});
  const loadTx = () => fetch("/api/hr/transactions").then(r => r.json()).then(setTransactions).catch(() => {});
  const resolveAddr = (addr: string) => addrMap[addr?.toLowerCase()] || (addr ? `${addr.slice(0,8)}...` : "?");

  useEffect(() => { loadPayrolls(); }, [year, month]);
  useEffect(() => {
    loadTx();
    fetch("/api/hr/transactions/sync-status").then(r => r.json()).then(setSyncStatus).catch(() => {});
    fetch("/api/hr/address-map").then(r => r.json()).then(setAddrMap).catch(() => {});
  }, []);

  const startEditPayroll = (p: any) => {
    setPForm({ usdt_amount: p.usdt_amount, krw_rate: p.krw_rate, krw_amount: p.krw_amount, tax_simulated: p.tax_simulated, net_pay_krw: p.net_pay_krw, status: p.status });
    setEditingPayroll(p);
  };

  const updatePField = async (key: string, val: string) => {
    const next = { ...pForm, [key]: val };
    const usdt = Number(key === "usdt_amount" ? val : next.usdt_amount) || 0;
    const rate = Number(key === "krw_rate" ? val : next.krw_rate) || 0;
    if (key === "usdt_amount" || key === "krw_rate") {
      const krw = Math.round(usdt * rate);
      next.krw_amount = krw;
      if (krw > 0) {
        try {
          const res = await fetch("/api/hr/tax/calculate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ monthly_income: krw }) });
          const data = await res.json();
          next.tax_simulated = Math.round(data.total_tax_100 ?? 0);
        } catch {}
      } else { next.tax_simulated = 0; }
      next.net_pay_krw = (Number(next.krw_amount) || 0) - (Number(next.tax_simulated) || 0);
    }
    if (key === "tax_simulated") { next.net_pay_krw = (Number(next.krw_amount) || 0) - (Number(val) || 0); }
    setPForm(next);
  };

  const handlePayrollUpdate = async () => {
    if (!editingPayroll) return;
    setPSaving(true);
    await fetch(`/api/hr/payroll/${editingPayroll.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usdt_amount: Number(pForm.usdt_amount), krw_rate: Number(pForm.krw_rate), krw_amount: Number(pForm.krw_amount), tax_simulated: Number(pForm.tax_simulated), net_pay_krw: Number(pForm.net_pay_krw), status: pForm.status }),
    });
    setEditingPayroll(null); setPSaving(false); await loadPayrolls();
  };

  const handlePayrollDelete = async (id: number) => {
    if (!confirm("이 급여 데이터를 삭제하시겠습니까?")) return;
    await fetch(`/api/hr/payroll/${id}`, { method: "DELETE" });
    await loadPayrolls();
  };

  const handleTxSave = async () => {
    setTxSaving(true);
    await fetch("/api/hr/transactions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...txForm, amount: Number(txForm.amount) }),
    });
    setShowTxForm(false);
    setTxForm({ tx_hash: "", from_address: "", to_address: "", amount: 0, token: "USDT", status: "confirmed", timestamp: "", note: "" });
    setTxSaving(false);
    await loadTx();
  };

  const handleTxDelete = async (id: number) => {
    if (!confirm("이 트랜잭션을 삭제하시겠습니까?")) return;
    await fetch(`/api/hr/transactions/${id}`, { method: "DELETE" });
    await loadTx();
  };

  const handleHistoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHistoryUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/hr/payroll/upload", { method: "POST", body: formData });
      const data = await res.json();
      alert(data.message);
      await loadPayrolls();
    } catch { alert("업로드 실패"); }
    setHistoryUploading(false);
    e.target.value = "";
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/hr/transactions/sync", { method: "POST" });
      const data = await res.json();
      alert(data.message);
      await loadTx();
      const st = await fetch("/api/hr/transactions/sync-status").then(r => r.json());
      setSyncStatus(st);
    } catch { alert("동기화 실패"); }
    setSyncing(false);
  };

  const tabStyle = (t: Tab) =>
    tab === t
      ? "bg-[#2A72E5] text-white"
      : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50";

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">급여 관리</h1>
      <p className="text-sm mb-6 text-gray-400">{year}년 급여 현황</p>

      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          {(["monthly", "transactions"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium ${tabStyle(t)}`}>
              {t === "monthly" ? "월별 급여" : "트랜잭션"}
            </button>
          ))}
        </div>
        {tab === "monthly" && (
          <div className="flex gap-2">
            <button onClick={() => window.open("/api/hr/payroll/upload-template", "_blank")}
              className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50">
              양식
            </button>
            <label className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer">
              {historyUploading ? "처리 중..." : "가져오기"}
              <input type="file" accept=".xlsx,.xls" onChange={handleHistoryUpload} className="hidden" disabled={historyUploading} />
            </label>
            <button onClick={() => window.open(`/api/hr/payroll/download?year=${year}&month=${month}`, "_blank")}
              className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50">
              내보내기
            </button>
          </div>
        )}
      </div>

      {tab === "monthly" && (
        <div>
          <div className="flex items-center gap-4 mb-4">
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 focus:outline-none focus:border-[#2A72E5]">
              {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <div className="flex gap-1">
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                <button key={m} onClick={() => setMonth(m)}
                  className={`px-3 py-1.5 rounded text-xs font-medium ${m === month ? 'bg-[#2A72E5] text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                  {m}월
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl overflow-hidden bg-white border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-3 text-gray-400">팀원</th>
                  <th className="text-right p-3 text-gray-400">USDT</th>
                  <th className="text-right p-3 text-gray-400">환율</th>
                  <th className="text-right p-3 text-gray-400">KRW 환산</th>
                  <th className="text-right p-3 text-gray-400">세금 (KRW/USD)</th>
                  <th className="text-right p-3 text-gray-400">실지급 (KRW/USD)</th>
                  <th className="text-right p-3 text-gray-400">상태</th>
                  <th className="text-center p-3 text-gray-400">Payslip</th>
                  <th className="text-right p-3 text-gray-400"></th>
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
                    <td className="text-right p-3 text-gray-400">{p.krw_rate ? fmt(p.krw_rate) : "-"}</td>
                    <td className="text-right p-3">{p.krw_rate ? `${"\u20A9"}${fmt(p.krw_amount)}` : "-"}</td>
                    <td className="text-right p-3 text-amber-600">
                      {p.krw_rate ? (
                        <>
                          <div>{"\u20A9"}{fmt(p.tax_simulated)}</div>
                          <div className="text-xs text-gray-400">${fmt(p.tax_simulated / p.krw_rate)}</div>
                        </>
                      ) : <div className="text-gray-300">-</div>}
                    </td>
                    <td className="text-right p-3 font-semibold">
                      {p.krw_rate ? (
                        <>
                          <div>{"\u20A9"}{fmt(p.net_pay_krw)}</div>
                          <div className="text-xs text-gray-400 font-normal">${fmt(p.net_pay_krw / p.krw_rate)}</div>
                        </>
                      ) : <div>${fmt(p.usdt_amount)}</div>}
                    </td>
                    <td className="text-right p-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        p.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                        p.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'}`}>
                        {p.status === 'paid' ? '지급완료' : p.status === 'confirmed' ? '확정' : '예상'}
                      </span>
                    </td>
                    <td className="text-center p-3">
                      <button
                        onClick={() => window.open(`/api/hr/generate-payslip?member_id=${p.member_id}&year=${p.year}&month=${p.month}`, "_blank")}
                        disabled={p.status === "estimated"}
                        className={`text-xs px-2 py-1 rounded font-medium ${
                          p.status === "estimated"
                            ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                            : "bg-[#2A72E5] text-white hover:bg-[#1E5FCC]"
                        }`}>
                        PDF
                      </button>
                    </td>
                    <td className="text-right p-3">
                      <button onClick={() => startEditPayroll(p)} className="text-xs text-blue-500 hover:underline mr-2">수정</button>
                      <button onClick={() => handlePayrollDelete(p.id)} className="text-xs text-red-500 hover:underline">삭제</button>
                    </td>
                  </tr>
                ))}
                {payrolls.length === 0 && (
                  <tr><td colSpan={9} className="py-8 text-center text-gray-400">해당 월의 급여 데이터가 없습니다</td></tr>
                )}
              </tbody>
              {payrolls.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-200 font-semibold">
                    <td className="p-3">합계 ({payrolls.length}명)</td>
                    <td className="text-right p-3">{fmt(payrolls.reduce((s: number,p: any) => s + p.usdt_amount, 0))}</td>
                    <td className="text-right p-3"></td>
                    <td className="text-right p-3">{"\u20A9"}{fmt(payrolls.reduce((s: number,p: any) => s + p.krw_amount, 0))}</td>
                    <td className="text-right p-3 text-amber-600">{"\u20A9"}{fmt(payrolls.reduce((s: number,p: any) => s + p.tax_simulated, 0))}</td>
                    <td className="text-right p-3">{"\u20A9"}{fmt(payrolls.reduce((s: number,p: any) => s + p.net_pay_krw, 0))}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {tab === "transactions" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="text-xs text-gray-400">
              {syncStatus?.ready
                ? `지갑 ${syncStatus.wallet_count}개 등록 · ${syncStatus.transaction_count}건 기록`
                : !syncStatus?.api_key_set
                  ? "Etherscan API Key를 .env에 설정하세요"
                  : "설정에서 지갑을 등록하세요"
              }
            </div>
            <div className="flex gap-2">
              <button onClick={handleSync} disabled={syncing || !syncStatus?.ready}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50">
                {syncing ? "동기화 중..." : "Etherscan 동기화"}
              </button>
              <button onClick={() => setShowTxForm(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#2A72E5] hover:bg-[#1E5FCC]">
                + 수동 추가
              </button>
            </div>
          </div>
          <div className="rounded-xl overflow-hidden bg-white border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-3 text-gray-400">TX Hash</th>
                  <th className="text-left p-3 text-gray-400">From → To</th>
                  <th className="text-right p-3 text-gray-400">금액</th>
                  <th className="text-left p-3 text-gray-400">메모</th>
                  <th className="text-right p-3 text-gray-400">일시</th>
                  <th className="text-right p-3 text-gray-400">상태</th>
                  <th className="text-right p-3 text-gray-400"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx: any) => (
                  <tr key={tx.id} className="border-t border-gray-100">
                    <td className="p-3 font-mono text-xs">
                      {tx.tx_hash ? (
                        <a href={`https://etherscan.io/tx/${tx.tx_hash}`} target="_blank" rel="noopener noreferrer"
                          className="text-blue-500 hover:underline">{tx.tx_hash.slice(0,12)}...</a>
                      ) : "-"}
                    </td>
                    <td className="p-3 text-xs text-gray-500">
                      {resolveAddr(tx.from_address)} → {resolveAddr(tx.to_address)}
                    </td>
                    <td className="text-right p-3 font-semibold">{fmt(tx.amount)} {tx.token}</td>
                    <td className="p-3 text-xs text-gray-500">{tx.note || "-"}</td>
                    <td className="text-right p-3 text-xs text-gray-400">{tx.timestamp?.slice(0,10)}</td>
                    <td className="text-right p-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${tx.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {tx.status === 'confirmed' ? '완료' : '대기'}
                      </span>
                    </td>
                    <td className="text-right p-3">
                      <button onClick={() => handleTxDelete(tx.id)} className="text-xs text-red-500 hover:underline">삭제</button>
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-gray-400">트랜잭션 기록이 없습니다</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {showTxForm && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowTxForm(false)}>
              <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-bold mb-4">트랜잭션 추가</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-500 mb-1 block">TX Hash</label>
                    <input value={txForm.tx_hash} onChange={e => setTxForm({ ...txForm, tx_hash: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]" placeholder="0x..." />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">From 주소</label>
                    <input value={txForm.from_address} onChange={e => setTxForm({ ...txForm, from_address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]" placeholder="0x..." />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">To 주소</label>
                    <input value={txForm.to_address} onChange={e => setTxForm({ ...txForm, to_address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]" placeholder="0x..." />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">금액</label>
                    <input type="number" value={txForm.amount} onChange={e => setTxForm({ ...txForm, amount: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">토큰</label>
                    <select value={txForm.token} onChange={e => setTxForm({ ...txForm, token: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]">
                      <option value="USDT">USDT</option>
                      <option value="TON">TON</option>
                      <option value="ETH">ETH</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">일시</label>
                    <input type="datetime-local" value={txForm.timestamp} onChange={e => setTxForm({ ...txForm, timestamp: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">상태</label>
                    <select value={txForm.status} onChange={e => setTxForm({ ...txForm, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]">
                      <option value="confirmed">완료</option>
                      <option value="pending">대기</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-500 mb-1 block">메모</label>
                    <input value={txForm.note} onChange={e => setTxForm({ ...txForm, note: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]" placeholder="예: 3월 급여 지급" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-5">
                  <button onClick={() => setShowTxForm(false)} className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-300 hover:bg-gray-50">취소</button>
                  <button onClick={handleTxSave} disabled={txSaving}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#2A72E5] hover:bg-[#1E5FCC] disabled:opacity-50">
                    {txSaving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* 급여 수정 모달 */}
      {editingPayroll && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditingPayroll(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editingPayroll.name} - {year}년 {month}월 급여 수정</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">USDT 지급액</label>
                <input type="number" value={pForm.usdt_amount} onChange={e => updatePField("usdt_amount", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">환율 (KRW/USD)</label>
                <input type="number" step="0.01" value={pForm.krw_rate} onChange={e => updatePField("krw_rate", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">KRW 환산액</label>
                <input type="number" value={pForm.krw_amount} onChange={e => updatePField("krw_amount", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5] bg-gray-50" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">세금 (KRW)</label>
                <input type="number" value={pForm.tax_simulated} onChange={e => updatePField("tax_simulated", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">실지급 (KRW)</label>
                <input type="number" value={pForm.net_pay_krw} readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">상태</label>
                <select value={pForm.status} onChange={e => setPForm({ ...pForm, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A72E5]">
                  <option value="estimated">예상</option>
                  <option value="confirmed">확정</option>
                  <option value="paid">지급완료</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditingPayroll(null)} className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-300 hover:bg-gray-50">취소</button>
              <button onClick={handlePayrollUpdate} disabled={pSaving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#2A72E5] hover:bg-[#1E5FCC] disabled:opacity-50">
                {pSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
