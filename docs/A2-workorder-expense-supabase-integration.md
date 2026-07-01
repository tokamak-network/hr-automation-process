---
title: A-2 작업지시서 — 경비 정산 Supabase 통합 (Claude Code용)
status: ready-for-claude-code
owner: Member 2
created: 2026-06-15
repo: tokamak-network/hr-automation-process  (public)
supersedes: docs/A-workorder-expense-persistence.md 의 "저장소" 부분 (로컬 SQLite → Supabase)
related: docs/expense-agent-and-hr-architecture.md (§2 = 에이전트 사양)
---

# A-2 작업지시서 — 경비 정산 Supabase 통합

> [!summary] 목표
> 오늘 로컬 SQLite로 만든 경비 승인 시스템을, **기존 Supabase `expenses` 테이블 위로 이전**한다. 그러면 경비 정산 화면과 경비 승인 화면이 **같은 한 테이블**을 보게 되어, 승인된 건이 자동으로 정산란에 반영된다. 진실의 원천을 하나로 모은다.

> [!danger] 절대 안전선 (위반 금지)
> 1. **자동 지급 없음.** 백엔드는 결정·확정금액을 *기록*만. 실제 송금은 사람이 별도.
> 2. **데이터·키는 repo 커밋 금지** (public repo). DB 접근은 백엔드(postgres role) 경유.
> 3. **RLS는 기본 거부(default-deny) 유지.** 이번 작업에서 RLS 정책을 새로 열지 말 것.
> 4. 정산 단위 = **USDT** (실제 송금 통화).

---

## §0. 배경 (왜 이 작업을 하는가)

- 오늘 만든 `expense_decisions`(로컬 SQLite)와 기존 `expenses`(Supabase PostgreSQL)가 **분리**돼 있어, 승인해도 정산란에 안 뜬다.
- `expenses`에는 이미 실데이터·`tx_hash`·`category`가 있고 클라우드에 있다 → **이쪽을 단일 원천으로 채택.**
- 로컬 SQLite(`~/hr-data/hr.db`, `expense_decisions`)는 **폐기.** (검증용 2건 외 실데이터 없음 → 마이그레이션 불필요, 그냥 버린다.)

---

## §1. 제출자 매핑 — `hr_members.drive_folder_name`

Cowork는 Drive **폴더명**으로 제출자를 식별, `expenses`는 `member_id`(FK)로 참조 → 둘을 잇는다.

1. `hr_members`에 **`drive_folder_name` (TEXT)** 컬럼 추가.
2. 초기값 = 각 멤버의 **표시 이름**으로 채운다:
   `Member 1, Member 2, Ale, Theo, Member 3, Zena, Jake, Thomas, Jeongun Baek`
   (GitHub 핸들 아님. Drive 폴더도 이 표기를 따른다.)
3. ingest 시: 폴더명 → `drive_folder_name` 매칭 → `member_id` 조회.
4. **매칭 실패 시: 임의로 갖다 붙이지 말고 "매핑 실패"로 보류**(`flags`에 기록, 적재는 하되 status 별도/혹은 errors로 반환). 엉뚱한 멤버에 기록되는 것보다 보류가 안전.

---

## §2. `expenses` 테이블 확장 (12컬럼 추가)

기존 컬럼(id, member_id, year, month, amount_usdt, category, description, tx_hash, memo, status, expense_date, created_at) 유지하고 아래 추가:

| 추가 컬럼 | 타입 | 용도 |
|---|---|---|
| vendor | TEXT | 거래처 |
| amount_original | REAL | 원통화 금액 |
| currency_original | TEXT | 원통화 (EUR/KRW/SGD/USD…) |
| fx_date_estimate | DATE | 결제일(추산 환율 기준일) |
| fx_rate_estimate | REAL | 추산 환율 (원통화→USDT) |
| amount_usdt_estimate | REAL | 추산 USDT |
| fx_date_confirmed | DATE | 지급일 D-1 |
| fx_rate_confirmed | REAL | 확정 환율 |
| amount_usdt_confirmed | REAL | 확정 USDT |
| evidence_status | TEXT | `complete`/`incomplete` |
| evidence_ref | TEXT | 증빙 링크/ID |
| flags | TEXT | 보류 사유(중복의심/청구서아님/매핑실패 등) |
| decided_by | TEXT | 결정자 |

> [!note] 단위·금액 칼럼 정리 (중요)
> - 환산 도착 통화 = **USDT.** 비-USDT(EUR 등)는 결제일 종가로 USDT 환산. (실무상 USD≈USDT 1:1 가정, ECB EUR→USD 환율 사용. 이 1:1 가정은 명시적으로 코드 주석에 남길 것.)
> - 기존 **`amount_usdt`** = 정산 화면이 표시하는 **확정/정산 금액**. 지급 확정 시 `amount_usdt_confirmed` 값으로 채운다. 레거시 행은 기존 값 유지.
> - 추산 단계: `amount_usdt_estimate`에 추산값, `amount_usdt`(확정)는 지급 전이므로 비움.
> - `decided_at`은 기존에 없으면 추가, 있으면 재사용.

---

## §3. status 값 확장

- 기존 메인 흐름 **`pending → approved → paid`** 유지(정산 화면의 일괄 버튼이 이걸 씀 → 깨지면 안 됨).
- 보류 상태 **`hold`**, 추가증빙 **`more_docs`** 를 추가.
- 승인 화면의 "지급/보류/추가증빙" 버튼 → 각각 `paid`(또는 `approved`)/`hold`/`more_docs`로 기록.

---

## §4. 백엔드 — 기존 expenses API 확장 (postgres role 경유)

기존 `/api/hr/expenses`(PostgreSQL, postgres role)에 정산 에이전트 기능을 통합. 로컬 SQLite용 `/api/expenses/*`는 **제거**.

| Method | Endpoint | 설명 |
|---|---|---|
| POST | `/api/hr/expenses/ingest` | 구조화 행 배열 적재. 폴더명→member_id 매핑(실패=보류). 비-USDT는 결제일 종가로 USDT 추산. 중복 방지(member_id+year+month+vendor+amount_original+fx_date). |
| GET | `/api/hr/expenses?year=&month=` | 목록(기존 정산 화면이 쓰는 것 + 신규 필드 포함) |
| POST | `/api/hr/expenses/{id}/decision` | `decision`(paid/approved/hold/more_docs), (지급 시)`payment_date`. 지급 시 백엔드가 D-1 종가로 `amount_usdt_confirmed`·`amount_usdt` 채움. **송금 안 함.** |

- 모든 접근은 백엔드(postgres role)로. 프론트가 Supabase를 직접 읽지 않는다(RLS 기본 거부 유지와 일관).

---

## §5. 프론트 — 두 화면을 한 테이블로 연결

- **경비 승인**(`/hr/expense-decisions`): 데이터 소스를 로컬 SQLite → `/api/hr/expenses`로 변경. pending/hold/more_docs 목록 표시, 지급/보류/추가증빙 버튼.
- **경비 정산**(`/hr/expenses`): 변경 최소. 같은 `expenses`를 읽으므로 **승인→지급 처리 시 자동으로 정산란에 반영**됨. 신규 필드(추산/확정 USDT, vendor, evidence) 표시 추가 정도.
- UI 경계 규칙: 표시·호출만. 환율 계산·매핑·확정금액 산출은 **백엔드**.

---

## §6. 정리 — 로컬 SQLite 폐기

- `backend/expense_db.py`(로컬 SQLite 모듈), `expense_decisions` 관련 코드, `HR_DB_PATH` 의존 제거.
- `main.py`의 `init_expense_db()` 호출 제거.
- 로컬 `~/hr-data/hr.db`는 삭제(검증 데이터뿐).
- §0 보안 정리(DB gitignore)는 그대로 둬도 무방.

---

## §7. 완료 기준 (DoD)

- [ ] `hr_members.drive_folder_name` 추가 + 9명 표시 이름으로 초기값 채움.
- [ ] `expenses`에 12컬럼 추가, status에 hold/more_docs.
- [ ] ingest: 폴더명→member_id 매핑, 실패=보류, 비-USDT→USDT 추산(ECB).
- [ ] 승인 화면이 `expenses`를 읽고, 지급 결정 시 확정 USDT가 D-1 종가로 기록 + **송금 없음**.
- [ ] **지급 처리한 건이 경비 정산 화면에 자동으로 나타난다** (통합 핵심 검증).
- [ ] 로컬 SQLite 코드·파일 제거, RLS는 기본 거부 유지.

---

## §8. 검증 시나리오 (구현 후)

1. 6월 Member A €216 영수증 1건을 `/api/hr/expenses/ingest`로 적재 → 폴더명 "Member A"가 member_id로 매핑되는가, 추산 USDT가 결제일 종가로 채워지는가.
2. 승인 화면에서 그 건 "지급"(payment_date=2026-06-16) → 확정 USDT가 D-1(6/12) 종가로 기록되는가, 송금 호출 0건인가.
3. **경비 정산 화면 6월을 열어 그 건이 보이는가** ← 통합 성공의 결정적 증거.
4. 매핑 실패 테스트: 존재하지 않는 폴더명 "Unknown"으로 ingest → 보류 처리되고 엉뚱한 멤버에 안 붙는가.
