# Tokamak Hiring System

[![Python](https://img.shields.io/badge/Python-3.9+-blue?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green?logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tokamak Network](https://img.shields.io/badge/Tokamak-Network-blue?logo=ethereum)](https://tokamak.network)

**AI-powered recruitment automation for Ethereum L2 teams. No resumes — evaluate candidates by real deliverables (Track B).**

AI 기반 채용 자동화 시스템. 이력서 대신 결과물(Track B)로 평가하고, 후보자를 자동으로 발굴합니다.

## 🎯 핵심 철학
- **이력서 무의미** → 지원자가 토카막 생태계에 기여할 수 있는 결과물(코드/프로덕트)을 제출
- **Track B 기반 평가** → Problem Definition → Implementation → Deliverable (OS와 동일 기준)
- **직군 구분 없음** → 내부 팀원과 외부 지원자에게 동일한 기준 적용
- **아웃바운드 소싱 중심** → 우리가 먼저 후보자를 찾아서 제안하는 프로세스

---

## 📋 주요 기능

### 1. 후보자 평가 파이프라인 (Core Pipeline)
후보자의 GitHub 레포를 AI가 자동 분석하여 스코어카드를 생성합니다.

```
후보자 레포 URL 등록 → 레포 클론 → 코드 분석 → AI 평가 → Track B 스코어카드 생성 → 리뷰어 자동 매칭
```

**5차원 평가 기준 (가중치 적용):**
| 차원 | 가중치 | 설명 |
|------|--------|------|
| Technical Completeness | 1.0x | 코드 품질, 아키텍처, 테스트 |
| Ecosystem Fit | **2.0x** | 토카막 기존 레포와의 시너지 |
| Tokenomics Impact | 1.5x | TON/STON 활용, 프로토콜 수준 기여 가능성 |
| Innovation | 1.0x | 기존에 없는 접근, 차별점 |
| AI Proficiency | 0.5x | AI 도구 활용 흔적 |

**Track B 3단계 평가:**
| 단계 | 기준 |
|------|------|
| Problem Definition | 문제를 명확하게 정의했는가? |
| Implementation | 작동하는 코드/프로덕트가 있는가? |
| Deliverable | 데모/문서/배포된 결과물이 있는가? |

**최종 추천:** Strong Hire / Hire / Maybe / Pass (가중 점수 기반)

### 2. GitHub Monitor (자동 후보자 감지)
[tokamak-network](https://github.com/tokamak-network) GitHub org의 레포를 스캔하여 외부 활동자를 자동 감지합니다.

- ⭐ Star, Fork, PR 제출, Issue 작성 등 모든 외부 활동 추적
- 내부 팀원 16명 자동 제외
- GitHub 프로필 기반 잠재력 스코어링

### 3. LinkedIn 소싱 (아웃바운드)
웹 검색 기반으로 블록체인 개발자 LinkedIn 프로필을 자동 발굴합니다.

- **18개 검색 쿼리**: Solidity, ZK, Rollup, DeFi, Rust 등 다양한 키워드
- **Brave Search API** 또는 DuckDuckGo 폴백 (API 키 없이도 동작)
- **Open To Work 감지**: 구직 중인 후보자 우선 표시
- **GitHub↔LinkedIn 브릿지**: GitHub Monitor 후보자의 LinkedIn 프로필 자동 매칭
- **아웃리치 워크플로우**: discovered → 연락 대상 → 연락 완료 → 응답/거절

### 4. 팀원 자동 추천 (Reviewer Matching)
후보자의 기술 스택을 분석하여 최적의 내부 리뷰어를 자동 추천합니다.

| 팀원 | 전문 분야 |
|------|-----------|
| Kevin (ggs134) | Protocol, Tokenomics, Architecture |
| Jaden (Jaden-Kong) | Full-stack, Ops, Blockchain |
| Mehdi (Mehd1b) | Frontend, UI/UX |
| Jason (SonYoungsung) | L2, Bridge, Core Protocol |

### 5. 다중 사용자 지원
- 관리자/리뷰어/뷰어 역할 분리
- 누가 어떤 후보자를 분석/리뷰했는지 추적
- 상단 네비게이션에서 사용자 전환

---

## 🚀 시작하기

### 환경 설정

```bash
# .env 파일 생성
cp .env.example backend/.env
```

`.env` 설정:
```
GITHUB_TOKEN=ghp_xxx        # GitHub Personal Access Token
AI_API_KEY=sk-xxx            # AI API 키 (OpenAI 호환)
AI_API_URL=https://api.openai.com/v1/chat/completions
AI_MODEL=gpt-4o-mini
BRAVE_API_KEY=xxx            # (선택) Brave Search API 키
```

### 실행

```bash
# Backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001

# Frontend
cd frontend
npm install
npm run dev -- -p 3002
```

### 접속
- **Dashboard**: http://localhost:3002
- **API Docs**: http://localhost:8001/docs

---

## 📡 API 엔드포인트

### 후보자 관리
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/candidates/submit` | 후보자 등록 |
| POST | `/api/candidates/{id}/analyze` | AI 분석 실행 |
| GET | `/api/candidates` | 전체 후보자 목록 |
| GET | `/api/candidates/{id}` | 후보자 상세 (스코어카드 + Track B) |
| GET | `/api/candidates/{id}/report` | AI 평가 리포트 |
| GET | `/api/candidates/{id}/recommended-reviewers` | 추천 리뷰어 |
| POST | `/api/candidates/{id}/review` | 리뷰 제출 |

### GitHub Monitor
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/monitor/scan` | GitHub org 스캔 |
| GET | `/api/monitor/candidates` | 감지된 후보자 목록 |

### LinkedIn 소싱
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/linkedin/search` | LinkedIn 후보자 검색 |
| GET | `/api/linkedin/candidates` | LinkedIn 후보자 목록 |
| POST | `/api/linkedin/candidates/{id}/outreach` | 상태 변경 |
| POST | `/api/linkedin/bridge` | GitHub↔LinkedIn 매칭 |

### 사용자
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/users` | 사용자 목록 |
| GET | `/api/users/me` | 현재 사용자 (X-User-Email 헤더) |

---

## 🏗️ 시스템 구조

```
tokamak-hiring/
├── backend/
│   ├── main.py              # FastAPI 서버 + API 라우트
│   ├── database.py          # SQLite 스키마 + 연결
│   ├── analyzer.py          # 레포 분석 + AI 평가 + Track B + 리뷰어 추천
│   ├── linkedin_google.py   # 웹 검색 기반 LinkedIn 소싱
│   ├── github_linkedin.py   # GitHub↔LinkedIn 브릿지
│   ├── linkedin_scraper.py  # LinkedIn Voyager API (레거시, 폴백)
│   └── hiring.db            # SQLite 데이터베이스
├── frontend/
│   ├── app/
│   │   ├── page.tsx         # 후보자 목록 (대시보드)
│   │   ├── submit/page.tsx  # 후보자 등록
│   │   ├── candidates/[id]/ # 후보자 상세 (스코어카드 + Track B + 리뷰어)
│   │   ├── monitor/page.tsx # GitHub Monitor
│   │   ├── linkedin/page.tsx# LinkedIn 소싱
│   │   ├── layout.tsx       # 네비게이션 + 사용자 선택
│   │   └── UserContext.tsx   # 사용자 상태 관리
│   └── ...
└── docs/
    └── LINKEDIN_SETUP.md    # LinkedIn 설정 가이드
```

## 포트 배정
| 서비스 | 포트 |
|--------|------|
| Hiring Backend | 8001 |
| Hiring Frontend | 3002 |
| Report Generator Backend | 8000 |
| Report Generator Frontend | 3001 |

---

## 🗺️ 로드맵

- [x] Core Pipeline (후보자 등록 → AI 분석 → 스코어카드)
- [x] Track B 평가 체계 (가중치 + 3단계)
- [x] 다중 사용자 지원 (역할 기반)
- [x] GitHub Monitor (자동 후보자 감지)
- [x] LinkedIn 소싱 (웹 검색 기반)
- [x] GitHub↔LinkedIn 브릿지
- [x] 팀원 자동 추천
- [ ] LinkedIn DM 자동 아웃리치
- [ ] 지원자 셀프 서비스 제출 페이지 (외부 공개용)
- [ ] Thanks/피어리뷰 시스템 (소프트 스킬 평가)
- [ ] 자동 정기 스캔 (cron)
- [ ] 인터뷰 스케줄링 자동화
- [ ] tokamak.network 연동 (라이브 대시보드)

---

## Tech Stack
- **Backend**: Python 3.9+, FastAPI, SQLite, PyGithub, httpx
- **Frontend**: Next.js 16, React, Tailwind CSS
- **AI**: OpenAI 호환 API (모델 설정 가능)
- **Search**: Brave Search API / DuckDuckGo (폴백)
