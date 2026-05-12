# Competency Framework

> Tree-first roadmap app — chia sẻ lộ trình học công khai như roadmap.sh, đo tiến độ như Duolingo, phân quyền như Linear.

[![Next.js 15](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://typescriptlang.org)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-green)](https://orm.drizzle.team)
[![Tailwind](https://img.shields.io/badge/Tailwind-3.4-cyan)](https://tailwindcss.com)

---

## Screenshots

> Add screenshots here. Suggested paths under `docs/screenshots/`:

| Route | File | Mô tả |
|---|---|---|
| `/` | `docs/screenshots/landing.png` | Landing page — hero "Lộ trình học tập trực quan" + 3 feature cards + grid roadmap công khai. |
| `/share/<slug>` | `docs/screenshots/share-dashboard.png` | Showcase công khai (read-only) — zigzag vertical path, stat chips, không cần đăng nhập. |
| `/share/<slug>/n/<nodeSlug>` | `docs/screenshots/share-node.png` | Trang chi tiết 1 node trong chế độ chia sẻ — breadcrumb, mô tả Markdown, sibling nav, CTA đăng nhập. |
| `/w/<slug>` | `docs/screenshots/learn-dashboard.png` | Dashboard học (auth-gated) — cùng layout share + lock/done/crown/streak/XP. |
| `/w/<slug>/n/<nodeSlug>` | `docs/screenshots/learn-node.png` | Trang node học — đánh dấu xong, note Markdown, evidence URLs, journal. |

---

## Why

Mỗi team training, onboarding pipeline, hoặc người tự học đều cần cùng một primitive: **một cây mục tiêu / lộ trình có thể chia sẻ + theo dõi tiến độ + phân quyền**.

Các công cụ hiện tại bắt phải chọn 1 trong 3:

- **roadmap.sh** đẹp, share tốt — nhưng không có tài khoản, không lưu tiến độ, không sửa được.
- **Notion / Google Doc** sửa thoải mái — nhưng không có hình cây, không gamification, share rộng thì rối.
- **LMS thương mại** đủ phân quyền — nhưng nặng, đắt, không mở public read-only được.

Project này nhập 3 nhu cầu vào 1 mô hình: **cây node `roadmap_tree_nodes`** đệ quy, được phục vụ bởi 2 mặt — `/share/<slug>` public read-only và `/w/<slug>` auth-gated learn mode.

---

## Features

- **Cây học tập đa cấp** — `roadmap_tree_nodes` đệ quy n-depth (Course → Phase → Stage → Week → Session → Lesson / Lab / Project / Milestone). Adjacency list + materialized `path_str`.
- **Showcase công khai** — workspace có `visibility = 'public-readonly'` tự động xuất ra `/share/<slug>` không cần đăng nhập, kèm OG image động `/api/og?slug=<slug>` để link đẹp trên Slack / Zalo / Twitter.
- **Learn mode auth-gated** — `/w/<slug>` có lock/unlock, `user_node_progress`, journal Markdown, streak, XP, hearts.
- **RBAC 7-tier** — Super-admin → Org-owner → Org-admin → WS-owner → WS-editor → WS-learner → Guest. Server actions + DB guards.
- **DevOps seed sẵn** — 286 node lộ trình DevOps Mastery 2026 (12 phases × ~24 weeks × lessons / labs / projects).

---

## Quickstart

Cần Node 20+, pnpm 9+, Docker (để chạy Postgres local).

```bash
# 1. Clone
git clone https://github.com/luannt2002/Competency-Framework.git
cd Competency-Framework/application

# 2. Env
cp .env.example .env.local
# Điền NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY, DATABASE_URL

# 3. Postgres local
docker compose up -d postgres

# 4. Cài + migrate + seed + chạy
pnpm install
pnpm db:push       # tạo bảng
pnpm db:seed       # seed DevOps tree (286 node) + workspace devops-test
pnpm dev
```

Mở [http://localhost:3000](http://localhost:3000) → đăng nhập magic link → hoặc xem ngay [/share/devops-test](http://localhost:3000/share/devops-test).

---

## Architecture

**Next 15 App Router** — toàn bộ là React Server Components by default, mutations qua Server Actions. Routes chia 3 nhánh: `/` (marketing), `/share/[slug]/**` (public), `/w/[slug]/**` (auth-gated, group `(app)`).

**Drizzle + Postgres** — schema chia 3 file: `schema.ts` (tenancy, templates, matrix, gamification), `schema-tree.ts` (`roadmap_tree_nodes` + `user_node_progress` — bảng chính phục vụ tree-first model), `schema-journal.ts` (note Markdown + evidence URLs per node). Tất cả workspace-scoped row có `workspace_id` indexed.

**RBAC 7-tier** — định nghĩa ở `src/lib/rbac/`, dùng ở 2 chỗ: (a) helper `requireWorkspaceAccess(slug)` chặn ở Server Action / Route Handler, (b) selective query filters ở `src/lib/tree/queries.ts`. Xem `docs/dev/RBAC_PERMISSIONS.md` cho ma trận đầy đủ.

**Supabase Auth** — magic link + Google OAuth. SSR session qua `@supabase/ssr`, client wrappers ở `src/lib/auth/`. Không dùng Supabase Postgres bắt buộc — `DATABASE_URL` có thể trỏ Docker Postgres local, chỉ cần Supabase project cho Auth.

---

## Routes

| Route | Mô tả |
|---|---|
| `/` | Landing — hero, 3 feature cards, grid public roadmap. |
| `/share/[slug]` | Showcase công khai 1 workspace — read-only, không auth. |
| `/share/[slug]/n/[nodeSlug]` | Chi tiết 1 node trong share mode — breadcrumb, body Markdown, CTA đăng nhập. |
| `/api/og?slug=&node=` | Dynamic OG image (PNG 1200×630, cache 1h) cho 2 route share trên. |
| `/sign-in` | Magic link + Google OAuth. |
| `/w/[slug]` | Dashboard học (auth) — cùng layout share + lock/done/crown. |
| `/w/[slug]/n/[nodeSlug]` | Node học — đánh dấu xong, evidence, journal. |
| `/w/[slug]/settings` | Quản lý workspace — đổi visibility, mời member, role. |

---

## Quality gates

```bash
pnpm typecheck         # tsc --noEmit (strict)
pnpm lint              # ESLint, 0 errors target
pnpm test              # Vitest unit
pnpm test:e2e          # Playwright smoke
pnpm guard             # no-mock + no-hardcode codebase guards
pnpm quality:check     # tất cả gates trên gộp 1 lệnh
```

---

## Docs

- [`docs/dev/RBAC_PERMISSIONS.md`](docs/dev/RBAC_PERMISSIONS.md) — ma trận 7-tier × resource × action, kèm test matrix.
- [`docs/business/PHAN_QUYEN.md`](docs/business/PHAN_QUYEN.md) — diễn giải tiếng Việt cho stakeholder không kỹ thuật.

---

## License

MIT — xem `LICENSE`.
