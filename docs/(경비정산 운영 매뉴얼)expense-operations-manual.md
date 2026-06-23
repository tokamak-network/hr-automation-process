---
title: 경비 정산 시스템 운영 매뉴얼 / Expense Settlement — Operations Manual
audience: Member 2 (운영) + 후임 인수인계 / operator + successor handover
status: living document
updated: 2026-06-23
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

> [!important] 먼저 — 어느 DB에 작업하는가 / First: which DB?
> 실제 경비를 기록하려면 백엔드를 **클라우드 모드**로 띄워야 한다(§8 참조). 그냥 테스트면 로컬 모드. 화면이 실데이터를 보여주는지 먼저 확인할 것.
> To record real expenses, run the backend in **cloud mode** (§8). For a dry run, local mode is fine. Confirm which one before you start.

1. **Cowork로 증빙 읽기 (JSON으로 받기) / Parse with Cowork (ask for JSON)**
   - Cowork에 킥오프 프롬프트 + `expense-agent-and-hr-architecture.md` 첨부, 대상 폴더를 그 달로 지정(예: `2026 > 6월`).
   - **중요: Cowork에게 결과를 "아래 형식의 JSON 배열로" 출력하라고 요청한다.** 시스템 입력란이 JSON만 받기 때문. (사람이 보기 좋은 표가 아니라 JSON)
   - JSON 각 항목 필드: `submitter`(폴더명/제출자), `vendor`, `item`, `category`, `amount_original`(숫자), `currency_original`(예: USDT/EUR/SGD), `fx_date_estimate`(YYYY-MM-DD), `evidence_status`(complete/partial 등).
   - Ask Cowork to output a **JSON array** (not a human-readable table), since the ingest box only accepts JSON.

2. **승인 화면에 붙여넣어 적재 / Paste into the approval screen & ingest**
   - 승인 화면(`/hr/expense-decisions`) 상단 **"경비 표 붙여넣기 → 적재"** 패널을 연다. (열기 ▼)
   - Cowork가 준 **JSON을 입력란에 그대로 붙여넣고** "적재" 버튼 클릭. 오른쪽에 예시 형식이 보인다.
   - 적재 대상 기간은 화면 상단의 **연도/월**을 따른다(JSON에 `period`가 있으면 그 값 우선).
   - 백엔드가 자동으로: 폴더명→멤버 매핑, 비-USDT는 환율로 USDT 추산, 중복 제외, 매핑실패는 보류.
   - 결과 표시 확인: **적재 N건 / 중복 제외 N건 / 매핑실패 폴더명 / 환율 미확보**. 매핑실패가 있으면 폴더명을 맞춘 뒤 다시 적재(중복은 자동 제외).
   - 등록·결제는 일어나지 않고 **검토 대기(pending)**로만 들어간다.

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

> [!note] Cowork에게 줄 출력 지시 예 / What to tell Cowork
> "정리한 경비를 다음 형식의 JSON 배열로만 출력해줘: `[{submitter, vendor, item, category, amount_original, currency_original, fx_date_estimate, evidence_status}, ...]`. 설명 없이 JSON만."
> Ask Cowork to emit only a JSON array in that shape — no prose, just JSON — so you can paste it straight into the ingest box.

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
| 화면 데이터가 예상과 다름 / wrong data on screen | 로컬/클라우드 모드 혼동일 수 있음 → §8. 실데이터는 클라우드(`run-cloud.sh`), 연습은 로컬. / local vs cloud mix-up; see §8. |
| 붙여넣었는데 형식 오류 / paste format error | 입력란은 **JSON만** 받음. Cowork에게 JSON 배열로 출력 요청(§1). 화면 오른쪽 예시 형식 참고. / box accepts JSON only; ask Cowork for a JSON array. |
| 적재 시 500 에러 / 500 on ingest | 로컬 DB 스키마가 오래됐을 수 있음 → 로컬 PG를 최신 migrate로 다시 생성. (클라우드와 스키마 일치 필요) / stale local schema; recreate local PG with latest migrate. |
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

---

## 8. 로컬 / 클라우드 모드 / Local vs Cloud (실데이터 / real data)

> [!important] 가장 헷갈리는 부분 / The easy-to-confuse part
> 시스템은 두 개의 DB를 오갈 수 있다. **지금 어느 쪽에 작업하는지** 늘 의식할 것. 실제 경비를 기록하려면 클라우드, 연습·테스트면 로컬.
> The system can talk to two DBs. Always know which one you're on. Cloud = real records; local = practice/test.

| | 로컬 (평소·연습) / Local | 클라우드 (실데이터) / Cloud |
|---|---|---|
| DB | `localhost:5433/hr_local` (테스트용) | Supabase (실제 경비 데이터) |
| 실행 / run | `cd backend && venv/bin/uvicorn main:app --port 8001` | `cd backend && ./run-cloud.sh` → `yes` |
| 용도 / use | 붙여넣기·적재 연습, 화면 확인 | 실제 월말 정산·기록 |
| 사전 / prep | `docker compose up -d` (로컬 PG 기동) | 없음 |
| 표시 / sign | 시작 로그에 `localhost:5433` | 시작 시 `⚠️ 클라우드(실데이터)에 접속` 경고 + `yes` |

> [!warning] 클라우드 주의 / Cloud caution
> 클라우드 모드에선 적재·지급이 **실데이터에 즉시 반영**된다. 연습은 반드시 로컬에서. 실제 정산일 때만 클라우드.
> In cloud mode, ingest/pay hit real data immediately. Practice locally; use cloud only for the real month-end run.

> [!note] 모드 확인 / How to check which mode
> 백엔드를 띄운 터미널의 시작 로그를 본다 — `Using PostgreSQL: ...localhost:5433...`이면 로컬, `...supabase...`이면 클라우드. 헷갈리면 백엔드를 끄고(`lsof -ti:8001 | xargs kill -9`) 원하는 모드로 다시 띄운다.
> Check the backend startup log: `localhost:5433` = local, `supabase` = cloud. When unsure, kill and restart in the mode you want.

> [!tip] 장기적으로 / Long term
> 배포를 하면 이 로컬/클라우드 구분과 터미널 작업 자체가 사라진다(브라우저로 접속만). 배포는 보안·호스팅이 따르는 별도 결정.
> Deploying removes this local/cloud split and the terminal work entirely (just open a browser). Deployment is a separate decision with its own security/hosting steps.
