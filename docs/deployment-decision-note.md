---
title: 배포 결정 노트 / Deployment Decision Note
status: decision record (living)
updated: 2026-06-23
owner: Member 2
note: 이 문서에는 키·URL·시크릿을 넣지 않는다. 판단 기록만. / No secrets/URLs — decision record only.
related: docs/(경비정산 운영 매뉴얼)expense-operations-manual.md
---

# 배포 결정 노트 / Deployment Decision Note

## 결정 / Decision
**당분간 배포하지 않고 "로컬 전용"으로 운영한다.** (혼자 HR 업무에 사용)
For now, **keep it local-only** (single operator). No public deployment.

- 결정일 / decided: 2026-06-23
- 재검토 트리거: 아래 "배포를 고려할 조건" 중 하나라도 발생 시. / Revisit when any trigger below occurs.

---

## 왜 로컬 전용인가 / Why local-only

1. **배포의 본질적 이유가 아직 없다.** 배포 = "여러 사람 / 어디서나 / 브라우저 접근". 혼자, 한 대의 PC에서 쓰면 그 필요가 없다.
   Deployment exists for multi-user / anywhere / browser access. None applies to a single operator on one machine.
2. **가장 큰 리스크가 로컬에선 발생하지 않는다.** 현재 백엔드는 무인증 + CORS `*`인데, 이는 **인터넷에 공개됐을 때만** 위험하다. localhost 바인딩이면 외부 접근이 원천 차단된다.
   The main risk (unauthenticated backend + `CORS *`) only matters once public; bound to localhost, it cannot be reached externally.
3. **데이터는 안전하다.** 실데이터는 Supabase에 있고 RLS 기본 거부로 보호된다. PC가 죽어도 데이터는 클라우드에 남는다.
   Real data lives in Supabase with RLS default-deny; safe even if the PC dies.

> 즉 **혼자 로컬 사용 = 가장 안전·저비용** 구성이며, 배포는 편의를 얻는 대신 보안 작업을 떠안는 선택이다.
> Local single-user is the safest, lowest-cost setup; deploying trades convenience for required security work.

---

## 감수하는 것 / Trade-offs accepted
- 그 한 대의 PC에서 터미널로 켜야 사용 가능(모바일·외부 접속 불가). / Must start via terminal on that one PC; no mobile/remote.
- 로컬/클라우드 모드 혼동 위험 → 모드 표시 강화로 완화(아래). / Local-vs-cloud confusion, mitigated by mode indicators.
- 24/7 자동 스캔·스케줄러는 PC가 켜져 있을 때만 동작. / Background scans run only while the PC is on.

---

## 배포를 고려할 조건 / Triggers to reconsider deployment
하나라도 해당되면 배포 가치가 생긴다. / Any one of these makes deployment worthwhile:
1. 외부·이동 중 접속이 필요(집·외근·모바일). / Need access off the PC.
2. 터미널/모드 전환이 번거로워 "브라우저만 열면 끝"을 원함. / Want browser-only, no terminal.
3. 곧 다른 사람(후임·동료)도 사용. / A second user is coming.
4. 자동화(채용 메일 감지·경비 트리거)가 PC와 무관하게 24/7 돌아야 함. / Need 24/7 automation independent of the PC.

---

## 배포한다면 선결 조건 / Prerequisites before any public deploy
보안상 아래를 먼저 해결하지 않고 공개 배포하지 않는다. / Do not deploy publicly until:
1. **백엔드 인증 추가** — 현재 `X-User-Email` 헤더를 검증 없이 신뢰. 서버측 토큰(예: Supabase JWT) 검증 + 역할 권한 강제. / Real backend auth (verify JWT, enforce roles server-side).
2. **CORS 제한** — `allow_origins=["*"]` → 실제 프론트 도메인으로 한정. / Restrict CORS to the frontend domain.
3. **시크릿 외부화** — DB URL·API 키·Gmail 토큰을 플랫폼 env/시크릿스토어로. Gmail 토큰은 파일이라 PaaS 휘발성 FS 대응 필요. / Externalize secrets; handle Gmail token on ephemeral FS.
4. **런타임 정렬** — Procfile(3.11) vs 로컬 venv(3.9) 일치. / Align runtime versions.
5. RLS 기본 거부 유지(절대 끄지 않음). / Keep RLS default-deny.

### 중간안 / Middle option
공개는 싫지만 외부 접속만 원하면: 사설 접근(Tailscale·Cloudflare Tunnel, 본인 기기만) 또는 단일 비밀번호/IP 화이트리스트. 공개 인터넷에 직접 올리지 않음.
If remote access is wanted without going public: private tunnel (Tailscale/Cloudflare) or a single password / IP allowlist.

---

## 현재 보안 상태 (참고) / Current security posture
- RLS: 전 테이블 기본 거부(정책 0) — anon 키로 직접 조회 불가. ✅
- 시크릿: 레포/이력에 없음. `.env`·토큰·`run-cloud.sh`·`start-local.sh`·`gen-gmail-token.py` 모두 gitignore. ✅
- 주의: `DATABASE_URL`은 RLS를 우회하는 최상위 키 — 노출 금지, 의심 시 회전. ⚠️
- 클라우드 접속은 `ALLOW_PROD_DB=1` 가드로만(로컬 파일엔 두지 않음). ✅

---

## 로컬 편의화(적용됨) / Local convenience (done)
- `start-local.sh`(비추적): docker PG → 백엔드(로컬) → 프론트를 한 번에 기동 + 시작 시 "로컬 모드" 배너.
- 모드 표시: 백엔드 시작 로그 배너, `/api/health`의 `mode/host`, 사이드바 배지("데이터: 로컬/클라우드").
- 실데이터 작업은 명시적으로만: `cd backend && ./run-cloud.sh`.
