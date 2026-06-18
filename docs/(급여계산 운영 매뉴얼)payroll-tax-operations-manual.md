---
title: 급여 세금 운영 매뉴얼 / Payroll Tax — Operations Manual
audience: Member 2 (운영) + 후임 인수인계 / operator + successor handover
status: living document
updated: 2026-06-15
related: docs/B-workorder-payroll-tax.md, docs/expense-operations-manual.md
note: 키·지갑주소·급여액 등 민감정보 금지. 본체는 스프레드시트, 시스템은 세금 정확성·과세 히스토리 보조.
       공통 챕터(시스템 구조·안전선·보안대응)는 경비 매뉴얼과 중복 — 추후 통합 매뉴얼에서 합칠 것.
---

# 급여 세금 운영 매뉴얼
# Payroll Tax — Operations Manual

> [!summary] 한 줄 / In one line
> Service Fee(USDT)를 지급일 환율로 KRW 환산해 → 한국 거주자에게 간이세액표로 원천징수 → 과세 내역을 누적 기록하는 보조 시스템.
> Convert the USDT service fee to KRW at the payment-date rate → withhold tax for Korean residents via the simplified table → keep a taxation history.

> [!important] 시스템의 역할 / What this system is for
> **본체는 스프레드시트.** 시스템은 두 가지만 한다 — ① 세금 계산의 정확성, ② 과세 금액 히스토리.
> The spreadsheet is the source of truth. This system only does: ① accurate tax calc, ② taxation history.

---

## 0. 시스템 구조 / How it fits together

- **백엔드 / Backend** (`localhost:8001`, Supabase) — ECOS 환율 조회, 세금 계산, `payrolls` 기록. 경비와 같은 DB. / FX lookup, tax calc, recording; same DB as expenses.
- **프론트엔드 / Frontend** (`localhost:3002/hr/payroll`) — 급여 관리·과세 히스토리 표시. / payroll + tax-history views.
- **세금 엔진 / Tax engine** — `tax_calculator.py` = 2026 한국 간이세액표(누진·지방세 10%·자녀공제). / 2026 KR simplified tax table.
- **환율 / FX** — ECOS API(한국은행) USD/KRW. USDT≈USD 1:1 가정. 키는 백엔드 `.env`. / ECOS USD/KRW, key in backend `.env`.

> `payroll/` 폴더는 옛 프로토타입 → 사용 안 함. / The `payroll/` directory is a legacy prototype — not used.

---

## 1. 매달 급여 세금 동선 / Monthly payroll-tax routine

본체 작업(스프레드시트)은 그대로 하고, 시스템엔 아래로 등록·계산한다. / Keep doing the spreadsheet work; register/compute in the system as below.

1. **템플릿 다운로드 / Download template** — 급여 관리 화면에서 엑셀 템플릿 받기. 컬럼: 연도·월·이름·USDT·환율·세금(KRW)·**부양가족수**. / columns incl. dependents.
2. **수기 기입 / Fill in** — 스프레드시트 기준으로 각 팀원 행 작성. 부양가족수 꼭 기입(비우면 1로 처리 + 경고). / fill dependents (blank → defaults to 1 with a warning).
3. **업로드 / Upload** — 시스템에 등록. 이름으로 멤버 매칭(안 맞으면 스킵 보고). / matched by name; unmatched rows are reported as skipped.
4. **환율 기준일 입력 → 재계산 / Enter FX date → recalculate** — 지급일(또는 기준일) 날짜를 입력하면 그 날짜 ECOS 종가로 KRW 환산·세액 산출. 주말·공휴일은 직전 영업일. / system pulls that day's ECOS close (prev business day if weekend).
5. **확정·지급 / Confirm & pay** — 검토 후 confirmed → paid. **실제 USDT 송금은 사람이 직접.** 시스템은 status만 변경. / actual transfer is manual; system only flips status.

> [!tip] 세금 수기 우선 / Manual tax override
> 업로드 시 '세금(KRW)' 칸에 값을 넣으면 그 값이 우선(수기). 비우면 시스템이 자동 계산. 히스토리에서 `tax_source`로 구분됨(auto/manual).
> A value in the tax column overrides; blank → auto. Distinguished as `tax_source` in history.

---

## 2. 신규 팀원 추가 시 세금 설정 / Tax setup when adding a member

팀원 추가(팀원 관리) 시 세금 관련으로 확인할 것. / When adding a member, set tax fields.

1. **기본 Service Fee / Base fee** — 인사카드의 월 급여(USDT) 입력. / monthly USDT on the member card.
2. **과세 구분 / Tax treatment** — `tax_treatment` 설정:
   - `kr_resident` — 한국 거주자, 간이세액표 원천징수(기본값). / KR resident, withheld.
   - `non_resident` — 비거주자, **세액 0**(독립계약자 본인 신고). / non-resident, zero withholding.
3. (Drive 폴더명 등 경비용 설정은 경비 매뉴얼 §2 참조.) / expense-side setup: see expense manual §2.

> 계약 형태는 독립계약자. 회사는 **한국 거주자만 원천징수**한다. 비거주자는 각자 신고.
> Contractors are independent; the company withholds only for KR residents.

---

## 3. 세금 처리 규칙 / Tax handling rules

| 상황 / Case | 처리 / Handling |
|---|---|
| 한국 거주자 / KR resident | 지급일 환율로 KRW 환산 → 간이세액표 **100%(보수적)** 원천징수. / simplified table, 100%. |
| 비거주자 / non-resident | 세액 0. 단 히스토리엔 행을 남김(`tax_source=non_resident`). / zero, but recorded. |
| 부양가족 / dependents | 업로드 템플릿의 부양가족수로 계산. 많을수록 세액↓. / from template; more → less tax. |
| 자녀 수 / children | 템플릿에 없으면 0(자녀공제 미적용 = 보수적). / 0 if absent (conservative). |
| 경비 동시 지급 / expense bundled | 총 지급액엔 합산, **세금은 Service Fee만**(경비 비과세). / summed in total, taxed on fee only. |

> [!note] 보수적 과세 / Conservative basis
> 간이세액표 100% 기준으로 다소 높게 원천징수. 3.3%(사업소득) 방식은 회사 방침 변경 시 `tax_treatment`에 `kr_3_3` 추가로 전환 가능(코드 한 곳만 수정).
> Withhold on the higher (100%) basis; switchable to 3.3% later via one code change.

---

## 4. 입력 규칙 / Input rules

- 본체 = 스프레드시트(구글). 시스템은 그 결과를 받아 세금·히스토리만 관리. / spreadsheet is source of truth.
- 기본 급여는 인사카드, 월별 변동분은 엑셀 업로드. / base on card, monthly via upload.
- 환율은 시스템이 ECOS에서 조회(수기 환율 칸을 채우면 그 값 우선). / system pulls FX; manual FX column overrides.

---

## 5. 절대 안전선 / Hard safety lines

1. **자동 지급 없음.** `/pay`는 status만 변경. 실제 USDT 송금은 사람이. / no auto-pay.
2. **데이터·키 repo 커밋 금지** (public repo). DB·ECOS 키는 백엔드 `.env`. / never commit data/keys.
3. **Supabase RLS 기본 거부 유지.** / keep RLS default-deny.
4. **세금 간이세액표 100%(보수적).** 방식 변경은 `_compute_withholding()` 한 곳에서. / conservative; change in one place.

---

## 6. 문제 대응 / Troubleshooting

| 증상 / Symptom | 확인 / Check |
|---|---|
| 세금이 0으로 나옴 / tax is 0 | 멤버 `tax_treatment`가 non_resident인지, 환율 미입력(none)인지. / residency or missing FX. |
| 세금이 이상하게 큼/작음 / odd tax | 부양가족수가 맞는지, 환율 기준일이 맞는지(KRW 과세표준 확인). / dependents & FX date. |
| 업로드 후 일부 누락 / rows skipped | 이름이 hr_members와 일치하는지(스킵 보고 확인). / name match. |
| 부양가족 반영 안 됨 / dependents ignored | 템플릿 7번째 칸 비었는지(누락 경고 확인 → 기본 1 적용됨). / blank dependents column. |
| 환율이 안 불려옴 / FX not fetched | ECOS 키(.env), 기준일 형식(YYYY-MM-DD), 주말 처리. / ECOS key, date format. |
| 히스토리 세액 신뢰도 / trust of a row | `tax_source` 확인 — auto(자동) 신뢰, legacy/none은 검증 필요. / check tax_source. |

---

## 7. 용어 / Glossary

- **Service Fee** — 독립계약자에게 지급하는 월 보수(USDT). / monthly contractor fee in USDT.
- **과세표준 / taxable base** — Service Fee를 지급일 환율로 환산한 KRW. / fee converted to KRW.
- **tax_treatment** — `kr_resident`(원천징수) / `non_resident`(0) / (추후 `kr_3_3`). / withholding mode.
- **tax_source** — 세액 출처: auto(자동계산) / manual(수기) / non_resident(0) / legacy(기존) / none(환율 미입력). / origin of the tax figure.
- **fx_date** — 환율 기준일(ECOS 종가 조회 날짜). / FX reference date.
- **간이세액표 / simplified tax table** — 한국 근로소득 월별 원천징수 세액표(2026). / KR monthly withholding table.
