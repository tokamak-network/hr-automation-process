---
title: B 작업지시서 — 급여(Service Fee) 세금 정확성·과세 히스토리 (Claude Code용)
status: ready-for-claude-code
owner: Member 2
created: 2026-06-15
repo: tokamak-network/hr-automation-process  (public)
related: docs/A2-workorder-expense-supabase-integration.md (A 패턴 복제), docs/expense-operations-manual.md
note: A(경비) 완성 패턴을 급여에 복제. 본체는 스프레드시트, 시스템은 "세금 정확성 + 과세 히스토리" 보조.
---

# B 작업지시서 — 급여 세금 정확성·과세 히스토리

> [!summary] 목표 / Goal
> 급여(Service Fee)의 **과세 정확성**을 잡고 **과세 히스토리**를 남긴다. 스프레드시트가 본체이고, 시스템은 ① 지급일 환율로 정확한 과세표준(KRW) 산출 ② 간이세액표 세금 계산 ③ 한국 거주자만 원천징수 ④ 월별 과세 기록 누적을 담당한다.

> [!danger] 절대 안전선 / Hard lines
> 1. **자동 지급 없음.** `/pay`는 status만 변경, 송금 코드 절대 없음. (이미 그러함 — 유지)
> 2. **데이터·키 repo 커밋 금지** (public). DB는 Supabase, 백엔드(postgres role) 경유.
> 3. **RLS 기본 거부 유지.**
> 4. 세금은 **간이세액표 100% 기준(보수적)**. 세금 방식은 **교체 가능하게** 설계(추후 3.3% 전환 대비).

---

## §0. 현황 (as-is) — 분석으로 확인된 것

- **저장**: `payrolls`(Supabase PostgreSQL), 메인 백엔드(8001). 경비와 같은 DB. `payroll/` 폴더는 옛 프로토타입 → 무시.
- **상태 흐름**: `estimated → confirmed → paid`. `/pay`는 송금 안 함(상태만). ✅ 안전선 이미 충족.
- **경비 연동**: `recalculate`가 총액 = Service Fee + 그 달 경비(SUM)로 합산, 세금은 Service Fee만(경비 비과세). ✅ 유지.
- **세금 엔진**: `tax_calculator.py` = 2026 간이세액표 + 고소득 공식 + 지방세 10% + 자녀공제 + 80/100/120%. **정확함 → 그대로 활용.**

### 발견된 약점 (B에서 고친다)
1. **환율 mock**: `/api/market/usdt`가 `1352.50` 고정. 과세표준 KRW가 가짜 환율 기반.
2. **환율 시점 개념 없음**: 지급일 종가로 환산하는 로직 부재.
3. **부양가족 미반영**: `recalculate`가 `num_dependents`를 안 넘겨 전원 "1명" 고정 계산.
4. **거주지 구분 없음**: `hr_members`에 거주지 필드 없음. 비거주자도 과세 계산됨.
5. **업로드 템플릿에 부양가족 칸 없음**: 현재 컬럼 = 연도·월·이름·USDT·환율(선택)·세금(선택).

---

## §1. ECOS 날짜 기반 환율 (mock 제거)

- USDT/KRW 환율을 **ECOS API**(한국은행, 키는 백엔드 `.env`에 기존 존재)로 조회. USDT≈USD 1:1 가정(주석 명시).
- **날짜 입력 방식**: 지급일이 매월 변동하므로, 운영자가 **환율 기준일(날짜)을 입력**하면 그 날짜의 종가를 조회. (자동 D-1 아님)
  - 해당일 종가가 없으면(주말·공휴일) 직전 영업일 종가 사용.
- 세금 시뮬레이션에 이미 있는 ECOS 날짜 조회 로직을 **급여 관리로 재사용/이식**.
- `payrolls.krw_rate`에 조회된 환율, `krw_amount = usdt_amount × krw_rate` 저장.
- mock `/api/market/usdt` 고정값은 과세 계산 경로에서 제거(표시용으로만 남기려면 mock 표기 유지).

---

## §2. 부양가족 — 업로드 템플릿에서 받기

- **업로드 템플릿에 `부양가족수` 컬럼 추가** (현재 없음). 권장 컬럼: 연도·월·이름·USDT·**부양가족수**·환율(선택)·세금(선택).
- `/api/hr/payroll/upload`가 그 값을 읽어 `payrolls`에 저장하고, 세금 계산 시 `calculate_tax(..., num_dependents=부양가족수)`로 넘긴다.
- 자녀 수(`num_children_8_20`)는 템플릿에 없으면 **0으로(자녀공제 미적용 = 더 보수적)**.
- `payrolls`에 `num_dependents INTEGER DEFAULT 1` 컬럼 추가(히스토리에 남기기 위함).

---

## §3. 거주지 분기 — 비거주자 세액 0

- `hr_members`에 **`tax_treatment` (TEXT)** 컬럼 추가. 값: `kr_resident`(간이세액표) / `non_resident`(세액 0). 기본값 `kr_resident`.
  - (단순 boolean보다 문자열로 둬서 추후 `kr_3_3` 등 확장 대비.)
- 세금 계산 분기:
  - `kr_resident` → `calculate_tax()`로 간이세액표 100% 적용.
  - `non_resident` → **세액 0**. 단, 히스토리엔 행을 남기고 `tax_simulated=0`으로 기록(과세 0도 기록으로 추적).
- 계약 형태는 독립계약자 → 한국 거주자만 회사가 원천징수. 이 분기가 그것을 구현.

---

## §4. 세금 계산 — 보수적 100%, 교체 가능하게

- `tax_calculator.calculate_tax()` 그대로 사용, **`total_tax_100`(100% 기준)** 채택. (이미 `recalculate`가 100% 사용 — 유지)
- 세금 계산을 **한 함수/한 곳**으로 모아, 추후 "간이세액표 → 3.3%" 전환 시 그곳만 바꾸면 되게 한다.
  - 예: `compute_withholding(member, taxable_krw)` 내부에서 `tax_treatment`에 따라 분기. 나중에 `kr_3_3` 케이스 추가 가능.

---

## §5. 과세 히스토리 (B의 핵심 산출물)

- `recalculate`(또는 신규 계산 엔드포인트)가 매달 다음을 `payrolls`에 남긴다:
  - 과세표준(`krw_amount`), 적용환율(`krw_rate`), **환율 기준일**(신규 컬럼 `fx_date DATE`), 세액(`tax_simulated`), 실지급(`net_pay_krw`), 부양가족수, `tax_treatment`.
- 월별·연도별 조회가 되어, "누가 언제 얼마 과세됐는가"가 누적·추적 가능.
- 이게 Member 2님이 시스템을 쓰는 1차 목적(세금 정확성 + 과세 히스토리)을 충족.

---

## §6. 입력 흐름 (현행 유지)

- 기본 Service Fee는 팀원 카드(`hr_members.monthly_usdt`)에 기록(현행).
- 실제 급여 작업은 **엑셀 템플릿 다운로드 → 수기 기입 → 업로드** (현행 유지). §2에서 템플릿에 부양가족 칸만 추가.
- 시스템은 스프레드시트를 대체하지 않는다. 세금·히스토리 보조 역할.

---

## §7. 완료 기준 (DoD)

- [ ] ECOS 날짜 입력 → 종가 조회 → `krw_rate`/`krw_amount` 산출(주말 직전영업일 처리), mock 의존 제거.
- [ ] 업로드 템플릿에 부양가족수 컬럼, upload가 읽어 계산·저장.
- [ ] `hr_members.tax_treatment` 추가, 비거주자 세액 0(행은 기록).
- [ ] 세금 100% 보수적, 계산이 한 곳에 모여 방식 교체 가능.
- [ ] `payrolls`에 `fx_date`·`num_dependents` 추가, 월별 과세 히스토리 조회 가능.
- [ ] `/pay`에 송금 코드 없음(재확인), RLS 기본 거부 유지, 데이터·키 미커밋.

---

## §8. 검증 시나리오 (구현 후)

1. 한국 거주자 1명: USDT 급여 + 환율 기준일 입력 → KRW 환산이 그 날짜 ECOS 종가로 맞는가, 간이세액표 세액이 부양가족수 반영해 산출되는가.
2. 비거주자 1명: 같은 입력 → **세액 0**, 단 행은 남고 `tax_treatment=non_resident`로 기록되는가.
3. 부양가족 수 다른 2명 비교 → 세액이 다르게(부양가족 많을수록 적게) 나오는가.
4. 경비 합산: 같은 달 그 사람 경비가 있으면 총 지급액에 합산되되 **세금은 Service Fee만** 잡히는가.
5. 과세 히스토리: 월별 조회 시 과세표준·환율·환율일·세액·실지급이 누적 표시되는가.
6. `/pay` 호출 시 송금 0건(상태만 변경)인가.

---

## §9. 검증 후

- 급여 운영 매뉴얼 챕터 작성 — `expense-operations-manual.md`와 **같은 구조**로(통합 매뉴얼 대비).
- 공통 챕터(안전선·보안대응·3계층)는 중복 작성 말고, 통합 시 합칠 것을 전제로 표시.
