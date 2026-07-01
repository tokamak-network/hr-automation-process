---
title: 로컬 vs 클라우드 사용 규칙 / Local vs Cloud — Usage Rule
audience: Member 2 (매일 사용) / daily operator
status: quick reference (읽기 쉽게, 짧게)
updated: 2026-07-01
related: docs/deployment-decision-note.md, 운영 매뉴얼들
note: "데이터가 사라진 것처럼 보임"이 반복돼서 만든 규칙. 대부분 로컬(테스트) 모드를 보고 있어서 생긴 착시.
---

# 로컬 vs 클라우드 — 사용 규칙
# Local vs Cloud — Usage Rule

> [!important] 한 줄 규칙 / The one rule
> **실데이터를 봐야 하면 → 클라우드 모드 (`./run-cloud.sh`, 빨강 배지).**
> **기능만 테스트하면 → 로컬 모드 (`./start-local.sh`, 초록 배지).**
> Real data → cloud (red badge). Testing only → local (green badge).

---

## 언제 어느 모드? / Which mode when?

| 하려는 일 / Task | 모드 / Mode | 실행 / Run |
|---|---|---|
| 실제 후보·경비·급여 확인·처리 / real records | 🔴 클라우드 / Cloud | `./run-cloud.sh` → `yes` |
| 월말 정산, 실제 업무 / real month-end work | 🔴 클라우드 / Cloud | `./run-cloud.sh` → `yes` |
| 새 기능·버튼 동작 테스트 / feature testing | 🟢 로컬 / Local | `./start-local.sh` |
| 화면·UI 실험 / UI experiments | 🟢 로컬 / Local | `./start-local.sh` |

---

## ⚠️ "데이터가 사라졌다" 싶을 때 / When data "looks gone"

> [!warning] 놀라기 전에 — 배지부터 확인 / Before panicking — check the badge
> 화면에서 후보·경비·급여가 비어 보이거나 적게 보이면, **사라진 게 아니라 로컬(테스트) 모드일 가능성이 높다.**
> If records look empty or missing, it's almost always because you're in **local (test) mode — not because data is gone.**

**확인 순서 / Check in order:**
1. 사이드바 **배지 색**을 본다. 🟢 초록이면 로컬(테스트) — 실데이터가 아니다. / Check the badge color first.
2. 실데이터를 보려면 백엔드를 끄고 `./run-cloud.sh`로 다시 켠다(🔴 빨강 확인). / Restart in cloud mode.
3. 그래도 이상하면 그때 살펴본다. **원본은 클라우드에 안전하다.** / The source of truth is safe in the cloud.

> [!note] 왜 이런 일이 생기나 / Why this happens
> 로컬 PG는 테스트용 복사본이라, 클라우드(원본)의 최신 데이터가 자동으로 반영되지 않는다. 그래서 로컬만 보면 "뒤처져" 보인다. 실데이터는 항상 클라우드에 있다.
> The local PG is a test copy; it doesn't auto-sync from the cloud (source of truth). Local can look stale. Real data always lives in the cloud.

---

## 기억할 것 / Remember

- **초록 배지 = 연습장.** 뭘 해도 실데이터 안 상함. / Green = practice; safe.
- **빨강 배지 = 실제.** 여기서 하는 건 진짜 반영됨. 신중히. / Red = real; act carefully.
- **비어 보이면 = 모드 확인.** 데이터는 클라우드에 안전. / Empty? Check mode. Data is safe.
