# 🎯 Competency Framework

> *"Fork a competency framework. Learn the gaps. Master the level."*
> A workspace-first, framework-agnostic platform combining **roadmap.sh forkability** + **Duolingo-style self-learning** + **Skills Matrix self-assessment**.

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-green)](https://supabase.com)
[![Tailwind](https://img.shields.io/badge/Tailwind-3.4-cyan)](https://tailwindcss.com)

---

## ✨ Features (MVP roadmap)

- **🎯 Competency Matrix** — Skills × Levels (XS/S/M/L) with self-assessment, evidence links, notes (Markdown).
- **📚 Course Map (Duolingo-style)** — Curved path of 12 weeks × 4 levels, lock/unlock, progress nodes.
- **🧩 Lesson Runner** — 5 exercise types (MCQ, fill-blank, order-steps, type-answer, code review) with instant feedback.
- **🏆 Gamification** — XP, Streak, Hearts, Crowns per skill, Badges.
- **🏗️ Framework Editor** — CRUD categories/skills/levels; import from Google Sheets / CSV / JSON.
- **🌑 Dark-first UI** — Linear/Vercel aesthetic, mobile responsive, keyboard-driven.
- **🔓 Workspace-first** — DevOps first, easily add Frontend / Backend / Data Eng frameworks.

---

## 🏛️ Architecture

```
Workspace = 1 Framework instance
   │
   ├── Axis A: Competency Matrix
   │     Categories → Skills → Levels (XS/S/M/L) → User assessment
   │
   └── Axis B: Learning Path (Duolingo-style)
         Level Tracks → Weeks → Modules → Lessons → Exercises
              ↑ linked via lesson_skill_map ↑
```

See `../plan/01_ARCHITECTURE.md` for ADRs and full diagrams.

---

## 🛠️ Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, Server Components, Server Actions) |
| Language | TypeScript strict |
| Style | Tailwind 3.4 + shadcn/ui + Framer Motion |
| DB | Supabase Postgres |
| ORM | Drizzle ORM |
| Auth | Supabase Auth (magic link + Google) |
| Charts | Recharts (radar, bar, area) |
| Tables | TanStack Table + Virtual |
| Forms | react-hook-form + Zod |
| Tests | Vitest + Playwright |
| Pkg | pnpm 9+ |

---

## 🚀 Setup local

### Prerequisites
- Node 20+
- pnpm 9+
- A free Supabase project (https://supabase.com)

### Steps

```bash
# 1. Clone
git clone https://github.com/luannt2002/Competency-Framework.git
cd Competency-Framework/application

# 2. Configure env
cp .env.example .env.local
# Edit .env.local with your Supabase keys + DATABASE_URL

# 3. Install
pnpm install

# 4. Push schema to Supabase
pnpm db:push

# 5. Seed DevOps framework template
pnpm db:seed

# 6. Run dev
pnpm dev
```

Open http://localhost:3000 — sign in via magic link, fork the DevOps template, start learning.

---

## 📊 Data sources

The DevOps framework seed is generated from 2 Google Sheets:
- **Skills Matrix:** [Sheet 1 (gid 1970847068)](https://docs.google.com/spreadsheets/d/1mejAsbHOU2c2GEQ3hTs2_sQyXD4vxgtttsuy7dRbTvw/edit?gid=1970847068)
- **Competency Levels:** [Sheet 2 (gid 1890838692)](https://docs.google.com/spreadsheets/d/1mejAsbHOU2c2GEQ3hTs2_sQyXD4vxgtttsuy7dRbTvw/edit?gid=1890838692)

### Re-generating seed from CSV

```bash
# Export both sheet tabs to CSV → place in drizzle/seeds/raw-csv/
# Then:
pnpm gen:seed-from-csv
pnpm db:seed
```

---

## 🧩 Adding a new framework (e.g., Frontend Engineer)

1. Create JSON file in `drizzle/seeds/frontend-react.json` following the schema in `drizzle/seeds/devops.json`.
2. Add entry in `drizzle/seed.ts`:
   ```ts
   await seedTemplate('frontend-react', './seeds/frontend-react.json');
   ```
3. Run `pnpm db:seed`.

No code changes — schema is framework-agnostic.

---

## 🧪 Tests

```bash
pnpm test         # unit (Vitest)
pnpm test:e2e     # E2E smoke (Playwright)
pnpm typecheck    # tsc --noEmit
pnpm lint         # ESLint
```

---

## 📁 Folder structure

```
application/
├── src/
│   ├── app/                # Next.js App Router pages
│   │   ├── (marketing)/    # landing, templates catalog
│   │   ├── (auth)/         # sign-in
│   │   └── (app)/          # authenticated app
│   │       └── w/[slug]/   # workspace-scoped routes
│   ├── components/
│   │   ├── ui/             # shadcn primitives
│   │   ├── skills/         # matrix axis
│   │   ├── learn/          # course axis
│   │   ├── gamification/
│   │   └── layout/
│   ├── lib/
│   │   ├── db/             # Drizzle client + schema
│   │   ├── auth/           # Supabase server/client
│   │   └── workspace.ts
│   ├── actions/            # Server Actions
│   ├── hooks/
│   └── styles/
├── drizzle/
│   ├── seeds/
│   │   └── devops.json     # DevOps framework payload
│   └── seed.ts
└── tests/
```

---

## 🗺️ Build status

See [`../plan/02_BUILD_STEPS.md`](../plan/02_BUILD_STEPS.md) for milestone tracker.

Currently shipped: **M0 Foundation Scaffold** (Step 0–4).

Coming next: M1 Skills Matrix axis (Step 5–7).

---

## 🙏 Inspiration & credits

- [roadmap.sh](https://github.com/kamranahmedse/developer-roadmap) — fork & customize concept
- [Duolingo](https://duolingo.com) — learning loop, gamification
- [stride-so/matrix](https://github.com/stride-so/matrix) — competency matrix structure
- [henfrydls/Skima](https://github.com/henfrydls/Skima) — self-host mindset
- [Linear](https://linear.app), [Vercel](https://vercel.com) — dark UI aesthetic

---

## 📄 License

MIT
