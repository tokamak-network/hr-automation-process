---
title: 채용 지원 감지 운영 매뉴얼 / Recruiting Intake — Operations Manual
audience: Member 2 (운영) + 후임 인수인계 / operator + successor handover
status: living document
updated: 2026-06-19
related: docs/C1-workorder-recruiting-email-intake.md, docs/expense-operations-manual.md, docs/payroll-tax-operations-manual.md
note: 키·토큰·자격증명·후보 개인정보 금지. 메인 채용 트랙(링크드인 공고 → hr@ 이메일 제출)을 시스템에 연결.
       공통 챕터(안전선·보안대응·로컬/클라우드 분리)는 다른 매뉴얼과 중복 — 추후 통합 매뉴얼에서 합칠 것.
---

# 채용 지원 감지 운영 매뉴얼
# Recruiting Intake — Operations Manual

> [!summary] 한 줄 / In one line
> `hr@`로 온 지원 메일을 감지해 repo·지갑·이름을 뽑고 → 사람이 검토·승인하면 → Candidates에 등록하는 보조 시스템.
> Detect application emails in `hr@`, extract repo/wallet/name, and register to Candidates only on human approval.

> [!important] 시스템의 역할 / What this system is for
> 링크드인 공고로 들어오는 지원(이메일+Deliverable)을 시스템에 연결. **감지·검토까지만 자동**, 등록은 사람이 승인. Monitor/Sourcing 트랙은 현상 유지(정교화 안 함).
> Brings the main inbound track into the system. Detection is automated; **registration requires human approval**.

---

## 0. 시스템 구조 / How it fits together

- **백엔드 / Backend** (`localhost:8001`) — Gmail 읽기, 감지, staging 적재, 검토 게이트. / Gmail read, detect, stage, review gate.
- **프론트엔드 / Frontend** (`localhost:3002`, Candidates 화면) — "감지됨(검토 대기)" 섹션 + "새 지원 확인" 버튼 + 승인. / detection section + scan button + approve.
- **Gmail** — `hr@tokamak.network` 메일함, **읽기 전용**(gmail.readonly). 토큰은 백엔드 `.env` 경로. / read-only.
- **DB** — staging(`detected_applicants`) + 본테이블(`candidates`). 로컬 PG(평소) / 클라우드 Supabase(실데이터). / local PG vs cloud.

---

## 1. 매주 지원 확인 동선 / Weekly intake routine

자동(주 2회)과 수동 둘 다 가능. / Twice-weekly auto + manual.

1. **자동 / Auto** — 주 2회(월·목) 스케줄러가 스캔해 감지·알림. / scheduled scan + alert.
2. **수동 / Manual** — Candidates 화면의 **"새 지원 확인"** 버튼, 또는 `POST /api/candidates/scan-inbox`. / scan button.
3. **감지 결과 확인 / Review** — "감지됨(검토 대기)" 섹션에서 발신자·repo·지갑·사유 확인. / check detections.
4. **승인 / Approve** — 지원이 맞으면 **"등록 승인"** → Candidates에 `submitted`로 등록. / approve to register.
5. **평가로 연결 / To evaluation** — 등록 후보는 기존 analyze(AI 평가)→review→reward 흐름으로. / existing pipeline.

> [!tip] 지갑 대기 / Wallet pending
> repo만 오고 지갑이 아직이면 "지갑 대기"로 **승인 보류**(422). 후속 메일에서 지갑이 오면 같은 후보에 자동 누적됨. 그때 승인.
> Repo-only → approval held until the wallet arrives in a later email (auto-accumulated by sender).

---

## 2. 감지 규칙 / Detection rules

| 항목 / Item | 규칙 / Rule |
|---|---|
| 지원 신호 / signal | GitHub repo 링크 + ERC-20 지갑(0x+40hex). / repo + wallet. |
| 지갑 검증 / wallet check | 0x+40hex만. 컨트랙트 주소·트랜잭션 해시 제외. / exclude contracts & tx hashes. |
| 발신자 단위 / per sender | 같은 발신자의 여러 메일을 한 후보로 누적(repo·지갑 다른 메일이어도). / accumulate by sender. |
| 내부 제외 / internal | `@tokamak.network`(우리 측) 발신은 후보에서 제외. 스레드 답장 오감지 방지. / exclude our domain. |
| 제외 / excluded | repo·지갑 둘 다 없는 협업·문의·뉴스레터는 후보 아님. / non-applications excluded. |

> 내부 제외 설정(.env): `INTAKE_INTERNAL_DOMAINS`(기본 tokamak.network), `INTAKE_INTERNAL_EMAILS`. / configurable.

---

## 3. Gmail 토큰 설정 / Gmail token setup (최초 1회 + 만료 시 / one-time + on expiry)

> 실제 자격증명은 **직접** 처리. 토큰·credentials는 절대 커밋 금지(.gitignore 됨). / handle credentials yourself; never commit.

1. **Google Cloud Console** (hr@로 로그인) — 프로젝트 → Gmail API 사용 설정. / enable Gmail API.
2. **OAuth 클라이언트(데스크톱 앱) 생성** → JSON 다운로드 → `backend/gmail_credentials.json`으로 저장. / desktop-app client.
3. **토큰 발급**: `cd backend && venv/bin/python gen-gmail-token.py` → 브라우저에서 **반드시 hr@로 로그인** → `gmail_token.json` 생성. / log in as hr@.
4. **.env 설정**(경로는 실행 위치 기준, backend/ 안에서 띄우면 파일명만):
   ```
   GMAIL_USER=hr@tokamak.network
   GMAIL_TOKEN_PATH=gmail_token.json
   GMAIL_CREDENTIALS_PATH=gmail_credentials.json
   CANDIDATE_SCAN_DAYS=14
   ```
5. **확인**: `venv/bin/python -c "import gmail_intake as g; print(g.status())"` → `configured: True`. / verify.

> 권한은 **읽기 전용**만. 발송·삭제 권한 주지 말 것. 토큰 파일 권한 600. / read-only scope only.

---

## 4. 로컬 / 클라우드 모드 / Local vs Cloud (실데이터 / real data)

| | 로컬 (평소·기본) / Local | 클라우드 (실데이터) / Cloud |
|---|---|---|
| DB | `localhost:5433/hr_local` | Supabase (실데이터) |
| 실행 / run | `venv/bin/uvicorn main:app --port 8001` | `./run-cloud.sh` → `yes` |
| 용도 / use | 개발·테스트(시드·더미) | 실 후보 확인·실제 등록 |
| 사전 / prep | `docker compose up -d`(로컬 PG) | 없음 |

> [!warning] 클라우드 주의 / Cloud caution
> 클라우드 모드에선 쓰기가 **실데이터에 즉시 반영**. 테스트·실험은 로컬에서. 클라우드는 실제 운영(실 후보 등록)일 때만.
> Writes in cloud mode hit real data immediately. Test locally; use cloud only for real operations.

---

## 5. 절대 안전선 / Hard safety lines

1. **Gmail 읽기 전용.** 발송·삭제·자동 회신 없음. / read-only, no auto-reply.
2. **자동 등록 없음.** 감지·staging까지만 자동, 등록은 사람이 승인. / no auto-registration.
3. **데이터·토큰·키 repo 커밋 금지** (public). / never commit secrets.
4. **클라우드 쓰기는 신중히.** 테스트는 로컬, 클라우드는 실운영만. RLS 기본 거부 유지. / cloud writes only for real ops.

---

## 6. 문제 대응 / Troubleshooting

| 증상 / Symptom | 확인 / Check |
|---|---|
| `gmail_configured: false` | .env 경로(실행 위치 기준 파일명), 토큰 파일 존재, status() 확인. / paths & token. |
| 스캔 0건 / scanned 0 | CANDIDATE_SCAN_DAYS 범위, 토큰 유효, 기간 내 메일 있는지. / scan window & token. |
| 우리 측 메일이 후보로 / internal detected | INTAKE_INTERNAL_DOMAINS/EMAILS 설정 확인. / internal-exclude config. |
| 화면이 실데이터 아님 / not real data | 로컬 모드라 로컬 PG를 봄. 실데이터는 ./run-cloud.sh. / local vs cloud mode. |
| 포트 충돌 / address in use | `lsof -ti:8001 \| xargs kill -9` 후 재기동. / kill stale process. |
| 승인 보류(422) / approval held | 지갑 대기 등 사유 표시. 후속 지갑 메일 오면 누적 후 승인. / wallet pending. |

---

## 7. 용어 / Glossary

- **staging / 감지됨** — `detected_applicants`. 감지됐으나 아직 미등록(검토 대기). / detected, not yet registered.
- **검토 게이트 / review gate** — 사람이 승인해야 candidates에 등록되는 관문. / human approval before registration.
- **source** — 후보 유입 경로: `email_auto`(자동 감지) / `manual`(수기). / candidate origin.
- **내부 발신자 / internal sender** — `@tokamak.network` 등 우리 측. 후보에서 제외. / our side, excluded.
- **run-cloud.sh** — 클라우드(실데이터) 접속 스크립트(비추적). 경고+yes 게이트. / cloud-access script.
