---
title: 경비 정산 시스템 운영 매뉴얼 / Expense Settlement — Operations Manual
audience: Member 2 (운영) + 후임 인수인계 / operator + successor handover
status: living document
updated: 2026-06-15
related: docs/A2-workorder-expense-supabase-integration.md, docs/expense-agent-and-hr-architecture.md
note: 이 문서에는 키·지갑주소·급여액 등 민감정보를 넣지 않는다. / No secrets, wallet addresses, or salary figures in this file.
---

# 경비 정산 시스템 운영 매뉴얼
# Expense Settlement — Operations Manual

> [!summary] 한 줄 / In one line
> 팀원이 낸 경비 증빙을, AI가 읽어 정리하고 → 운영자가 지급 여부만 판단하고 → 같은 데이터가 정산 장부에 자동 반영되는 시스템.
> Team members' expense receipts are parsed by AI → the operator only decides pay/hold → the same record flows automatically into the settlement ledger.

---

## 0. 시스템 구조 / How it fits together

세 조각이 한 줄로 흐른다. / Three pieces in one flow:

1. **Claude Cowork** (클라우드) — Google Drive의 증빙을 읽어 표로 만든다. / reads Drive receipts, produces a table.
2. **백엔드 / Backend** (FastAPI, `localhost:8001`) — 환율 환산·기록·계산. Supabase `expenses` 테이블이 단일 진실의 원천. / FX conversion, recording; Supabase `expenses` is the single source of truth.
3. **프론트엔드 / Frontend** (`localhost:3002`) — 승인 화면(판단)과 정산 화면(장부). 같은 테이블을 본다. / approval screen + settlement ledger, reading the same table.

> 데이터는 Supabase(클라우드)에 있고, 접근은 항상 백엔드를 거친다. 프론트는 DB를 직접 읽지 않는다.
> Data lives in Supabase; access always goes through the backend. The frontend never reads the DB directly.

---

## 1. 매달 경비 정산 동선 / Monthly settlement routine

매월 말(예: 30일) 운영자가 하는 4단계. / Four steps the operator runs at month-end.

1. **Cowork로 증빙 읽기 / Parse with Cowork**
   - Cowork에 킥오프 프롬프트 + `expense-agent-and-hr-architecture.md` 첨부, 대상 폴더를 그 달로 지정(예: `2026 > 6월`).
   - Attach the kickoff prompt + architecture doc; point it at that month's folder.
   - 결과: 제출자별 결정용 표 + 보류 목록. / Output: per-submitter decision table + hold list.

2. **백엔드에 적재 / Ingest into the backend**
   - 승인 화면의 적재 입력란에 표를 넣고 적재(`POST /api/hr/expenses/ingest`).
   - Paste the table into the ingest box on the approval screen.
   - 백엔드가 폴더명→멤버 매핑, 비-USDT는 결제일 종가로 USDT 추산. / Backend maps folder→member, converts non-USDT at payment-date rate.
   - 결과의 `inserted / skipped_duplicates / mapping_failures` 숫자를 꼭 확인. / Always check these counts.

3. **승인 화면에서 판단 / Decide on the approval screen** (`/hr/expense-decisions`)
   - pending 목록을 훑으며 건별 **지급 / 보류 / 추가증빙요청**. / For each row: Pay / Hold / Request more docs.
   - 빨간 배경 `[unmapped]` 건은 매핑 실패 → §3 참조. / Red `[unmapped]` rows = mapping failure (see §3).
   - 업무 관련성은 운영자가 판단한다(시스템은 판단하지 않음). / The operator judges business-relevance; the system does not.

4. **지급 + 송금 / Pay + transfer**
   - "지급" 시 payment_date 입력 → 백엔드가 D-1 환율로 확정 USDT 산출. / On Pay, enter payment_date; backend computes confirmed USDT at D-1 rate.
   - **실제 송금(USDT)은 사람이 직접 한다.** 시스템은 송금하지 않는다. / Actual USDT transfer is done manually. The system never transfers.
   - 지급 처리한 건은 경비 정산 화면(`/hr/expenses`)에 자동으로 나타난다. / Paid items auto-appear in the settlement ledger.

> [!tip] 핵심 / Key point
> 증빙이 10건이든 30건이든 1·2단계는 동일하다. 늘어나는 건 3단계 판단 건수뿐이고, 한 줄 요약을 훑는 거라 건당 몇 초다.
> Steps 1–2 are the same whether there are 10 or 30 receipts; only the number of glances in step 3 grows.

---

## 2. 신규 팀원 추가 체크리스트 / Adding a new team member

새 사람이 경비 시스템에 온전히 들어오려면 **3가지가 다 맞아야** 한다. / Three things must all line up.

1. **시스템에 멤버 추가 / Add the member** (팀원 관리 → 팀원 추가)
   - **`Drive 폴더명`을 반드시 입력.** 비우면 경비 매핑이 실패한다(경고가 뜬다). / Fill in `Drive folder name`; leaving it blank breaks mapping (a warning shows).
   - 폴더명 = 그 사람의 표시 이름(예: `Theo`, `Jeongun Baek`). / Folder name = the member's display name.
2. **Drive에 폴더 생성 / Create the Drive folder**
   - 해당 연도/월 아래에 위 폴더명과 **정확히 같은** 이름으로 폴더를 만든다. / Create a folder with the exact same name under year/month.
3. **첫 증빙 제출 안내 / Tell them how to submit**
   - 증빙은 Slack DM으로 운영자에게 보내고, 운영자가 Drive 폴더에 정리(§4). / They send receipts via Slack DM; the operator files them in Drive.

> 폴더명 표기가 시스템과 Drive에서 한 글자라도 다르면 매핑이 실패한다(잘못 붙지는 않고 보류됨).
> If the folder name differs even slightly between the system and Drive, mapping fails (it won't misattribute — it holds).

---

## 3. 보류 건 처리 / Handling held items

승인 화면에서 hold/매핑실패로 잡힌 건의 대응. / What to do with held / mapping-failed rows.

| 보류 사유 / Reason | 대응 / Action |
|---|---|
| 매핑실패 (`[unmapped]`, 빨간 배경) | Drive 폴더명과 멤버의 `Drive 폴더명`이 일치하는지 확인·수정 후 재적재. / Fix the name match, re-ingest. |
| 증빙 누락·판독 불가 / missing or unreadable | 팀원에게 추가증빙 요청("추가증빙요청"). / Request more docs. |
| 신고액 ≠ 증빙액 / amount mismatch | 증빙 확인 후 판단. / Verify against the receipt. |
| 중복 의심 / suspected duplicate | 같은 건이 두 번 들어왔는지 확인(청구서 vs 영수증). / Check invoice-vs-receipt double entry. |
| 결제일 불명 / no payment date | 추산 환율을 못 잡으므로 보류. 결제일 있는 증빙 요청. / No FX possible; request a dated receipt. |

> 시스템은 형식 문제만 자동 보류한다. 업무 관련성은 운영자 판단 영역이다.
> The system auto-holds only formal issues; business-relevance is the operator's call.

---

## 4. 증빙 제출 규칙 / Evidence submission rules

- 팀원 → 운영자에게 **Slack DM**으로 증빙 제출. / Members submit via Slack DM.
- 운영자 → Google Drive `팀원 개인지출 증빙 / 연도 / 월 / 이름` 폴더에 정리. / Operator files into the year/month/name folder.
- 운영자가 Drive로 옮기는 행위 = 1차 접수 확인. 에이전트는 Drive에 올라온 것부터 처리. / Moving to Drive = intake confirmation; the agent handles what's in Drive.
- 통화는 무엇이든 가능(원통화 그대로). 시스템이 USDT로 환산. / Any currency is fine; the system converts to USDT.

---

## 5. 절대 안전선 / Hard safety lines

운영 중 어떤 경우에도 지킨다. / Never violated.

1. **자동 지급 없음.** 시스템은 결정·확정금액을 기록만 한다. 실제 USDT 송금은 항상 사람이 직접. / No auto-payment; transfers are always manual.
2. **데이터·키는 repo에 커밋 금지.** public repo다. DB 접근은 백엔드 경유. / Never commit data/keys; access via backend only.
3. **Supabase RLS는 기본 거부 유지.** 함부로 정책을 열지 않는다. / Keep RLS default-deny; don't open policies casually.
4. **정산 단위 = USDT.** 환산은 결제일(추산)·지급일 D-1(확정) 2단계. USD≈USDT 1:1 가정. / Unit USDT; two-stage FX; USD≈USDT assumed 1:1.

---

## 6. 문제 대응 / Troubleshooting

| 증상 / Symptom | 확인 / Check |
|---|---|
| 화면이 비어있음 / empty screen | 백엔드(8001)·프론트(3002)가 떠 있는가, `.env.local`에 Supabase 키가 있는가. / Are both servers up; is the key in `.env.local`. |
| 적재했는데 안 보임 / ingested but missing | `mapping_failures` 확인 — 보류로 빠졌을 수 있음. 폴더명 일치 점검. / Check mapping_failures; verify folder name. |
| 환산값이 이상 / odd FX value | 결제일이 증빙에 있는지, ECB 환율 조회가 됐는지. 결제일 없으면 보류가 정상. / Is there a payment date; ECB lookup ok. |
| 누구나 데이터가 읽힘(보안) / data readable by anyone | RLS가 켜져 있는지 즉시 확인. anon key가 코드/이력에 노출됐는지. → 발견 시 RLS ENABLE + 키 회전 + 보고. / Verify RLS on; check key exposure; if found, enable RLS, rotate key, report. |

> 보안 이슈는 등급과 무관하게 **먼저 차단(RLS)하고, 그다음 원인 정리(키), 그리고 경영진 보고** 순으로.
> For security issues: block first (RLS), then fix cause (key), then report to leadership.

---

## 7. 용어 / Glossary

- **추산 USDT / estimate** — 결제일 종가로 환산한 예상 금액. / amount at payment-date rate.
- **확정 USDT / confirmed** — 지급일 D-1 종가로 환산한 실제 지급 기준액. / amount at payment-minus-1 rate.
- **매핑실패 / mapping failure** — Drive 폴더명이 멤버와 안 맞아 보류된 상태. / held because folder name didn't match a member.
- **RLS** — Supabase Row Level Security. 꺼지면 anon key로 데이터가 노출된다. / row-level access control; if off, data is exposed.
