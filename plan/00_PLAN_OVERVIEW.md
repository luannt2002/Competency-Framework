# 🗺️ PLAN OVERVIEW — Competency Framework Web App

> **Tên product:** Competency Framework
> **Code repo:** `/root/application/devops-roadmap/application/` (Next.js project tên `competency-framework`)
> **Prompt nguồn:** `/root/application/devops-roadmap/PROMPT_DEVOPS_MASTERY_WEB_APP.md`
> **Ngày bắt đầu:** 2026-05-11

---

## 1. Câu trả lời thẳng: Có build được không?

**CÓ.** Prompt đã chi tiết đến mức 1 senior full-stack engineer + AI pair có thể build trong **4–8 tuần thực** (1 dev part-time) hoặc **1–2 tuần** (1 dev full-time + Cursor/Claude code).

Tuy nhiên 1 lượt chat không build hết được (~30k+ LOC). Plan này chia thành **6 milestone** rõ ràng, mỗi milestone có thể giao cho AI trong 1 phiên làm việc.

---

## 2. Milestone roadmap

| Milestone | Tên | Output | Step trong prompt | Effort thực |
|---|---|---|---|---|
| **M0** | Foundation Scaffold | Project chạy `pnpm dev`, có DB schema, layout, dashboard placeholder | Step 0–4 | ~6h |
| **M1** | Skills Matrix + Drawer | Đo năng lực hoàn chỉnh (Trục A) | Step 5–7 | ~10h |
| **M2** | Framework Editor + Import | CRUD framework data + import CSV/Sheet | Step 8 | ~6h |
| **M3** | Course Map (Duolingo path) | UI Duolingo curved path + Week Detail | Step 9–10 | ~8h |
| **M4** | Lesson Runner + 5 Exercise types | Trục B hoạt động (Duolingo-style) | Step 11–12 | ~14h |
| **M5** | Gamification + Dashboard + Polish | XP/streak/hearts/crowns/badges + charts + mobile + tests | Step 13–16 | ~12h |

**Tổng:** ~56h work, đủ cho 1 MVP có thể demo cho người khác.

> M0 = bản scaffold tôi build NGAY trong session này. Các M tiếp theo bạn paste prompt từ Section "Build Order" trong `PROMPT_*.md` cho Claude/Cursor làm tiếp.

---

## 3. Quy ước branch & commit

Khuyến nghị Git flow đơn giản:
- `main` — luôn deployable.
- `feature/M{N}-{slug}` — mỗi milestone 1 branch.
- Commit message Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`.

---

## 4. Tech stack đã chốt

- **Frontend:** Next.js 15 App Router + TypeScript strict + Tailwind 4 + shadcn/ui + Framer Motion.
- **Backend:** Next.js Server Actions + Drizzle ORM + Supabase Postgres.
- **Auth:** Supabase Auth (magic link + Google).
- **Charts:** Recharts + Tremor.
- **Tests:** Vitest + Playwright.
- **Package manager:** pnpm 9+.
- **Node:** 20+.

---

## 5. Phụ thuộc bên ngoài

| Service | Mục đích | Free tier đủ MVP? |
|---|---|---|
| **Supabase** | DB + Auth + Storage | Yes (500MB DB, 50k MAU) |
| **Vercel** | Hosting + edge | Yes (hobby) |
| **GitHub** | Source + Actions CI | Yes |

Setup mất ~30 phút (làm sau khi M0 xong).

---

## 6. Files structure tổng quan

```
devops-roadmap/
├── plan/                          ← bạn đang ở đây
│   ├── 00_PLAN_OVERVIEW.md
│   ├── 01_ARCHITECTURE.md
│   ├── 02_BUILD_STEPS.md
│   └── 03_NEXT_ACTIONS.md
├── application/                   ← code Next.js project
│   ├── package.json
│   ├── src/
│   ├── drizzle/
│   └── ...
└── PROMPT_DEVOPS_MASTERY_WEB_APP.md
```

---

## 7. Risk register

| Risk | Khả năng | Tác động | Mitigation |
|---|---|---|---|
| Seed content quá lớn (48 weeks × 30 exercises) | High | AI timeout, file lớn | M0 chỉ seed 1 week mẫu; M4 expand dần |
| Supabase free tier hết quota | Low | DB không kết nối | Monitor + upgrade khi cần |
| Tailwind 4 chưa stable cho 1 số plugin | Med | Build fail | Fallback Tailwind 3.4 |
| Drizzle migration drift | Med | Schema không match DB | Always `pnpm db:push` trước dev |
| AI generate code không type-safe | Med | Errors TS | Strict mode + review từng file |

---

## 8. Definition of Done — MVP (theo prompt)

Sau khi tất cả milestone xong, app phải:
- [ ] `pnpm dev` không error.
- [ ] User mới sign-in → fork DevOps framework → có data.
- [ ] Skills Matrix: filter, search, drawer, assess, bulk edit.
- [ ] Course Map: Duolingo path render đầy đủ 4 levels × 12 weeks.
- [ ] Lesson Runner: chạy 5 exercise types, có feedback + end screen.
- [ ] Gamification: XP, streak, hearts, crowns, badges working.
- [ ] Dashboard: radar, heat map, progress ring, today block.
- [ ] Mobile responsive.
- [ ] Lighthouse ≥ 90.
- [ ] Smoke E2E pass.
- [ ] 0 `any`, 0 console errors.

---

## 9. Cách tiếp tục sau M0

Mở `03_NEXT_ACTIONS.md` để biết bước kế tiếp ngay sau khi tôi xong M0.
