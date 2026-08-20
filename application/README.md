# Competency Framework

**Open source roadmap builder — create, share, track.**

The self-hostable alternative to roadmap.sh with progress tracking, gamification, and team access control.

[![Next.js 15](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://typescriptlang.org)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-green)](https://orm.drizzle.team)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## What is this?

Anyone can **create a roadmap** (a skill tree with unlimited depth), **share a public link** — no login required for viewers — and **track progress** with streaks, XP, and evidence-based completion.

| Use case | Example |
|---|---|
| Individual learner | "My 12-month DevOps journey" — public roadmap, daily planner, streaks |
| Course creator | Publish a structured learning path, track where students drop off |
| Team onboarding | Assign roadmaps to members, track skill gaps, export certificates |
| Open curriculum | Share a public Java / Math / DevOps tree that others can fork and use |

---

## Why not just use...

| Tool | Gap |
|---|---|
| **roadmap.sh** | Beautiful, but no user accounts, no progress, not editable |
| **Notion** | Flexible, but no tree visualization, no gamification |
| **Teachable / Udemy** | Full LMS, but expensive, closed, no public read-only mode |
| **Excel / Google Sheets** | Easy to edit, but not shareable as an interactive tree |

This project combines all three: a recursive `roadmap_tree_nodes` tree, served as `/share/<slug>` (public, no auth) and `/w/<slug>` (learn mode, auth-gated).

---

## Demo

> Live demo: _coming soon — deploy yours in 5 minutes with the guide below_

| View | What you see |
|---|---|
| `/share/devops-test` | Public DevOps roadmap (286 nodes, no login) |
| `/w/devops-test` | Same roadmap in learn mode — mark done, journal, streaks |
| `/discover` | Public gallery — browse and fork community roadmaps |

---

## Features

**For learners**
- Unlimited-depth skill tree — Course → Phase → Stage → Week → Lesson / Lab / Project
- Mark nodes done, doing, or skipped with evidence URLs (GitHub repo, blog post, screenshot)
- Streaks, XP, hearts, crowns, badges — Duolingo-style motivation
- Daily planner — AI picks 3-5 tasks from your roadmap based on weak skills + streak
- Node journal — Markdown notes per node, revision history
- Certificate export per workspace

**For creators**
- Drag-and-drop tree editor
- Attach resources (links, videos, docs) to any node
- One public link to share — dynamic OG image for Slack / Twitter / LinkedIn previews
- Learners can fork your roadmap and track their own progress
- Analytics: who viewed, who is stuck at which step _(coming soon)_

**For teams**
- RBAC 7-tier: Super-admin → Org-owner → Org-admin → WS-owner → Editor → Learner → Guest
- Invite members, assign roles, audit log
- Bulk invite via CSV
- Skills matrix — self-claimed vs. learned vs. verified competency levels

**For devs who want to self-host**
- Docker Compose in one command
- Bring your own Postgres — Supabase is only used for Auth (or swap it out)
- No vendor lock-in on data
- Import from Google Sheets CSV or Markdown files

---

## Deploy in 5 minutes

### Option 1 — Vercel (easiest)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/luannt2002/Competency-Framework&project-name=competency-framework&root-directory=application)

You still need a Supabase project (free tier) for Auth and a Postgres database.

### Option 2 — Docker local

```bash
git clone https://github.com/luannt2002/Competency-Framework.git
cd Competency-Framework/application

cp .env.example .env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY, DATABASE_URL

docker compose up -d postgres
pnpm install
pnpm db:push       # create tables
pnpm db:seed       # seed 286-node DevOps roadmap + workspace
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — or view the public roadmap immediately at [/share/devops-test](http://localhost:3000/share/devops-test) without logging in.

**Requirements:** Node 20+, pnpm 9+, Docker

---

## Architecture

```
/                          ← Marketing landing + public roadmap gallery
/share/[slug]              ← Public read-only workspace (no auth required)
/share/[slug]/n/[slug]     ← Public node detail — markdown, sibling nav, login CTA
/api/og                    ← Dynamic OG image (1200×630 PNG, 1h cache)
/sign-in                   ← Magic link + Google OAuth
/w/[slug]                  ← Learn mode (auth-gated)
/w/[slug]/n/[slug]         ← Node learn view — mark done, evidence, journal
/w/[slug]/daily            ← AI-powered daily task planner
/w/[slug]/skills           ← Skills matrix — assess, filter, bulk edit
/w/[slug]/roster           ← Team members + roles
/w/[slug]/audit            ← Admin audit log
/w/[slug]/certificate/[id] ← Printable certificate
```

**Stack**

- **Next.js 15 App Router** — RSC by default, mutations via Server Actions
- **Drizzle ORM + Postgres** — schema split across `schema.ts` (tenancy, gamification), `schema-tree.ts` (n-depth tree), `schema-journal.ts` (notes + evidence)
- **Supabase Auth** — magic link + Google OAuth via `@supabase/ssr`; Postgres can be any provider
- **Tailwind + Radix UI + Framer Motion** — accessible, animated components
- **Vitest + Playwright** — unit tests + E2E smoke suite

---

## Included seed data

Run `pnpm db:seed` to get a ready-to-use **DevOps Mastery 2026** workspace:

- **286 nodes** — 12 phases × ~24 weeks × lessons / labs / projects / milestones
- Covers: Linux, Networking, AWS, Terraform, Kubernetes, CI/CD, GitOps, DevSecOps, Observability, Go, Platform Engineering
- Immediately browsable at `/share/devops-test` without any account

---

## Quality

```bash
pnpm typecheck       # tsc --noEmit (strict mode)
pnpm lint            # ESLint, 0 errors target
pnpm test            # Vitest unit tests
pnpm test:e2e        # Playwright smoke
pnpm guard           # no-mock + no-hardcode codebase guards
pnpm quality:check   # all of the above in one command
```

Guards enforce that no business data is hardcoded in UI and no mock data runs at runtime — all reads come from the real database.

---

## Roadmap

- [ ] Creator analytics dashboard (views, drop-off by node, conversion)
- [ ] Public marketplace — browse and fork community roadmaps
- [ ] Payment integration for paid roadmaps (Stripe / VNPay)
- [ ] Embed widget — paste an iframe into any blog or website
- [ ] AI roadmap generator — describe a topic, get a full tree in seconds
- [ ] Notion / Google Sheets import wizard
- [ ] Mobile app (React Native)

---

## Contributing

Pull requests are welcome. For major changes, open an issue first.

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/Competency-Framework.git
cd Competency-Framework/application

# 2. Install and run
cp .env.example .env.local   # fill in env vars
docker compose up -d postgres
pnpm install && pnpm db:push && pnpm db:seed
pnpm dev

# 3. Before submitting a PR
pnpm quality:check
```

Areas where contributions are most welcome:
- New seed templates (Data Engineering, Product Management, Frontend, etc.)
- UI/UX improvements
- Import parsers (Notion, Obsidian, Miro)
- Translations

---

## Docs

- [RBAC permissions matrix](docs/dev/RBAC_PERMISSIONS.md) — 7-tier × resource × action
- [Business permissions (Vietnamese)](docs/business/PHAN_QUYEN.md)

---

## License

MIT — free to use, self-host, and modify.
