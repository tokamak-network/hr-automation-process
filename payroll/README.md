# Tokamak HR Solution — Prototype

급여/세금 관리 MVP 프로토타입 (Next.js + FastAPI + SQLite)

## 실행 방법

### Backend
```bash
cd prototype/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd prototype/frontend
npm install
npm run dev
```

Frontend: http://localhost:3000  
Backend API: http://localhost:8000/docs

## 주요 화면
- **대시보드**: 이번 달 급여 요약, Jaden 잔고, D-day, 적립금
- **팀원 관리**: 10명 샘플 팀원 카드 + 상세 (계약/급여이력/인센티브)
- **급여 관리**: 월별 급여 테이블, 분기 인센티브, 트랜잭션 히스토리
- **세금 시뮬레이션**: 팀원별 근로소득세 계산 (실제 한국 세율표 기반) + 월별 차트
- **설정**: 시스템 환경 설정

## 기술 스택
- Frontend: Next.js 15 + Tailwind CSS 4 (Dark Theme)
- Backend: FastAPI + SQLite
- 소득세 계산: 2024 한국 근로소득세율표 기반
