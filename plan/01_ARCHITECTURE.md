# 🏛️ ARCHITECTURE — Competency Framework

## 1. High-level diagram (text)

```
                    ┌─────────────────────────────────┐
                    │  Browser (Next.js 15 RSC)       │
                    │  - Server Components fetch DB   │
                    │  - Client Components for UX     │
                    │    (drawer, runner, charts)     │
                    └────────────┬────────────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │   Next.js Server Actions /      │
                │   API Routes (validation: Zod)  │
                │   - workspaces, skills,         │
                │     assessments, learn,         │
                │     gamification, imports       │
                └────────────────┬────────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            │                    │                    │
   ┌────────▼─────────┐  ┌──────▼──────┐    ┌────────▼────────┐
   │  Supabase Auth   │  │ Drizzle ORM │    │ Supabase        │
   │  - email magic   │  │  + Postgres │    │ Storage         │
   │  - Google OAuth  │  │  + RLS      │    │ (avatars,       │
   │                  │  │             │    │  exports)       │
   └──────────────────┘  └─────────────┘    └─────────────────┘
```

---

## 2. 2-Axis Mental Model (CORE)

```
                     ┌──────────────────────────────────────┐
                     │  WORKSPACE = 1 Framework instance    │
                     │  (DevOps, Frontend, Backend, ...)    │
                     └────────────┬─────────────────────────┘
                                  │
              ┌───────────────────┴────────────────────┐
              │                                        │
   ┌──────────▼───────────┐                ┌──────────▼───────────┐
   │  AXIS A — MATRIX     │                │  AXIS B — COURSE     │
   │  (measure)           │                │  (learn)             │
   │                      │                │                      │
   │  Categories          │                │  Level Tracks (P0)   │
   │   └ Skills           │ ◄────link──►   │   └ Weeks (P1)       │
   │       └ Level rubric │                │       └ Modules      │
   │       └ User progress│                │           └ Lessons  │
   │           - crowns   │                │               └Ex.   │
   │           - source   │                │                      │
   │             (claimed │                │  Each Lesson links   │
   │              vs      │                │  to Skill(s) +       │
   │              learned)│                │  contributes level   │
   └──────────────────────┘                └──────────────────────┘
                ▲                                        ▲
                │                                        │
                └────────  lesson_skill_map  ───────────┘
                   (link: lesson advances skill, contributes_to_level)
```

**Logic chính:**
- User vào workspace → thấy 2 view: Skills Matrix (đo) và Course Map (học).
- Hoàn thành lesson → trigger:
  1. `user_lesson_progress.status = 'completed'`.
  2. Cộng XP.
  3. Update `user_skill_progress.crowns++` cho skills link với lesson.
  4. Nếu đủ crowns + completion → có thể tăng `level_code` (level_source = 'learned').
  5. Cập nhật streak, hearts, badge eval.

---

## 3. Workspace seeding flow

```
┌────────────────────────────────────────────────────┐
│ 1. System seed (build time / first migration):     │
│    INSERT framework_templates                      │
│    (slug='devops', payload=devops.json)            │
└─────────────────┬──────────────────────────────────┘
                  │
                  │ user signs up
                  ▼
┌────────────────────────────────────────────────────┐
│ 2. Onboarding: user picks 'DevOps Mastery'        │
│    Server action: createWorkspaceFromTemplate     │
│      ├─ INSERT workspaces (owner=user, slug=devops)│
│      ├─ COPY payload → competency_levels          │
│      ├─                → skill_categories          │
│      ├─                → skills                    │
│      ├─                → level_tracks              │
│      ├─                → weeks                     │
│      ├─                → modules                   │
│      ├─                → lessons                   │
│      ├─                → exercises                 │
│      ├─                → lesson_skill_map          │
│      ├─                → badges (workspace-scoped) │
│      └─ INIT user_level_progress (XS unlocked,     │
│         S/M/L locked)                              │
└────────────────────────────────────────────────────┘
```

---

## 4. Data flow for the 2 Google Sheets (DevOps seed source)

**Sheet 1** — `gid=1970847068` — Skills Matrix
**Sheet 2** — `gid=1890838692` — Competency Levels

**Cách dùng:**

### Option A — Bake vào seed file (recommended cho MVP)
1. User export 2 tab ra CSV.
2. Run script `pnpm gen:seed-from-csv ./skills.csv ./levels.csv` → tạo/update `drizzle/seeds/devops.json`.
3. `pnpm db:seed` insert vào `framework_templates`.
4. Mọi user fork đều có data này.

### Option B — Re-import runtime (sau khi đã fork)
1. User vào `/w/devops/framework` → tab Import.
2. Paste Sheet URL public hoặc upload CSV.
3. Diff preview → confirm → upsert vào `skills` / `skill_categories` / `competency_levels` của workspace.

---

## 5. Component architecture

```
src/components/
├── ui/                  # shadcn primitives (button, badge, card, dialog, ...)
├── charts/              # Recharts/Tremor wrappers
│   ├── radar-coverage.tsx
│   ├── skill-heatmap.tsx
│   └── progress-ring.tsx
├── skills/              # Skills Matrix axis
│   ├── skills-table.tsx
│   ├── skill-drawer.tsx
│   ├── level-badge.tsx
│   └── level-popover.tsx
├── framework/           # Framework Editor
│   ├── category-list.tsx
│   ├── skill-list.tsx
│   └── level-editor.tsx
├── learn/               # Course (Trục B)
│   ├── course-path.tsx  # Duolingo SVG curved tree
│   ├── week-node.tsx
│   ├── lesson-card.tsx
│   └── exercise-runner/
│       ├── runner.tsx
│       ├── mcq.tsx
│       ├── fill-blank.tsx
│       ├── order-steps.tsx
│       └── type-answer.tsx
├── gamification/
│   ├── hearts-pill.tsx
│   ├── streak-flame.tsx
│   ├── xp-counter.tsx
│   └── crown-row.tsx
└── layout/
    ├── app-sidebar.tsx
    ├── topbar.tsx
    ├── bottom-tabbar.tsx     # mobile
    └── theme-provider.tsx
```

---

## 6. Key ADRs (Architecture Decision Records)

### ADR-001: 2-axis data model
**Status:** Accepted.
**Context:** Cần đo năng lực + dạy tự học.
**Decision:** Tách 2 axis, link qua `lesson_skill_map`.
**Trade-off:** Phức tạp hơn 1 axis, nhưng cho phép cả Skills Matrix tự đánh giá lẫn Course bài bản.

### ADR-002: Workspace-as-framework-instance
**Status:** Accepted.
**Context:** Cần support nhiều framework (DevOps/FE/BE) trong tương lai.
**Decision:** `workspaces` belongs-to `framework_templates`. Copy snapshot khi fork, không reference.
**Trade-off:** Duplicate data nhưng cho phép customize per-workspace mà không ảnh hưởng template.

### ADR-003: Server Actions over API Routes
**Status:** Accepted.
**Context:** Next.js 15.
**Decision:** Mutation đi qua Server Actions (`'use server'`), API Routes chỉ cho webhook / long import.
**Trade-off:** Tốt hơn DX, type-safe. Mất khả năng test API qua curl.

### ADR-004: Drizzle ORM (not Prisma)
**Status:** Accepted.
**Context:** Cần type-safe + edge-friendly.
**Decision:** Drizzle.
**Trade-off:** Migrations thủ công hơn Prisma, nhưng faster + serverless-friendly.

### ADR-005: Tailwind v4 (with v3.4 fallback)
**Status:** Accepted with fallback.
**Context:** v4 ra stable 2024, performance tốt.
**Decision:** Thử v4 trước, fallback v3.4 nếu plugin nào không tương thích.

### ADR-006: Single workspace per user in MVP
**Status:** Accepted.
**Context:** Multi-tenant org/team là DESIGN-ONLY.
**Decision:** Schema sẵn `organizations`, nhưng UI chỉ expose user-owned workspace.
**Trade-off:** Không tận dụng được team feature ngay, nhưng tránh complexity quá sớm.

---

## 7. Security model

- **RLS bật trên tất cả bảng** chứa workspace_id.
- Policy mẫu: user chỉ truy cập rows mà workspace.owner_user_id = auth.uid().
- Server actions luôn validate workspace ownership trước khi query.
- No raw SQL string concat — Drizzle prepared statements.
- Supabase service_role key chỉ dùng trong `drizzle/seed.ts` (server-only).
- CSRF: Server Actions built-in protection.

---

## 8. Performance budget

| Metric | Target |
|---|---|
| LCP | < 2.5s |
| INP | < 200ms |
| TTI | < 3s |
| Bundle JS (Skills page) | < 200KB |
| Bundle JS (Lesson Runner) | < 300KB (Framer Motion + lottie) |
| DB queries per page | ≤ 3 |

Tools: Next.js bundle analyzer, Lighthouse, Vercel Speed Insights.

---

## 9. Future architecture changes (DESIGN_FUTURE)

1. Multi-tenant Org/Team → enable `org_id`, RLS extended.
2. Spaced repetition → background job + `review_schedules`.
3. AI tutor → separate edge function calling Claude API.
4. Public sharing → middleware bypass RLS for `visibility='public-readonly'`.
5. Community templates → moderation queue + voting.
6. Mobile native → Expo app reusing Server Actions via REST wrapper.

---

## 10. Tham chiếu

- **Prompt nguồn:** `../PROMPT_DEVOPS_MASTERY_WEB_APP.md`
- **2 Google Sheets nguồn dữ liệu DevOps:**
  - Skills: https://docs.google.com/spreadsheets/d/1mejAsbHOU2c2GEQ3hTs2_sQyXD4vxgtttsuy7dRbTvw/edit?gid=1970847068
  - Levels: https://docs.google.com/spreadsheets/d/1mejAsbHOU2c2GEQ3hTs2_sQyXD4vxgtttsuy7dRbTvw/edit?gid=1890838692
