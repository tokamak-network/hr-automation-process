---
title: A 작업지시서 — 경비 정산 에이전트 영속화 (Claude Code용)
status: ready-for-claude-code
owner: Member 2
created: 2026-06-15
repo: tokamak-network/hr-automation-process  (public)
related: expense-agent-and-hr-architecture.md  (§2 = 에이전트 사양)
placement: 이 파일을 repo `docs/`에 두고, `CLAUDE.md`에서 참조한다.
---

# A 작업지시서 — 경비 정산 에이전트 영속화

> [!summary] 목표
> 지금 Cowork로 수동 실행하는 경비 정산 루프를, repo 백엔드에 박아 **① 결정 이력 기록 → ② 매월 자동 트리거 → ③ 운영자 콘솔 승인**의 한 사이클로 완성한다. **지급 실행(텔레그램/메타마스크)은 자동화하지 않는다.**

> [!danger] 절대 안전선 (어떤 단계에서도 위반 금지)
> 1. **자동 지급 없음.** 백엔드는 결정을 *기록*만 한다. 실제 송금은 사람이 별도로 수행.
> 2. **데이터는 repo에 절대 커밋하지 않는다.** public repo다. DB·내보내기 파일은 repo 폴더 바깥.
> 3. 정산 기본 단위 = **USD**.

---

## §0. 선행: 보안 정리 (다른 모든 작업보다 먼저)

현재 빈 DB 파일들이 추적 중이라, 로컬 DB에 데이터가 쌓인 뒤 커밋하면 public에 푸시된다. 먼저 막는다. (과거 커밋에 실제 데이터는 없으므로 이력 세탁은 불필요.)

1. 추적 해제(로컬 파일은 유지):
   ```bash
   git rm --cached hiring.db backend/hiring.db-shm backend/hiring.db-wal
   ```
2. `.gitignore`에 추가:
   ```gitignore
   # data stores — never commit (public repo)
   *.db
   *.db-shm
   *.db-wal
   *.sqlite
   *.sqlite3
   /data/
   ```
3. 커밋·푸시. 이후 DB·데이터는 추적되지 않음.
4. 검증: `git ls-files | grep -iE '\.(db|sqlite)' ` 결과가 비어야 한다(`.env.example` 제외).

---

## §1. 데이터 저장 모델

- **엔진**: 단일 SQLite(기밀 인사데이터 일원화). 경비는 급여 테이블과 **분리된 전용 테이블**.
- **위치**: **repo 폴더 바깥.** 경로는 `.env`의 `HR_DB_PATH` 변수로 지정(기존 `.env` 패턴 재사용). 예: `HR_DB_PATH=/Users/jaden/hr-data/hr.db`
- **`.env.example`**: `HR_DB_PATH=` 빈 항목 추가(실제 경로는 커밋 금지).
- 모든 내보내기(CSV 등)도 repo 바깥 같은 폴더로.

---

## §2. 스키마 — `expense_decisions` 테이블

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | INTEGER PK | |
| period | TEXT | 귀속월 `YYYY-MM` |
| submitter | TEXT | 제출자(=Drive 폴더명) |
| vendor | TEXT | |
| item | TEXT | 항목/내역 |
| reason | TEXT | 제출 사유(없으면 NULL) |
| amount_original | REAL | 원금액 |
| currency_original | TEXT | 원통화(EUR/KRW/SGD/USD…) |
| fx_date_estimate | DATE | 결제일(영수증상) |
| fx_rate_estimate | REAL | 결제일 종가(→USD) |
| amount_usd_estimate | REAL | 추산 USD |
| payment_date | DATE | 지급일(지급 결정 시) |
| fx_date_confirmed | DATE | 지급일 D-1 |
| fx_rate_confirmed | REAL | 지급일 D-1 종가(→USD) |
| amount_usd_confirmed | REAL | 확정 USD(지급 결정 전 NULL) |
| evidence_status | TEXT | `complete` / `incomplete` |
| evidence_ref | TEXT | Drive 파일 링크/ID |
| flags | TEXT | 보류 사유(중복의심/청구서아님/결제일불명 등, JSON 또는 콤마) |
| decision | TEXT | `pending` / `paid` / `hold` / `more_docs` |
| decided_by | TEXT | |
| decided_at | DATETIME | |
| created_at / updated_at | DATETIME | |

> 추산 USD는 ingest 시 채움. 확정 USD·payment_date·fx_confirmed는 **지급 결정 시**에만 채움.

---

## §3. API 엔드포인트 (FastAPI, 기존 backend 확장)

기존 backend(포트 8001)에 라우트 추가. 새 서비스/포트 신설 금지(스프롤 방지).

| Method | Endpoint | 설명 |
|---|---|---|
| POST | `/api/expenses/ingest` | 구조화된 정산 행 배열을 받아 `pending`으로 적재. (에이전트 출력 또는 향후 Drive 리더가 동일 엔드포인트로 투입) 중복 적재 방지(같은 period+submitter+vendor+amount+fx_date 키). |
| GET | `/api/expenses?period=YYYY-MM` | 해당 월 목록(결정용/보류 분리 가능) |
| GET | `/api/expenses/{id}` | 상세 |
| POST | `/api/expenses/{id}/decision` | 결정 기록. body: `decision`, (지급 시)`payment_date`. **지급 시 백엔드가 D-1 종가로 확정 USD 산출·기록.** 송금은 하지 않음. |
| GET | `/api/expenses/summary?period=YYYY-MM` | 제출자별 합계(확정분 USD) |

- 인증: 기존 역할 기반 접근통제 적용. 경비/급여는 기밀 → **operator 역할만** 접근. viewer 차단.
- `ingest`는 **읽은 데이터를 적재만** 한다. 어떤 송금/외부 전송도 하지 않는다.

---

## §4. 운영자 콘솔 — 승인 화면 (frontend, 얇게)

- 신규 페이지: 월 선택 → `pending` 목록 표시.
- 각 행: §2 결정용 한 줄(제출자·원금액·추산USD·vendor·증빙상태·flags).
- 버튼: **지급 / 보류 / 추가증빙요청**.
  - 지급 클릭 → payment_date 입력 → `POST /decision` 호출 → 백엔드가 확정 USD 계산·기록.
- **UI 경계 규칙(상위 문서 §1)**: UI는 표시·호출만. 환율 계산·확정 USD 산출은 **백엔드**에서. UI에 로직을 넣지 말 것.
- 이 화면은 기밀 데이터 → operator 인증 필수.

---

## §5. 자동 트리거 (매월)

- 매월 정해진 날, **현재 월** 폴더 대상으로 ingest를 1회 실행하고 텔레그램으로 "이번 달 N건 정산 대기" 통지.
- **데이터가 repo 바깥/로컬에 있으므로 스케줄러도 로컬에서 동작**해야 한다(클라우드 GitHub Actions는 로컬 DB·Drive 자격증명에 접근하면 안 됨). 로컬 cron 또는 백엔드 내장 스케줄러 사용.
- 트리거는 **적재·통지까지만.** 지급은 사람이 승인.

---

## §6. 완료 기준 (Definition of Done)

- [ ] §0 보안 정리 커밋·푸시 완료, `git ls-files`에 DB 미추적 확인.
- [ ] `HR_DB_PATH`로 repo 바깥 SQLite 사용, `expense_decisions` 테이블 생성.
- [ ] ingest → 목록 → 결정(지급/보류/추가증빙) → 합계 엔드포인트 동작.
- [ ] 지급 결정 시 확정 USD가 D-1 종가로 기록되고, **송금은 일어나지 않음**.
- [ ] 승인 화면에서 한 달치 결정이 가능, operator 인증 적용.
- [ ] 매월 트리거가 적재+통지(지급 아님)까지 수행.

---

## CLAUDE.md 추가 스니펫

```md
## 경비 정산 모듈 (A)
- 사양: docs/A-workorder-expense-persistence.md, docs/expense-agent-and-hr-architecture.md(§2)
- 절대 규칙: 자동 지급 없음 / 데이터는 repo 커밋 금지(public) / 정산 단위 USD
- DB는 HR_DB_PATH(repo 바깥). 작업 전 docs의 §0 보안 정리 상태 확인.
```
