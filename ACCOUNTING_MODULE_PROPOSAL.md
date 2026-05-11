# 회계 자동화 모듈 제안서

> **Tokamak Network HR Solution에 회계 자동화 모듈을 추가하자는 제안**
>
> 2026년 5월, 싱가포르 법인 (Tokamak Network Pte. Ltd.) 의 FY2025 (YA2026) / FY2026 (YA2027) 가결산을 직접 진행하며 겪은 경험을 바탕으로 작성됨.

---

## 작성 배경

이번에 Tokamak Network Pte. Ltd. 의 2년치 가결산 (YA2026 + YA2027) 을 처음부터 끝까지 직접 작업했다. 회계연도 1년치를 정리하는 데 **분개 작성 + BS/PL 만드는 데만 약 4시간**이 걸렸고, 그 전에 자료를 모으는 데 **추가로 며칠**이 필요했다.

이 시간을 회사가 매년 반복해서 쓸 이유가 없다. 더 큰 문제는 **자료가 매년 사후적으로 재구성된다**는 점이다 — 1년이 지나면 어떤 거래가 무엇이었는지 기억이 흐려지고, 인보이스/계약서/영수증이 흩어져 있어서 audit 시 재추적이 어렵다.

이 문서는 **HR Solution 안에 회계 자동화 모듈을 추가하면 매년 1주일을 1시간으로 줄일 수 있다**는 제안이다. 기존 채용/급여 모듈과 자연스럽게 연결된다.

---

## 1. 이번 가결산에서 가장 시간을 많이 쓴 작업들

### 1.1 거래 분류 (Transaction Classification) — 가장 큰 시간 소모

총 **294건 거래** (FY26 기준) 를 회계 계정 (Sales, Salary, Subscription fee, Office rental 등) 으로 분류했다. 거래의 92% 는 "거래상대 이름" 으로 분류가 가능했다:

- "BIT CONSULTANCY FZCO" → Sales
- "Onther INC." → Consulting fee (COGS)
- "Anthropic", "OpenAI", "GitHub" → Subscription fee
- "Lee and Ko" → Professional fee
- "International Workplace Group" → Office rental
- "Junwoong Kong", "Jehyuk Jang" → Salary
- "SoonHyeong Jeong" → Director remuneration (또는 Amount due to director repayment)

**문제점:**
- 분류 룰이 메모리에만 존재. 다음 해에 다시 똑같은 작업 반복.
- 새로운 거래상대 (FY26 신규 14개: Anthropic, OpenAI, xAI, Perplexity, GitHub, Consensys, Lee and Ko 등) 가 나오면 매번 사람이 결정.
- Aspire SGD, Aspire USD, Aspire GBP, Wise (USD/SGD/GBP) — **6개 통화/계좌** 의 거래내역을 각각 다운로드 → 통합.

**필요한 기능:**
- 거래상대별 회계 계정 매핑 테이블 (학습형)
- 신규 거래상대가 나오면 "이건 무엇으로 분류할까요?" 자동 질문 → 한 번 답하면 다음부터 자동
- 매월 자동 분류 → 마감 때 검토만

### 1.2 환율 수집 — 가장 단조로운 작업

USD/SGD daily mid rate 를 **2년치 (약 520일)** 수동으로 수집했다. 출처는 poundsterlinglive.com.

**문제점:**
- 매번 외부 사이트에서 스크래핑.
- 회계연도 마감일 (예: 2026-02-28) 이 토요일이면 직전 영업일 (2026-02-27) 환율로 보정해야 함 — 룰 매번 적용.
- BIT 매출 인식 시 거래일 환율 적용, FY26 마감 시 외화 잔액 평가 환율 적용 — 두 가지 시점이 모두 필요.

**필요한 기능:**
- 일별 환율 자동 수집 (무료 API: Frankfurter, ExchangeRate-API, ECB 등)
- 한국 거주자 송금 대비 KRW 환율도 함께 수집 (USDT/KRW, USD/KRW, SGD/KRW)
- 토/일/공휴일 보정 룰 자동 적용

### 1.3 인보이스/외주 송금 추적 — 흩어진 정보 재조립

**BIT CONSULTANCY 인보이스 (Sales):**
- FY26 12건 발행, USD 362,000
- 그 중 1건 (USD 40K, 2026-02 발행) 은 2026-03-04 입금 → **AR (수취채권)** 로 인식해야 했지만 **인보이스 발행 명세가 따로 없어서 사용자에게 물어보고 알게 됨**.

**Onther 외주 (COGS):**
- FY25 16건 송금, USD 585,800
- 거래내역에서 역추적해야 함. 송장이나 PO 없음.

**Kevin Director Loan (Money Borrowing Agreement):**
- SGD 80,000 차입 (2025-09-15)
- 용도: 팀 워크샵 호텔비 대납 — DocuSign 서명 계약서 PDF 가 있어서 정확히 회계 처리할 수 있었음.

**문제점:**
- 인보이스 발행 기록이 없어서 입금만 보고 매출 인식하다 보니 AR 누락.
- 외주 송금은 거래내역만 보고 추적해야 함 — 어떤 프로젝트, 어떤 PO 인지 모름.
- 차입/대여 계약서가 있을 때와 없을 때 정확도가 천차만별.

**필요한 기능:**
- **인보이스 모듈**: 발행일, 거래상대, 금액, 통화, 입금예정일, 실제 입금일 추적
- **벤더/외주 모듈**: 거래상대 마스터, 송금 이력, 인보이스/PO 첨부
- **계약서 저장소**: 임금/이사보수/외주/임대차/차입/대여 모든 계약 한 곳에
- 위 세 가지를 묶어서 "이 송금이 이 계약서/PO 에 매핑된다" 를 알 수 있게

### 1.4 직원 보상 (Salary, Director Remuneration) — 회계 누적 기록 부재

급여 자체는 일정하지만 (월 SGD 19K), 회계연도별 합계가 따로 기록되어 있지 않아서 **거래내역에서 합산해야** 했다.

**현재 솔루션의 Payroll 모듈은 이미 USDT/TOKAMAK 지급을 추적하지만, 회계 관점의 누적 데이터는 별도**.

**필요한 기능:**
- 월별 급여 → 회계연도별 자동 집계
- 분기 인센티브 (TOKAMAK 토큰) → KRW 환산 시점의 환율 기록 보존
- Director Remuneration 별도 트래킹
- 퇴직금 적립 (해당 시) 자동 계산

### 1.5 자산 관리 (Fixed Asset) — 일괄 처리

Office equipment Cost SGD 9,176 / Acc.Dep -6,117 / NBV 3,059 — 이게 무슨 자산인지 상세 내역이 없어서 일괄로 처리.

**필요한 기능:**
- 자산 등록부 (구입일, 자산명, 단가, 내용연수, 감가상각 방식)
- 자산별 NBV 자동 계산
- 폐기/매각 이력
- 연 1회 자동 감가상각 분개 생성

### 1.6 BS 균형 디버깅 — 가장 답답한 작업

FY26 가결산 도중 BS 가 정확히 SGD 100 안 맞는 문제를 디버깅했다. 원인은 **FY25 마감 BS 의 Wise SGD 잔액이 -2 가 아니라 +98** 이었다는 것 — FY25 plug 분개의 효과가 거기 들어가 있었는데, FY26 opening balance 에 반영을 안 한 것.

**문제점:**
- 분개를 한 번 잘못 만들면 BS 100 차이 같은 문제가 며칠 갈 수 있음.
- Plug 분개 (자금이체 fee 누락분 등) 가 매년 발생하지만 추적 어려움.

**필요한 기능:**
- 분개 입력 시 Dr = Cr 자동 검증
- 회계연도 closing 시 BS 균형 자동 확인
- Plug 분개 별도 추적
- 다음 해 opening balance 자동 이월

### 1.7 한국 원천세 검토 — 누락 위험 1순위

- Lee and Ko (한국 법무법인): USD 14K (FY26)
- Lee Jin Ho (한국 세무사): USD 9K (FY25/FY26)
- Onther INC.: USD 695K + 586K (FY24/FY25)

**모두 한국 거주자에게 USD 송금**. 싱가포르 법인이 한국 거주자에게 컨설팅비/외주비 지급 시 원천징수 의무가 있을 수 있음 (한-싱 조세조약 적용).

**현재 상태**: 검토 안 됨. Audit 시 큰 리스크.

**필요한 기능:**
- 거래상대 마스터에 "세금 거주지" 필드
- 한국 거주자 송금 시 자동 플래그
- 원천세 계산 보조 (한-싱 조세조약 적용)
- 거주증명서 (Certificate of Residence) 보관

### 1.8 보고서 출력 — 마지막 단계 자동화 가능

이번에 만든 자료들:
- BS PDF (YA2026, YA2027)
- PL PDF (YA2026, YA2027)
- 한국어 가결산 보고서 PDF (Kevin 보고용)
- 종합 워크북 xlsx (GL/PL/BS 통합)

모두 **버튼 한 번에 자동 생성** 가능한 영역.

---

## 2. 모듈별 제안

### Module 1: Bank Transaction Sync (은행 거래 자동 동기화)

**목적**: Aspire, Wise 등 거래내역을 자동으로 수집해서 솔루션 DB 에 저장.

**핵심 요구사항:**
- Wise: Public API 존재 (https://api.wise.com). 사용자 토큰 등록 → 매일 자동 동기화.
- Aspire: Public API 미확인. CSV 다운로드 자동화 (Playwright) 또는 수동 업로드 폴백.
- 다통화 지원: SGD, USD, GBP, KRW 등.
- 중복 제거: 같은 거래가 양쪽에 잡히지 않게 (Aspire → Wise 자금이체 등).

**연결되는 모듈**: Transaction Classifier (Module 2), Invoice (Module 3).

### Module 2: Transaction Classifier (거래 자동 분류기)

**목적**: 거래상대 → 회계 계정 매핑을 학습/저장.

**핵심 요구사항:**
- 거래상대 마스터 테이블 (Counterparty + 기본 회계 계정).
- 신규 거래상대가 나오면 사용자에게 분류 요청. 답을 학습해서 다음부터 자동 분류.
- Counterparty 이름 매칭 룰 (정규식/유사도). 예: "BIT CONSULTANCY FZCO" 와 "BIT Consultancy F.Z.CO" 가 같은 곳임을 인식.
- 분류 룰 변경 이력 (audit trail).

**계정 체계**: Tokamak FY24 final 의 chart of accounts 따라가면 됨 — 이번 가결산 작업에 그대로 사용한 것.

**Bonus 기능**: AI 가 거래내역의 ref/memo 까지 보고 분류 후보를 제안 (Anthropic API 호출 등).

### Module 3: Invoice & Vendor (인보이스 + 벤더 관리)

**목적**: 매출 인보이스 발행 / 외주 벤더 관리.

**핵심 요구사항:**

**매출 측:**
- 인보이스 발행일, 거래상대, 금액, 통화, due date, 실제 입금일.
- 발행 → 입금 자동 매칭 (Wise/Aspire 입금 거래와 매칭).
- 미수금 (AR) 자동 계산 — 회계연도 마감일에 미입금 인보이스는 AR 로 잡힘.

**외주/매입 측:**
- 벤더 마스터 (이름, 거주지, 기본 회계 계정, 계약서 첨부).
- 송금 이력 + PO/Invoice 첨부.
- 매월 정기 송금 (직원 급여, 임대료, 구독료) 자동 인식.

**예시 (이번 가결산 데이터로):**
- BIT CONSULTANCY FZCO: FY26 12건 발행 USD 362K. 1건 (USD 40K) 은 AR.
- Onther INC.: FY25 16건 송금 USD 586K (FY26 0건).
- Lee and Ko: FY26 4건 송금 USD 14K (한국 거주자).

### Module 4: Contract & Document Repository (계약서/문서 저장소)

**목적**: 회계 audit 에 필요한 모든 서류를 한 곳에.

**핵심 요구사항:**

| 카테고리 | 보관 대상 |
|---|---|
| 근로계약서 | 직원별 (Junwoong, Jehyuk, Praveen) |
| 이사보수계약서 | Kevin Director Remuneration |
| 외주계약서 | Onther, Lee and Ko, Lee Jin Ho |
| 차입/대여계약서 | Money Borrowing Agreement (Kevin SGD 80K) ⭐ |
| 임대차계약서 | IWG/Regus |
| 인보이스 | BIT 발행분, 외주 청구서 |
| 영수증 | 워크샵 호텔비, 출장비 등 |
| 자본금 서류 | Share capital 증자 기록 (FY24 +500K) |
| 거주증명서 | 거래상대별 (한-싱 조세조약 적용 시) |
| 보증금 영수증 | 사무실 deposit (FY25 REGUS 환급 추적용) |

**핵심 가치**: Audit 때 "이 SGD 80K 송금이 뭐냐" 라는 질문에 30초 안에 계약서 PDF 제시 가능.

### Module 5: FX Rate Service (환율 자동 수집)

**목적**: 일별 환율을 자동 수집해서 거래 → SGD/KRW 환산.

**핵심 요구사항:**
- 일별 mid rate API (Frankfurter API 추천 — ECB 공식 데이터, 무료, 인증 불필요).
- 통화 페어: USD/SGD, GBP/SGD, KRW/USD, KRW/SGD, USDT (= USD), TOKAMAK (Upbit API).
- 회계연도 마감일 토/일 보정 룰 자동 적용.
- 거래 분개 시 자동으로 거래일 환율 적용.

### Module 6: Compliance Calendar (세무/회계 일정 알림)

**목적**: 매년 반복되는 신고/마감 일정을 놓치지 않도록 자동 알림.

**핵심 요구사항:**

| 일정 | 마감 | 알림 |
|---|---|---|
| ECI 신고 (싱가포르) | 회계연도 마감 후 3개월 | D-30, D-7 |
| Corporate Tax (Form C/C-S) | YA 11월 30일 | D-60, D-30, D-7 |
| GST 신고 (등록 시) | 분기별 | D-7 |
| ACRA Annual Return | 회계연도 마감 후 7개월 | D-30 |
| 직원 4대보험 (해당 시) | 매월 | D-3 |
| 한국 원천세 신고 (해당 시) | 익월 10일 | D-3 |
| Director Loan 만기 | 계약별 (예: 2026-07-31) | D-30, D-7 |
| BS/PL 마감 (가결산) | 회계연도 마감 후 1개월 | D-30 |

**연결**: 텔레그램/이메일/Slack 알림 (HR Solution 이미 텔레그램 알림 구조 보유).

### Module 7: Korean WHT (한국 원천세) Helper

**목적**: 한국 거주자에게 송금 시 원천징수 의무 검토 자동화.

**핵심 요구사항:**
- 거래상대 마스터의 "거주지" 필드 (Korea / Singapore / Others).
- 한국 거주자 송금 발생 시 자동 플래그.
- 원천세 계산 가이드 (한-싱 조세조약 article 적용).
- 거주증명서 (Certificate of Residence) 보관 + 만료 알림.
- 원천세 신고 이력.

**리스크 우선순위 (이번 가결산에서 발견):**
1. Onther INC. (한국 법인): FY24 USD 695K + FY25 USD 586K 송금 → 검토 필요.
2. Lee and Ko (한국 법무법인): FY26 USD 14K.
3. Lee Jin Ho (한국 세무사): FY25/FY26 USD 17K.

### Module 8: Fixed Asset Register (고정자산 관리)

**목적**: 자산별 등록 + 자동 감가상각.

**핵심 요구사항:**
- 자산 등록 (자산명, 카테고리, 구입일, 단가, 통화, 내용연수, 감가상각 방식).
- 정액법/정률법 자동 계산.
- NBV (Net Book Value) 추적.
- 폐기/매각 이력.
- 매년 마감 시 감가상각 분개 자동 생성.

**현재 자산**: Office equipment SGD 9,176 (3년 정액법, FY24 부터 감가상각 시작, FY26 마감 시 완전 감가상각).

### Module 9: Financial Statements Generator (재무제표 자동 생성)

**목적**: 가결산 → BS/PL PDF 한 번에 출력.

**핵심 요구사항:**
- 거래 + 분개 → GL → PL/BS 자동 빌드.
- 영문 BS/PL (싱가포르 ACRA 양식, 이번에 만든 4개 PDF 와 동일 포맷).
- 한국어 가결산 보고서 (Kevin 보고용, 이번에 만든 한국어 PDF 포맷).
- 3년 추세 비교 자동 포함.
- 종합 워크북 xlsx 출력 (GL/PL/BS).

**연결**: weasyprint 또는 reportlab. 이번에 만든 코드 (`/home/claude/fy26/build_korean_report.py`, `/home/claude/build_ya_pdfs.py`) 를 참고용 자산으로 활용 가능.

### Module 10: Audit Trail (감사 추적)

**목적**: 모든 회계 변동 이력을 audit 가능하게.

**핵심 요구사항:**
- 분개 입력/수정/삭제 이력.
- 거래 분류 룰 변경 이력.
- 자산 폐기/매각 승인 흐름.
- BS 균형 자동 검증 (Dr = Cr).
- 회계연도 closing 후 잠금 (이전 연도 분개 수정 불가, audit 시 unlock 가능).

---

## 3. 기존 모듈과의 연결

이미 만들어진 채용/급여 모듈과 어떻게 연결되는지:

### Payroll 모듈 (이미 있음)
- 월 USDT 급여, 분기 TOKAMAK 인센티브, 소득세 적립 → **Salary 회계 분개로 자동 흘러감**.
- 메타마스크 송금 트랜잭션 → **자동 거래 등록**.
- 소득세 시뮬레이션 → **세금 적립금 = Tax Accrual 부채로 BS 에 자동 반영**.

### Hiring 모듈 (이미 있음)
- 채용 → 입사 → Salary 마스터 자동 생성.
- LinkedIn/GitHub 후보자 정보 → Vendor 마스터 후보 (외주 계약 시).

### Director / 직원 정보
- 기존 사용자 (관리자/리뷰어/뷰어) 역할 → **회계 권한 매핑** (관리자만 회계연도 closing 가능 등).

---

## 4. 우선순위 제안

### Phase 1 — Quick Win (1-2개월)
**가장 빨리 시간을 절약하는 모듈들.**

1. **Module 2 (Transaction Classifier)** — 학습형 거래 분류
2. **Module 3 (Invoice & Vendor)** — 인보이스/외주 추적
3. **Module 4 (Contract Repository)** — 계약서 저장소

→ 이 셋만 있어도 **매년 가결산 시간을 50% 이상** 줄일 수 있다.

### Phase 2 — Mid-term (3-6개월)
**자동화 + 정확도 향상.**

4. **Module 1 (Bank Sync)** — Wise/Aspire 자동 동기화
5. **Module 5 (FX Rate Service)** — 환율 자동 수집
6. **Module 6 (Compliance Calendar)** — 일정 알림
7. **Module 7 (Korean WHT Helper)** — 한국 원천세 검토

### Phase 3 — Long-term (6-12개월)
**가결산 완전 자동화.**

8. **Module 8 (Fixed Asset Register)** — 자산 관리
9. **Module 9 (Financial Statements Generator)** — BS/PL 자동 출력
10. **Module 10 (Audit Trail)** — 감사 추적

---

## 5. 단 한 가지를 꼽으면

**Module 2 (Transaction Classifier)** 가 가장 큰 효과를 낸다.

이번 가결산 작업의 70% 가 "이 거래는 어떤 회계 계정인가?" 를 결정하는 시간이었다. 그 결정은 거의 100% 거래상대 이름으로 가능하다. 한 번 학습시키면 다음 해부터 자동.

**예상 효과:**
- FY26 가결산: 294건 분류 → 약 3시간
- FY27 가결산: 신규 거래상대만 분류 → 약 20분
- FY28 가결산: 거의 모두 자동 → 5분

---

## 6. 부록: 이번 가결산 데이터 (참고용)

회계 모듈 구조 설계 시 실제 데이터로 검증할 수 있는 케이스들.

### 6.1 거래상대 마스터 (Counterparty)

이번에 등장한 거래상대 약 60개. 회계 계정 매핑 예시:

| Counterparty | 회계 계정 | 거주지 | 비고 |
|---|---|---|---|
| BIT CONSULTANCY FZCO | Sales | UAE | 단일 매출처 |
| Onther INC. | Consulting fee (COGS) | Korea | ⚠️ WHT 검토 필요 |
| Lee and Ko | Professional fee | Korea | ⚠️ WHT 검토 필요 (FY26 신규) |
| Lee Jin Ho Tax | Professional fee | Korea | ⚠️ WHT 검토 필요 |
| Lee Kim Alliance | Secretary fee | Singapore | 법인 secretary |
| Lee Kim Service | Professional fee | Singapore | 회계법인 |
| International Workplace Group | Office rental | Singapore | IWG |
| REGUS Management Singapore | Office rental / Deposit | Singapore | 보증금 환급 발생 |
| Junwoong Kong | Salary | - | 본인 (MD) |
| Jehyuk Jang | Salary | - | FY25 신규 채용 |
| Praveen Surendran | Salary | - | FY24 까지 근무 |
| SoonHyeong Jeong (Kevin) | Director remuneration / Amount due to director | - | 이사 + 차입자 |
| Anthropic | Subscription fee | US | AI |
| OpenAI | Subscription fee | US | AI |
| GitHub | Subscription fee | US | 개발 |
| Consensys | Subscription fee | US | 블록체인 |
| (외 약 40개) | ... | ... | ... |

### 6.2 거래 패턴

**정기 (매월 발생):**
- Salary (Junwoong, Jehyuk) — SGD 19K
- Director remuneration (Kevin) — SGD 10K
- Subscription (Google, Atlassian, Anthropic 등) — 다수
- Office rental (IWG, FY25만) — SGD 2.6K
- Lee Jin Ho 세무 자문 — USD 750/월

**비정기 (이벤트성):**
- BIT 인보이스 매출 — 월 1-2회 USD 22-40K
- Onther 외주 송금 — FY24/FY25 다수, FY26 0건
- Director loan (Kevin) — 차입 + 분할 상환
- REGUS 보증금 환급 — 1회
- 워크샵 (Kevin 대납) — 1회 SGD 80K
- Lee and Ko 자문료 — 분기별

### 6.3 회계연도 마감 시 체크리스트

이번 가결산에서 작성한 체크리스트 (Module 9 에 내장 가능):

1. ✅ 6개 통화/계좌 거래내역 다운로드 완료
2. ✅ 전체 거래 분류 완료 (Unclassified 0건)
3. ✅ SGD 환산 완료 (변환 실패 0건)
4. ✅ 인보이스 발행 vs 입금 매칭 (AR 인식)
5. ✅ 외주 송금 → 계약서/PO 매칭
6. ✅ 분개 Dr = Cr 검증
7. ✅ 외화 잔액 마감 환율 평가
8. ✅ Plug 분개 (Bank charges 등)
9. ✅ BS 균형 검증 (TA = L + E)
10. ✅ 직전 연도 vs 당기 비교
11. ✅ 한국 거주자 송금 WHT 검토 플래그
12. ✅ 차입/대여 만기 추적
13. ✅ BS/PL PDF 출력
14. ✅ 한국어 가결산 보고서 생성

---

## 7. 마치며

이번 가결산은 사람이 직접 해야 가능한 작업이었지만, **이걸 매년 사람이 반복할 이유는 없다**. 솔루션이 99% 를 처리하고 사람은 "이 새로운 거래는 무엇으로 분류할까?" 같은 의사결정만 하는 게 정상이다.

HR Solution 의 기존 채용/급여 모듈이 이미 잘 만들어져 있어서, 회계 모듈을 추가하는 것이 자연스럽다 — 같은 사용자 (Kevin, Jaden, 팀원) 가, 같은 거래 (USDT 급여, 외주 송금, 매출 입금) 를 다른 관점 (회계) 에서 보는 것뿐이다.

작업 시 이번 가결산 결과물 (FY24/FY25/FY26 BS/PL, GL, 분개 코드) 을 참고 자료로 활용 가능. 필요하면 데이터 제공 가능.

---

**작성**: Jaden (Managing Director, Tokamak Network Pte. Ltd.)
**작성일**: 2026년 5월 11일
**대상**: Tokamak HR Solution Claude Code
