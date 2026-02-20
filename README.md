# Tokamak HR Automation Process

AI 기반 채용 파이프라인 + 자동 후보자 추천 시스템. 이력서 대신 결과물(Track B)로 평가합니다.

## 철학
- **이력서 무의미** → 지원자가 토카막 생태계에 기여할 수 있는 결과물(코드/프로덕트)을 제출
- **ATI 호환 평가** → 커밋, 코드 품질, 생태계 시너지를 AI가 자동 분석
- **직군 구분 없음** → 내부 팀원과 외부 지원자에게 동일한 기준 적용 (Operation Spear Track B)

---

## 시스템 구성

### 1. Core Pipeline (채용 평가)
후보자의 GitHub 레포를 AI가 자동 분석하여 스코어카드를 생성합니다.

**흐름:**
```
후보자 레포 URL 등록 → 레포 클론 → 코드 분석 → AI 평가 → 5차원 스코어카드 생성
```

**5차원 평가 기준 (각 1~10점):**
| 차원 | 설명 |
|------|------|
| Technical Completeness | 코드 품질, 아키텍처, 테스트 |
| Ecosystem Fit | 토카막 기존 레포와의 시너지 |
| Tokenomics Impact | TON/STON 활용, 프로토콜 수준 기여 가능성 |
| Innovation | 기존에 없는 접근, 차별점 |
| AI Proficiency | AI 도구 활용 흔적 |

**최종 추천:** Strong Hire / Hire / Maybe / Pass

### 2. GitHub Monitor (자동 후보자 추천)
[tokamak-network](https://github.com/tokamak-network) GitHub org의 모든 레포를 스캔하여 외부 활동자를 자동 감지합니다.

**감지 대상:**
- org 레포에 ⭐ Star를 누른 사람
- org 레포를 Fork한 사람
- PR을 제출한 외부 기여자
- Issue를 작성한 외부 사용자

**자동 필터링:** 내부 팀원 16명은 자동 제외됩니다.

감지된 외부 활동자의 GitHub 프로필을 AI가 분석하여 잠재 후보자로 스코어링합니다.

---

## 사용 방법

### 환경 설정

```bash
# 1. .env 파일 생성
cp .env.example backend/.env
```

`.env` 설정:
```
GITHUB_TOKEN=ghp_xxx        # GitHub Personal Access Token (org 레포 읽기 권한 필요)
AI_API_KEY=sk-xxx            # AI API 키 (OpenAI 호환)
AI_API_URL=https://api.openai.com/v1/chat/completions
AI_MODEL=gpt-4o-mini         # 사용할 모델
```

### Backend 실행

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

### Frontend 실행

```bash
cd frontend
npm install
npm run dev -- -p 3002
```

### 접속
- **Dashboard**: http://localhost:3002
- **API**: http://localhost:8001/docs (Swagger UI)

---

## 주요 기능 설명

### Submit Candidate (후보자 등록)
**누가 쓰나?** 내부 관리자 (Jaden, Irene 등)가 사용합니다.
**용도:** 후보자의 레포 URL과 기본 정보를 등록하면, AI가 해당 레포를 분석합니다.

**사용 시나리오:**
1. 외부에서 지원자가 결과물 레포 URL을 전달 (이메일, LinkedIn DM 등)
2. 관리자가 Dashboard → Submit 페이지에서 등록
3. Analyze 버튼 클릭 → AI가 레포를 클론 + 분석 + 스코어카드 생성
4. Candidates 목록에서 점수 확인 및 비교

### Monitor (자동 후보자 감지)
**누가 쓰나?** 시스템이 자동 실행 (또는 관리자가 수동 스캔 트리거).
**용도:** tokamak-network org에 관심을 보이는 외부 개발자를 자동으로 찾아냅니다.

**사용 시나리오:**
1. Dashboard → Monitor 페이지에서 "Scan" 실행
2. org의 모든 레포를 순회하며 외부 활동자 수집
3. 각 활동자의 GitHub 프로필을 AI가 분석
4. 잠재 후보자 리스트가 점수와 함께 표시됨
5. 유망한 사람에게 직접 컨택 가능

---

## API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/candidates/submit` | 후보자 등록 |
| POST | `/api/candidates/{id}/analyze` | AI 분석 실행 |
| GET | `/api/candidates` | 전체 후보자 목록 |
| GET | `/api/candidates/{id}` | 후보자 상세 스코어카드 |
| GET | `/api/candidates/{id}/report` | AI 평가 리포트 |
| POST | `/api/monitor/scan` | GitHub org 스캔 실행 |
| GET | `/api/monitor/candidates` | 자동 감지된 후보자 목록 |
| GET | `/api/monitor/candidates/{username}` | 후보자 상세 프로필 |

---

## 포트 배정
| 서비스 | 포트 | 비고 |
|--------|------|------|
| HR Backend | 8001 | FastAPI + SQLite |
| HR Frontend | 3002 | Next.js + Tailwind |
| Report Generator Backend | 8000 | (별도 프로젝트) |
| Report Generator Frontend | 3001 | (별도 프로젝트) |

---

## 향후 계획 (Phase 2)
- [ ] LinkedIn 자동 서칭 + 아웃리치 메시지 발송
- [ ] 지원자 셀프 서비스 제출 페이지 (외부 공개용)
- [ ] Thanks/피어리뷰 시스템 (소프트 스킬 평가)
- [ ] 자동 정기 스캔 (cron)
- [ ] 평가/온보딩/퇴사 프로세스 통합

---

## Tech Stack
- **Backend**: Python 3.9+, FastAPI, SQLite, PyGithub
- **Frontend**: Next.js 15, React, Tailwind CSS
- **AI**: OpenAI 호환 API (모델 설정 가능)
