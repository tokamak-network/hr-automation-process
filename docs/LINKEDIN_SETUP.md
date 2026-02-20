# 🔗 LinkedIn 연동 사전 준비 가이드

LinkedIn을 통해 후보자를 자동으로 서칭하고 메시지를 보내려면 아래 준비가 필요합니다.

---

## 방법 1: LinkedIn API (공식, 권장)

### 필요한 것
1. **LinkedIn 회사 페이지** — Tokamak Network 공식 페이지가 있어야 함
2. **LinkedIn Developer 앱 생성**
   - https://www.linkedin.com/developers/ 접속
   - "Create app" 클릭
   - 앱 이름: `Tokamak HR Automation` (자유)
   - 회사 페이지 연결: Tokamak Network 페이지 선택
   - 앱 승인 필요 (회사 페이지 관리자 권한)

3. **API 권한 신청**
   - `r_liteprofile` — 프로필 기본 정보 읽기
   - `r_emailaddress` — 이메일 읽기
   - `w_member_social` — 메시지/게시물 발송
   - ⚠️ `rw_ads` + `r_ads_reporting` — 채용 공고 게시용 (LinkedIn Recruiter 라이센스 필요할 수 있음)

4. **OAuth 2.0 토큰 발급**
   - Client ID + Client Secret 확보
   - 인증 플로우 통해 Access Token 발급

### 할 수 있는 것
- ✅ 키워드/스킬 기반 인재 검색
- ✅ 프로필 정보 조회 (이름, 경력, 스킬)
- ✅ 다이렉트 메시지 발송
- ✅ 채용 공고 게시

### 제한 사항
- LinkedIn API는 **승인 절차가 까다로움** (특히 검색 API)
- 대량 검색은 LinkedIn Recruiter 유료 플랜 필요할 수 있음
- Rate limit 있음 (일일 API 호출 수 제한)

---

## 방법 2: 웹 스크레이핑 (비공식, 빠름)

케빈이 미팅에서 언급한 "웹 브라우저를 제어하는 방법"입니다.

### 필요한 것
1. **LinkedIn 개인 계정** (Jaden 또는 별도 계정)
2. **브라우저 자동화 도구** — Playwright 또는 Selenium
3. **LinkedIn 로그인 세션 쿠키**

### 할 수 있는 것
- ✅ LinkedIn 검색 결과 수집 (이름, 직함, 회사, 위치)
- ✅ 프로필 상세 정보 수집
- ✅ 커넥션 요청 + 메시지 발송
- ✅ API 승인 없이 바로 사용 가능

### 주의 사항
- ⚠️ LinkedIn ToS 위반 가능성 (계정 제한/정지 위험)
- ⚠️ 너무 빠르게 요청하면 감지됨 → **5~10초 간격** 권장 (케빈 언급)
- ⚠️ 별도 LinkedIn 계정 사용 권장 (메인 계정 보호)

---

## 방법 3: LinkedIn Recruiter 구독 (유료)

### 비용
- LinkedIn Recruiter Lite: 월 ~$170
- LinkedIn Recruiter Corporate: 연 계약 (회사 규모에 따라)

### 장점
- 고급 검색 필터 (스킬, 경력, 학교, 위치 등)
- InMail 발송 (비연결자에게 메시지 가능)
- ATS 연동 가능

### 단점
- 비용 발생
- 우리 규모에서는 과한 투자일 수 있음

---

## 🎯 추천 순서

| 순서 | 방법 | 이유 |
|------|------|------|
| 1순위 | **방법 2 (웹 스크레이핑)** | 비용 0, 바로 시작 가능, 케빈도 이 방법 권장 |
| 2순위 | **방법 1 (공식 API)** | 안정적, 장기적으로 전환 권장 |
| 3순위 | **방법 3 (Recruiter 구독)** | 대규모 채용 시에만 |

---

## ✅ Jaden이 지금 해야 할 것

### 방법 2 (웹 스크레이핑) 기준:
1. **LinkedIn 계정 준비** — 기존 계정 또는 HR용 별도 계정
2. **검색 키워드 정리** — 어떤 사람을 찾을지 기준 목록 작성
   - 예: "ethereum developer", "layer2 engineer", "smart contract auditor"
   - 위치: 한국, 동남아, 유럽 등 선호 지역
   - 스킬: Solidity, Rust, ZK, TypeScript 등
3. **아웃리치 메시지 템플릿 작성** — 후보자에게 보낼 메시지 초안
4. **나에게 알려주면** → 자동화 스크립트 구현 시작

### 방법 1 (공식 API) 기준:
1. https://www.linkedin.com/developers/ 에서 앱 생성
2. Tokamak Network LinkedIn 페이지 관리자 권한 확인
3. Client ID + Client Secret 확보 후 나에게 공유
