# 📋 PROMPT — Build "Mastery Grid" — Competency Framework × Duolingo-style Self-Learning Platform

> **Bản chỉnh sửa lần 3 — phiên bản mạnh nhất, ready-to-paste.**
> Copy đoạn giữa `=== BEGIN PROMPT ===` và `=== END PROMPT ===` rồi paste vào Claude Opus 4.7 / Cursor / Claude Code.
> Kèm 2 file CSV xuất từ 2 tab Google Sheets nguồn nếu AI không browse được.

---

## 🎯 Một câu mô tả

> *"Mạnh hơn roadmap.sh ở khả năng customize, mạnh như Duolingo ở khả năng tự học — xương sống là Competency Framework theo level (P0) + roadmap tuần (P1) + bài học + bài tập tương tác."*

---

## 🧠 Mental Model — 2 trục mạnh

Hệ thống có **2 trục đan vào nhau**:

### Trục A — Competency Matrix (đo năng lực)
```
Workspace (DevOps Framework)
  └── Categories (AWS, Terraform, K8s, Go, Security, ...)
        └── Skills (IAM Deep, VPC Networking, Module Design, ...)
              └── Per skill: rubric XS/S/M/L + self-assessment
```

### Trục B — Learning Path / Course (giúp đạt level)
```
Workspace
  └── Level Tracks: P0 = XS-track, S-track, M-track, L-track
        └── Weeks (P1): tuần 1..N trong mỗi level
              └── Modules (chủ đề nhỏ trong tuần)
                    └── Lessons (Duolingo card: 5-10 phút)
                          └── Exercises (mcq, fill, order, type, code, mini-lab)
```

### Liên kết 2 trục
- Mỗi **Lesson** gắn với 1-N **Skills** + level mà nó nâng cấp (vd: hoàn thành lesson "IAM Trust Policy" → tăng evidence cho skill `iam-deep` mức S).
- Hoàn thành **đủ % Lessons** của Week → unlock Week sau.
- Hoàn thành **đủ Weeks** của Level → đạt P0-level cho tập skills liên quan → unlock Level tiếp theo.
- Self-assessment vẫn cho phép user "khai" level mà không cần học, nhưng app có badge phân biệt **"Learned"** vs **"Self-claimed"**.

---

## 🔥 Tham chiếu inspiration (lấy ý, không copy)

| Sản phẩm | Lấy gì | Không lấy gì |
|---|---|---|
| **roadmap.sh** | Concept fork & customize, node-based path graph view, mỗi node clickable mở resources | Nội dung tĩnh, thiếu interactive |
| **Duolingo** | Path tree dạng đường ngoằn (curved nodes), unit/section, lesson card, hearts, streak, league, crowns, idle animation mascot, instant feedback exercise | Quá game-y với tiếng động dày — ta giữ tinh tế |
| **Brilliant** | Exercise interactive, drag-to-order, fill blank đẹp, step-by-step explain sau khi sai | Quá học thuật |
| **stride-so/matrix** | Cấu trúc Competency Matrix (Track × Level × Examples) | Chỉ Sheets, không có DB |
| **henfrydls/Skima** | Gap analysis, development plan | UI Django cũ |
| **Linear / Vercel** | Dark mode đẹp, keyboard-driven, info-density | — |
| **Notion** | Markdown editor, slash menu | — |

**Khác biệt cốt lõi với roadmap.sh:** roadmap.sh là wiki tĩnh để đọc. App này là **interactive learning loop**: đo → học → làm bài tập → đo lại → unlock cấp tiếp.

**Khác biệt với Duolingo:** Duolingo dạy ngôn ngữ; app này dạy năng lực kỹ thuật, kèm self-assessment matrix và evidence portfolio (link GitHub, blog, cert).

---

## 🔗 Tài nguyên đính kèm

- **Google Sheets nguồn (DevOps seed):**
  - Tab 1 — Skills Matrix: https://docs.google.com/spreadsheets/d/1mejAsbHOU2c2GEQ3hTs2_sQyXD4vxgtttsuy7dRbTvw/edit?gid=1970847068
  - Tab 2 — Competency Levels: https://docs.google.com/spreadsheets/d/1mejAsbHOU2c2GEQ3hTs2_sQyXD4vxgtttsuy7dRbTvw/edit?gid=1890838692
- **Domain content cho seed lessons:** 5 file `0X_*.md` trong folder này = nội dung 48 tuần roadmap DevOps (Q1–Q4). Dùng để generate lessons + exercises.

---

=== BEGIN PROMPT ===

# 🚀 Build "Mastery Grid" — A Competency Framework × Duolingo-style Learning Platform

## 0. ROLE

Bạn là **Principal Full-stack Engineer + Learning Experience Designer 2026**, từng dẫn build sản phẩm như Linear, Brilliant, Duolingo. Bạn:
- Code Next.js 15 + TypeScript strict production-grade.
- Thiết kế learning loop hiệu quả: micro-lesson 5–10 phút + exercise có instant feedback + spaced repetition.
- Dark-first UI đẹp, micro-interaction mượt, thân thiện mobile.
- Schema-first, framework-agnostic.

**Triết lý xuyên suốt:**
1. **2 trục đan vào nhau** — Competency Matrix (đo) + Learning Path (học). Mọi feature phải phục vụ 1 trong 2 hoặc liên kết 2 trục.
2. **Framework-agnostic.** DevOps chỉ là seed đầu tiên. Code không hard-code domain.
3. **Workspace = 1 framework instance**, user có thể fork nhiều workspace (sau MVP: FE/BE/DS).
4. **P0 / P1 hierarchy là first-class:** P0 = Competency Level (XS/S/M/L); P1 = Week trong Level đó.
5. **Learning loop > content dump.** Mỗi lesson phải có exercise → instant feedback → XP → streak.
6. **Self-assessment vẫn quan trọng** — nhưng phân biệt "Learned" vs "Self-claimed" trong UI.
7. **Type-safe, schema-first, no `any`.**
8. **Mobile-first thực sự** vì học Duolingo-style thường trên mobile.

---

## 1. PRODUCT — "Mastery Grid"

### Tagline
*"Fork a competency framework. Learn the gaps. Master the level."*

### Đối tượng MVP
Solo engineer học DevOps có hệ thống. Tự fork framework "DevOps Mastery" → có roadmap tuần kèm bài học + bài tập + đo level liên tục.

### Seed content cho MVP
**Framework "DevOps Mastery"** với:
- ~150–250 Skills (lấy từ Tab 1 Google Sheet).
- 4 Competency Levels (XS/S/M/L) từ Tab 2.
- 4 Level Tracks × 12 Weeks = **48 Weeks** lesson nội dung (sinh từ 5 file roadmap đính kèm — AI tự derive 3–5 lessons + 3–7 exercises mỗi tuần).
- 10 Badges seed.
- 10–20 Achievements milestone.

---

## 2. SCOPE — đọc rất kỹ, không vượt

### 🟢 MUST BUILD (MVP — code chạy được)

**A. Auth + Onboarding**
1. Supabase Auth (email magic link + Google OAuth).
2. Onboarding: pick framework → name workspace → fork → redirect dashboard.

**B. Competency Matrix axis**
3. Skills Matrix page với filter / search / sort / bulk edit / inline level / virtualization.
4. Skill Drawer với rubric + self-assessment + evidence + note markdown + target level + auto-save.
5. Framework Editor (Categories / Skills / Levels CRUD + reorder + import/export JSON/CSV).
6. Dashboard: radar coverage + heat map + progress ring + weakest skills + recent activity.

**C. Learning Path axis (Duolingo-style)**
7. **Course Map page (`/w/[slug]/learn`):** path graph dạng Duolingo curved tree, 4 sections (1 per Level XS→L), mỗi section có 12 weeks, mỗi week là 1 node. Click week → mở Week Detail.
8. **Week Detail page (`/w/[slug]/learn/[levelCode]/[weekIndex]`):** mô tả tuần, list modules → lessons → exercises. Progress bar tuần.
9. **Lesson runner (`/w/[slug]/learn/[levelCode]/[weekIndex]/[lessonSlug]`):** full-screen focus mode chạy chuỗi exercise:
   - Header progress bar mảnh.
   - Body: 1 exercise tại 1 thời điểm.
   - Footer: "Check" button → instant feedback → "Continue".
   - End screen: XP earned + streak update + Continue / Back to map.
10. **Exercise types (MVP build 5 loại):**
    - `mcq` — Multiple choice 1 đáp án.
    - `mcq_multi` — Multiple choice nhiều đáp án.
    - `fill_blank` — Điền vào chỗ trống (1 hoặc nhiều ô).
    - `order_steps` — Sắp xếp các bước theo thứ tự đúng (drag).
    - `type_answer` — Gõ câu trả lời ngắn (regex match cho variations).
11. **Gamification core:**
    - **XP system** — mỗi exercise đúng = 10 XP; lesson hoàn thành = +20 XP bonus; week finish = +100 XP; level finish = +500 XP. Lưu vào `xp_events`.
    - **Streak** — đếm số ngày liên tiếp user hoàn thành ≥ 1 lesson. Hiển thị flame icon ở topbar.
    - **Hearts (lives)** — 5 hearts; sai 1 exercise = -1 heart; cạn → "Out of hearts, come back tomorrow" hoặc "Practice mode" (không XP). Refill 1 heart / 4 giờ.
    - **Crowns per Skill** — Skill có max 5 crowns (Bronze, Silver, Gold, Platinum, Diamond). Mỗi lần hoàn thành 1 round lesson liên quan → +1 crown.
    - **Badges** — auto-grant khi đạt milestone (first lesson, 7-day streak, finish week, finish level, all S in AWS, …).
12. **Profile + Settings + Roadmap placeholder + Templates catalog.**
13. **Mobile-first navigation** — bottom tab bar khi < `md`: Home / Learn / Skills / Profile.

### 🟡 DESIGN ONLY (schema + DESIGN_FUTURE.md + mock UI, KHÔNG code logic)

1. **Multi-tenant Org/Team.**
2. **Export PDF/Excel.**
3. **Spaced Repetition** (SM-2 algorithm) — schema `review_schedules`, doc thuật toán.
4. **League / Leaderboard** weekly (Bronze/Silver/Gold leagues).
5. **AI Tutor chat** (giải thích khi sai exercise).
6. **Public sharing read-only.**
7. **Community publish framework template.**
8. **Mobile native** (Expo wrapper).
9. **Code challenge exercise type** (in-browser playground).
10. **Real lab exercise type** (kết nối Killercoda / Instruqt).

### 🔴 OUT OF SCOPE
- Native mobile app.
- Realtime presence.
- Payments.
- Live class / video conferencing.

---

## 3. TECH STACK — bắt buộc

| Layer | Lựa chọn | Version |
|---|---|---|
| Framework | Next.js App Router | 15.x |
| Language | TypeScript strict | 5.6+ |
| Style | Tailwind CSS | 4.x (or 3.4 fallback) |
| Components | shadcn/ui | latest |
| Animation | Framer Motion | 11+ |
| Icons | Lucide React + Tabler Icons | latest |
| Charts | Recharts + Tremor | latest |
| Tables | TanStack Table + Virtual | latest |
| Forms | react-hook-form + Zod | latest |
| Markdown | react-markdown + remark-gfm + rehype-highlight | latest |
| Drag-drop | @dnd-kit/core (cho order_steps + reorder editor) | latest |
| Confetti | `canvas-confetti` (level up) | latest |
| Lottie | `@lottiefiles/react-lottie-player` (mascot/streak) | latest |
| Audio | `howler.js` cho exercise feedback nhỏ (toggle off được) | latest |
| DB | Supabase Postgres | — |
| ORM | Drizzle ORM | latest |
| Auth | Supabase Auth | — |
| State | RSC + Server Actions chính; Zustand cho lesson runner state | — |
| Tests | Vitest + Testing Library + Playwright | latest |
| Lint | ESLint + Prettier + eslint-plugin-tailwindcss | — |
| CI | GitHub Actions | — |
| Pkg | pnpm | — |

**Quy định:**
- Strict TS: `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`.
- Không `any`. Dùng `unknown` + narrow / `z.infer<typeof schema>`.
- DB query phải qua DAL `db.scoped(workspaceId)`.
- Server Actions mọi mutation, revalidatePath hợp lý.
- API Routes chỉ cho webhook / import dài.
- File ≤ 300 dòng; tách component nếu > 200 dòng JSX.

---

## 4. DATABASE SCHEMA

```sql
-- ============ Tenancy ============
create table organizations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  created_at timestamptz default now()
);

create table org_members (
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text check (role in ('owner','admin','member','viewer')) not null default 'member',
  joined_at timestamptz default now(),
  primary key (org_id, user_id)
);

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  icon text,
  color text,
  framework_template_id uuid,
  visibility text check (visibility in ('private','public-readonly')) default 'private',
  created_at timestamptz default now(),
  unique (owner_user_id, slug)
);

-- ============ Framework Template (shared) ============
create table framework_templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  domain text,
  author_kind text check (author_kind in ('system','community')) default 'system',
  author_user_id uuid,
  is_published boolean default true,
  forks_count int default 0,
  payload jsonb not null,           -- full snapshot incl. learning path
  version text default '1.0.0',
  created_at timestamptz default now()
);

-- ============ Competency Matrix (Trục A) ============
create table skill_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  name text not null,
  slug text not null,
  description text,
  color text,
  icon text,
  display_order int default 0,
  unique (workspace_id, slug)
);

create table skills (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  category_id uuid references skill_categories(id) on delete cascade not null,
  name text not null,
  slug text not null,
  description text,
  tags text[] default '{}',
  display_order int default 0,
  created_at timestamptz default now(),
  unique (workspace_id, slug)
);

create table competency_levels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  code text not null,               -- 'XS','S','M','L'
  label text not null,
  numeric_value int not null,
  description text,
  examples text,
  color text,
  display_order int default 0,
  unique (workspace_id, code)
);

create table user_skill_progress (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  skill_id uuid references skills(id) on delete cascade not null,
  level_code text,
  level_source text check (level_source in ('self_claimed','learned','both')) default 'self_claimed',
  note_md text,
  evidence_urls text[] default '{}',
  why_this_level text,
  target_level_code text,
  crowns int default 0,             -- 0..5
  updated_at timestamptz default now(),
  unique (workspace_id, user_id, skill_id)
);

-- ============ Learning Path (Trục B) ============
-- Each level (XS/S/M/L) has its own track of weeks
create table level_tracks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  level_code text not null,         -- 'XS','S','M','L'
  title text not null,              -- 'Foundational Track'
  description text,
  display_order int default 0,
  unique (workspace_id, level_code)
);

create table weeks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  track_id uuid references level_tracks(id) on delete cascade not null,
  week_index int not null,          -- 1..12 within a track
  title text not null,
  summary text,
  goals text[] default '{}',
  keywords text[] default '{}',
  est_hours int default 8,
  display_order int default 0,
  unique (workspace_id, track_id, week_index)
);

create table modules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  week_id uuid references weeks(id) on delete cascade not null,
  title text not null,
  summary text,
  display_order int default 0
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  module_id uuid references modules(id) on delete cascade not null,
  slug text not null,
  title text not null,
  intro_md text,                    -- short intro before exercises
  est_minutes int default 8,
  display_order int default 0,
  unique (workspace_id, module_id, slug)
);

-- Link lesson ↔ skills (which skills this lesson advances)
create table lesson_skill_map (
  lesson_id uuid references lessons(id) on delete cascade not null,
  skill_id uuid references skills(id) on delete cascade not null,
  contributes_to_level text not null,  -- which level this lesson contributes to
  weight int default 1,
  primary key (lesson_id, skill_id)
);

create table exercises (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  lesson_id uuid references lessons(id) on delete cascade not null,
  kind text check (kind in ('mcq','mcq_multi','fill_blank','order_steps','type_answer','code_block_review')) not null,
  prompt_md text not null,          -- markdown allowed
  payload jsonb not null,           -- type-specific data
  explanation_md text,              -- shown after answering
  xp_award int default 10,
  display_order int default 0
);

create table user_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  lesson_id uuid references lessons(id) on delete cascade not null,
  status text check (status in ('not_started','in_progress','completed','mastered')) default 'not_started',
  best_score numeric,               -- 0..1
  attempts int default 0,
  completed_at timestamptz,
  last_attempt_at timestamptz,
  unique (workspace_id, user_id, lesson_id)
);

create table user_exercise_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  exercise_id uuid references exercises(id) on delete cascade not null,
  answer jsonb,
  is_correct boolean,
  time_taken_ms int,
  created_at timestamptz default now()
);

create table user_week_progress (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  week_id uuid references weeks(id) on delete cascade not null,
  pct_complete numeric default 0,  -- 0..1
  unlocked boolean default false,
  unlocked_at timestamptz,
  completed_at timestamptz,
  unique (workspace_id, user_id, week_id)
);

create table user_level_progress (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  level_code text not null,
  status text check (status in ('locked','unlocked','completed')) default 'locked',
  unlocked_at timestamptz,
  completed_at timestamptz,
  unique (workspace_id, user_id, level_code)
);

-- ============ Gamification ============
create table xp_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  amount int not null,
  reason text not null,             -- 'exercise_correct','lesson_complete','week_complete','level_complete','daily_streak','first_assessment'
  ref_kind text,
  ref_id uuid,
  created_at timestamptz default now()
);

create table streaks (
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  current_streak int default 0,
  longest_streak int default 0,
  last_active_date date,
  freeze_count int default 0,       -- skip days, like Duolingo streak freeze
  primary key (workspace_id, user_id)
);

create table hearts (
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  current int default 5,
  max int default 5,
  next_refill_at timestamptz,
  primary key (workspace_id, user_id)
);

create table badges (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  slug text not null,
  name text not null,
  description text,
  icon text,
  rule jsonb,                       -- machine-evaluable rule
  unique (workspace_id, slug)
);

create table user_badges (
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  badge_id uuid references badges(id) on delete cascade not null,
  granted_at timestamptz default now(),
  primary key (workspace_id, user_id, badge_id)
);

-- ============ Notes / Activity ============
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  kind text not null,
  payload jsonb,
  created_at timestamptz default now()
);

-- ============ DESIGN-ONLY (schema only) ============
create table review_schedules (        -- SM-2 spaced repetition (future)
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  ref_kind text check (ref_kind in ('exercise','lesson','skill')),
  ref_id uuid not null,
  ease_factor numeric default 2.5,
  interval_days int default 1,
  due_at timestamptz,
  last_reviewed_at timestamptz
);

create table leagues (                 -- future
  id uuid primary key default gen_random_uuid(),
  tier text check (tier in ('bronze','silver','gold','sapphire','ruby','emerald','diamond','obsidian')),
  week_start date,
  week_end date
);

create table export_jobs (             -- future
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  format text check (format in ('pdf','xlsx','json')),
  status text default 'queued',
  file_url text,
  error text,
  created_at timestamptz default now()
);

-- ============ Indices ============
create index on skills (workspace_id, category_id);
create index on user_skill_progress (workspace_id, user_id);
create index on user_lesson_progress (workspace_id, user_id);
create index on user_exercise_attempts (workspace_id, user_id, created_at desc);
create index on xp_events (workspace_id, user_id, created_at desc);
create index on weeks (workspace_id, track_id, week_index);

-- ============ RLS (enable + policy) ============
-- Mọi bảng owner-scoped: user chỉ truy cập rows thuộc workspace mình sở hữu.
-- Code RLS đầy đủ cho: workspaces, skills, user_skill_progress, lessons, exercises,
-- user_lesson_progress, user_exercise_attempts, xp_events, streaks, hearts, user_badges, activity_log.
```

---

## 5. EXERCISE PAYLOAD SCHEMAS — Bắt buộc tuân thủ

Mỗi `exercises.payload` JSON là type-specific. Claude phải Zod-validate:

### `mcq`
```jsonc
{
  "options": [
    { "id": "a", "text": "Option A" },
    { "id": "b", "text": "Option B" },
    { "id": "c", "text": "Option C" },
    { "id": "d", "text": "Option D" }
  ],
  "correctId": "b",
  "shuffle": true
}
```

### `mcq_multi`
```jsonc
{
  "options": [ /* same as mcq */ ],
  "correctIds": ["a", "c"],
  "shuffle": true
}
```

### `fill_blank`
```jsonc
{
  "template": "Trong Terraform, để khoá state ta dùng ___ + ___ làm backend.",
  "blanks": [
    { "id": 1, "accepts": ["S3", "s3"], "matchKind": "exact_ci" },
    { "id": 2, "accepts": ["DynamoDB", "dynamodb"], "matchKind": "exact_ci" }
  ]
}
```

### `order_steps`
```jsonc
{
  "steps": [
    { "id": "1", "text": "terraform init" },
    { "id": "2", "text": "terraform validate" },
    { "id": "3", "text": "terraform plan" },
    { "id": "4", "text": "terraform apply" }
  ],
  "correctOrder": ["1","2","3","4"]
}
```

### `type_answer`
```jsonc
{
  "accepts": [ "^kubectl get pods( -n \\w+)?$" ],
  "matchKind": "regex",
  "hint": "Lệnh kubectl liệt kê pods..."
}
```

### `code_block_review` (highlight + multiple-choice combo)
```jsonc
{
  "code": "resource \"aws_s3_bucket\" \"b\" { bucket = \"my-bucket\" acl = \"public-read\" }",
  "language": "hcl",
  "question": "Vấn đề bảo mật ở đâu?",
  "options": [/* mcq style */],
  "correctId": "b"
}
```

---

## 6. FRAMEWORK TEMPLATE PAYLOAD (full schema cho seed JSON)

```jsonc
{
  "schemaVersion": "2.0",
  "slug": "devops",
  "name": "DevOps Mastery",
  "domain": "engineering",
  "description": "...",
  "icon": "Cloud",
  "color": "#22D3EE",

  "levels": [
    { "code": "XS", "label": "Foundational", "numeric": 0,   "description": "...", "examples": "..." },
    { "code": "S",  "label": "Working",      "numeric": 33,  "description": "...", "examples": "..." },
    { "code": "M",  "label": "Strong",       "numeric": 66,  "description": "...", "examples": "..." },
    { "code": "L",  "label": "Expert",       "numeric": 100, "description": "...", "examples": "..." }
  ],

  "categories": [
    {
      "slug": "aws",
      "name": "AWS",
      "color": "#FF9900",
      "icon": "Cloud",
      "skills": [
        { "slug": "iam-deep", "name": "IAM Deep", "tags": ["security","aws"] },
        { "slug": "vpc-network", "name": "VPC Networking" }
      ]
    }
    /* … */
  ],

  "tracks": [
    {
      "levelCode": "XS",
      "title": "Foundational Track",
      "description": "Build your DevOps base.",
      "weeks": [
        {
          "index": 1,
          "title": "Setup, AWS Foundations, IAM Deep Dive",
          "summary": "Tuần 1 — môi trường, IAM cơ bản",
          "goals": ["AWS account hygiene", "IAM policy fluent"],
          "keywords": ["IAM","SCP","Permission Boundary"],
          "estHours": 8,
          "modules": [
            {
              "title": "AWS Account Hygiene",
              "lessons": [
                {
                  "slug": "iam-identity-center",
                  "title": "IAM Identity Center & MFA",
                  "introMd": "Trong lesson này...",
                  "estMinutes": 7,
                  "skillsAdvanced": [
                    { "skillSlug": "iam-deep", "contributesToLevel": "XS", "weight": 1 }
                  ],
                  "exercises": [
                    {
                      "kind": "mcq",
                      "promptMd": "Đâu là cách quản lý user khuyến nghị 2026?",
                      "payload": {
                        "options": [
                          { "id":"a","text":"Tạo IAM Users cho dev" },
                          { "id":"b","text":"IAM Identity Center + SSO" },
                          { "id":"c","text":"Dùng root account" },
                          { "id":"d","text":"Access keys cho team" }
                        ],
                        "correctId":"b",
                        "shuffle": true
                      },
                      "explanationMd": "IAM Identity Center cho phép quản lý tập trung qua SSO, không cần long-lived credentials.",
                      "xpAward": 10
                    }
                    /* … 3–7 exercises per lesson */
                  ]
                }
                /* … 2–4 lessons per module */
              ]
            }
            /* … 2–4 modules per week */
          ]
        }
        /* … 12 weeks per track */
      ]
    }
    /* … XS/S/M/L tracks */
  ],

  "badges": [
    { "slug":"first-lesson","name":"First Step","description":"Hoàn thành lesson đầu tiên","icon":"Footprints","rule":{"kind":"lesson_count","value":1} },
    { "slug":"7-day-streak","name":"On Fire","description":"7 ngày liên tiếp","icon":"Flame","rule":{"kind":"streak","value":7} }
    /* … 10 badges */
  ]
}
```

**Lưu ý quan trọng cho Claude:**
- File seed thực tế (`drizzle/seeds/devops.json`) cần generate cho **48 weeks**, mỗi week ≥ 2 modules × 2–4 lessons × 3–7 exercises = **~30 exercises/week × 48 = ~1400 exercises**.
- Claude **không cần tự nghĩ 1400 exercises**: cho seed file MVP đủ **Level XS 12 weeks đầy đủ** (~360 exercises), Level S/M/L để **stub mỗi tuần 1 lesson 3 exercises** (cấu trúc đủ, content tối thiểu) với note `// TODO: expand content` trong seed JSON.
- Nội dung exercise lấy từ 5 file `0X_*.md` (đã đính kèm trong context).

---

## 7. CẤU TRÚC FOLDER

```
mastery-grid/
├── src/
│   ├── app/
│   │   ├── (marketing)/
│   │   │   ├── page.tsx               # landing
│   │   │   └── templates/page.tsx
│   │   ├── (auth)/
│   │   │   ├── sign-in/page.tsx
│   │   │   └── callback/route.ts
│   │   ├── (app)/
│   │   │   ├── layout.tsx
│   │   │   ├── onboarding/page.tsx
│   │   │   ├── profile/page.tsx
│   │   │   ├── settings/page.tsx
│   │   │   └── w/[slug]/
│   │   │       ├── layout.tsx         # workspace context provider
│   │   │       ├── page.tsx           # Dashboard
│   │   │       ├── skills/
│   │   │       │   └── page.tsx
│   │   │       ├── framework/
│   │   │       │   └── page.tsx
│   │   │       └── learn/
│   │   │           ├── page.tsx       # Course Map (Duolingo path)
│   │   │           └── [levelCode]/
│   │   │               └── [weekIndex]/
│   │   │                   ├── page.tsx        # Week Detail
│   │   │                   └── [lessonSlug]/
│   │   │                       └── page.tsx    # Lesson Runner
│   │   └── api/
│   │       └── import/sheets/route.ts
│   ├── components/
│   │   ├── ui/                          # shadcn
│   │   ├── charts/
│   │   ├── skills/
│   │   ├── framework/
│   │   ├── learn/
│   │   │   ├── course-path.tsx          # Duolingo curved node graph (SVG)
│   │   │   ├── week-node.tsx
│   │   │   ├── lesson-card.tsx
│   │   │   ├── progress-bar-thin.tsx
│   │   │   └── exercise-runner/
│   │   │       ├── runner.tsx           # state machine
│   │   │       ├── mcq.tsx
│   │   │       ├── mcq-multi.tsx
│   │   │       ├── fill-blank.tsx
│   │   │       ├── order-steps.tsx
│   │   │       ├── type-answer.tsx
│   │   │       ├── code-block-review.tsx
│   │   │       ├── feedback-card.tsx
│   │   │       └── end-screen.tsx
│   │   ├── gamification/
│   │   │   ├── hearts-pill.tsx
│   │   │   ├── streak-flame.tsx
│   │   │   ├── xp-counter.tsx
│   │   │   ├── crown-row.tsx
│   │   │   ├── badge-toast.tsx
│   │   │   └── confetti.tsx
│   │   ├── workspace/
│   │   │   ├── workspace-switcher.tsx
│   │   │   └── new-workspace-modal.tsx
│   │   ├── templates/
│   │   │   └── template-card.tsx
│   │   └── layout/
│   │       ├── app-sidebar.tsx
│   │       ├── bottom-tabbar.tsx       # mobile
│   │       ├── topbar.tsx
│   │       ├── command-palette.tsx
│   │       └── theme-provider.tsx
│   ├── lib/
│   │   ├── db/{ client, schema, scoped }.ts
│   │   ├── auth/{ supabase-server, supabase-client }.ts
│   │   ├── framework/
│   │   │   ├── fork-template.ts
│   │   │   ├── parse-csv.ts
│   │   │   ├── parse-payload.ts
│   │   │   └── diff-import.ts
│   │   ├── learn/
│   │   │   ├── exercise-evaluator.ts    # check answer per kind
│   │   │   ├── unlock-rules.ts          # week/level unlock
│   │   │   └── xp-calculator.ts
│   │   ├── gamification/
│   │   │   ├── streak.ts
│   │   │   ├── hearts.ts
│   │   │   └── badge-evaluator.ts
│   │   ├── workspace.ts
│   │   └── utils.ts
│   ├── actions/
│   │   ├── workspaces.ts
│   │   ├── templates.ts
│   │   ├── categories.ts
│   │   ├── skills.ts
│   │   ├── levels.ts
│   │   ├── assessments.ts
│   │   ├── imports.ts
│   │   ├── learn.ts                     # startLesson, submitExercise, completeLesson
│   │   └── gamification.ts              # tickStreak, spendHeart, awardXp, evaluateBadges
│   ├── hooks/
│   │   ├── use-workspace.ts
│   │   ├── use-keyboard-shortcuts.ts
│   │   └── use-lesson-runner.ts
│   └── styles/globals.css
├── drizzle/
│   ├── migrations/
│   ├── seed.ts
│   └── seeds/
│       ├── devops.json                  # full payload
│       └── README.md
├── tests/
│   ├── unit/
│   │   ├── parse-csv.test.ts
│   │   ├── exercise-evaluator.test.ts
│   │   ├── unlock-rules.test.ts
│   │   ├── xp-calculator.test.ts
│   │   └── badge-evaluator.test.ts
│   └── e2e/
│       └── smoke.spec.ts                # sign-in → fork → start lesson → finish 1 lesson
├── public/
│   ├── lottie/{streak.json, level-up.json}
│   └── sounds/{correct.mp3, wrong.mp3, ding.mp3}
├── .env.example
├── DESIGN_FUTURE.md
├── README.md
├── package.json
└── tsconfig.json
```

---

## 8. UI/UX STANDARDS — bắt buộc

### Design tokens

```css
--bg-base:#0A0C10;  --bg-elevated:#11141A;  --bg-surface:#161A22;
--bg-hover:#1B2029; --border:#242A33;       --border-strong:#2E3540;

--text-primary:#E6E8EC;   --text-secondary:#9BA1AA;   --text-tertiary:#6B7280;

--accent-from:#22D3EE;  --accent-to:#8B5CF6;
--success:#22C55E; --warning:#F59E0B; --danger:#EF4444;

--lvl-XS:#64748B; --lvl-S:#0EA5E9; --lvl-M:#10B981; --lvl-L:#8B5CF6;

--xp:#F59E0B;        /* amber for XP */
--streak:#F97316;    /* orange flame */
--heart:#EF4444;     /* red heart */
--crown-bronze:#B87333; --crown-silver:#C0C0C0; --crown-gold:#FFD700;
--crown-platinum:#E5E4E2; --crown-diamond:#B9F2FF;
```

- **Radius:** card `rounded-2xl`; lesson node `rounded-full` lớn (Duolingo bubble); button `rounded-xl`.
- **Font:** Geist Sans + Geist Mono. Lesson runner dùng `text-lg` cho prompt, `text-base` cho options.

### Course Map (Duolingo path) — chi tiết visual

- SVG layout dạng "snake curve": 12 nodes per track, lệch trái-phải dọc theo curve.
- Node states:
  - **Locked** (xám, icon lock).
  - **Unlocked** (gradient accent, idle pulse animation).
  - **In-progress** (ring progress).
  - **Completed** (gradient + check, gold ring nếu mastered).
- Section header (Level): banner full-width gradient với tên level + progress bar.
- Click unlocked node → tooltip "Start Week X" → button "Start".
- Idle: floating mascot (lottie) nhỏ ở góc, nháy mắt mỗi 5s.

### Lesson Runner — Duolingo feel

- Topbar mảnh: ❌ close button (left), progress bar (center), heart counter (right).
- Body trung tâm:
  - Prompt typography lớn `text-2xl`.
  - Options spacing thoáng, hover ring, selected ring + bg accent/10.
- Footer:
  - "Check" button full-width gradient. Disable khi chưa chọn.
  - Sau "Check": feedback panel slide up từ dưới — màu xanh nếu đúng, đỏ nếu sai — kèm `explanation_md`. Nút đổi thành "Continue".
- Audio (tùy chọn off): "ding" khi đúng, "buzz" khi sai.
- End screen:
  - Confetti.
  - "+30 XP" count-up animation.
  - Hearts remaining.
  - Streak update.
  - Crown earned (nếu hoàn thành mastered).
  - 2 buttons: "Continue" (next lesson) | "Back to map".

### Micro-interactions

- Tap option: scale 0.97 active.
- Check correct: green flash + lottie checkmark + sound (toggle).
- Check wrong: red shake (3 frames) + sound.
- Streak day-up: flame size pulse + brief banner "Streak +1 → 8 days".
- Level up: full screen takeover 1.2s với gradient + confetti + "Level S unlocked".
- Crown grant: small crown icon zoom-in next to skill name in skill drawer.

### Keyboard shortcuts (desktop)

| Phím | Hành động |
|---|---|
| `cmd+k` | Command palette |
| `g d` / `g s` / `g l` / `g f` | Goto Dashboard / Skills / Learn / Framework |
| `1–9` | Chọn option trong mcq |
| `enter` | Check / Continue |
| `esc` | Quit lesson (confirm) |
| `space` | Pause lesson (save state) |

### Empty states
- Mỗi page có illustration line-art + CTA. Course Map empty: mascot lottie + "Fork a framework to start learning".

### Accessibility
- Contrast AA, focus ring rõ.
- Exercise có alt-mode "Reduce motion" + "Disable audio" trong Settings.
- Sound: opt-in, default off.

### Mobile
- Course Map: scroll dọc, swipe trái-phải để chuyển level.
- Lesson Runner: full-screen, bottom-sheet feedback.
- Bottom tab bar: Home / Learn / Skills / Profile.
- Touch target ≥ 44px.

---

## 9. PAGES — Acceptance Criteria

### `/` (landing)
- Hero + tagline + CTA "Get started".
- 3 value props: "Measure", "Learn", "Master".
- Strip frameworks: DevOps (active) + 4 coming soon cards.

### `/templates`
- Grid card đẹp. Filter by domain. Card click → preview modal → "Fork".

### `/onboarding`
- Step 1 welcome.
- Step 2 pick framework.
- Step 3 name workspace + slug auto.
- Step 4 loading → success → `/w/[slug]`.

### `/w/[slug]` (Dashboard)
- [ ] Header workspace (icon, name, level current).
- [ ] **Today block:** "Continue learning" card hiển thị week & lesson tiếp theo + CTA.
- [ ] Radar coverage chart.
- [ ] Heat map skills.
- [ ] Progress ring (overall %).
- [ ] XP today + Streak flame + Hearts.
- [ ] Top 5 weakest skills.
- [ ] Recent activity (lesson done, level set, badge earned).
- [ ] Empty: CTA "Start your first lesson".

### `/w/[slug]/skills`
- (Như spec phiên bản trước — Skills Matrix dày.)
- Thêm cột **Crowns** (0–5 hiển thị icon nhỏ).
- Thêm filter "Source": learned / self-claimed / both.

### Skill Drawer
- (Như spec trước) + thêm section **"Lessons that advance this skill"** list lessons với progress + button "Practice".

### `/w/[slug]/framework`
- (Như spec trước — Categories / Skills / Levels CRUD + Import/Export.)
- Thêm tab **"Learning Path"** (read-only view của tracks/weeks/modules/lessons; chỉnh trong MVP = manage qua re-import seed; editor full để DESIGN_FUTURE).

### `/w/[slug]/learn` (Course Map — flagship)
- [ ] Header: total progress bar across 4 levels + total XP + streak + hearts.
- [ ] 4 sections vertical (XS → L), mỗi section là banner gradient + curve path 12 nodes.
- [ ] Node Duolingo-style:
  - Locked (gray + lock icon).
  - Active (accent gradient, pulsing ring, scale up khi hover).
  - Completed (green check, gold ring nếu mastered).
- [ ] Click active node → mini popover "Week X: Title" + button "Start".
- [ ] Section header collapse (default expanded current level, others collapsed).
- [ ] Mascot lottie idle ở góc dưới phải (toggle in settings).

### `/w/[slug]/learn/[levelCode]/[weekIndex]` (Week Detail)
- [ ] Hero: Week title, summary, goals (list), keywords (chips), est hours.
- [ ] Progress bar tuần (% lessons completed).
- [ ] Modules list (collapsible):
  - Each module: title + summary.
  - Lessons list under: title, est minutes, status icon, "Start" / "Continue" / "Review" button.
- [ ] Sidebar right (desktop only): "Skills you'll advance" — list skills + level contribution.
- [ ] Back button to map.

### `/w/[slug]/learn/[levelCode]/[weekIndex]/[lessonSlug]` (Lesson Runner) — **most important page**
- [ ] Full-screen takeover (sidebar hide).
- [ ] Topbar: close (X) + progress bar (mảnh) + hearts pill.
- [ ] **Intro screen** (5s, skippable):
  - Lesson title.
  - `intro_md` rendered.
  - Skills advanced (chips).
  - "Begin" button.
- [ ] **Exercise screens** (one at a time):
  - Render component theo `kind`.
  - Disable "Check" cho đến khi user trả lời.
  - "Check" → evaluator → feedback panel slide up.
  - Feedback: ✅/❌ + explanation_md + button "Continue".
  - Wrong answer: -1 heart (animation), add to "to-review queue" cuối lesson.
- [ ] **To-review queue:** sau hết exercise lần 1, replay các câu sai.
- [ ] **End screen:**
  - Confetti.
  - "+X XP" animated.
  - Streak status.
  - Crown earned (nếu pass 100%).
  - Badges newly granted (toast).
  - Skills advanced summary.
  - 2 buttons: "Next lesson" / "Back to week".
- [ ] **Out-of-hearts modal** khi hết hearts: 3 options "Practice (no XP)" / "Wait for refill" / (future) "Watch ad for heart".

### `/profile`
- Avatar, display name, target role, target date.
- Workspaces owned.
- Total XP all-time + per workspace.
- Streak history calendar (heatmap).
- Badges earned grid.
- Download data.

### `/settings`
- Theme.
- Language.
- Sound toggle.
- Reduced motion toggle.
- Daily learning goal (XP target 30/60/120/300).
- Hearts unlimited (debug; OFF in prod).
- Danger zone.

---

## 10. SERVER ACTIONS — signatures

```ts
// src/actions/workspaces.ts
export async function listMyWorkspaces(): Promise<WorkspaceSummary[]>;
export async function createWorkspaceFromTemplate(input): Promise<{ workspaceId: string; slug: string }>;
export async function deleteWorkspace(workspaceId: string): Promise<void>;

// src/actions/templates.ts
export async function listTemplates(filters?): Promise<TemplateCard[]>;
export async function getTemplate(templateId: string): Promise<TemplateDetail>;

// src/actions/skills.ts
export async function listSkills(workspaceId, filters): Promise<SkillRow[]>;
export async function getSkill(workspaceId, skillId): Promise<SkillDetail>;
export async function bulkSetLevel(workspaceId, skillIds, levelCode): Promise<void>;

// src/actions/assessments.ts
export async function updateAssessment(input): Promise<void>;

// src/actions/learn.ts
export async function getCourseMap(workspaceId: string): Promise<CourseMap>;
export async function getWeekDetail(workspaceId, levelCode, weekIndex): Promise<WeekDetail>;
export async function startLesson(workspaceId, lessonId): Promise<LessonRunData>;
export async function submitExercise(input: {
  workspaceId: string;
  lessonId: string;
  exerciseId: string;
  answer: unknown;
  timeTakenMs: number;
}): Promise<{
  isCorrect: boolean;
  explanationMd: string;
  xpAwarded: number;
  heartsLeft: number;
}>;
export async function completeLesson(input: {
  workspaceId: string;
  lessonId: string;
  scorePct: number;
}): Promise<{
  xpAwarded: number;
  streakUpdated: boolean;
  newStreak: number;
  badgesEarned: BadgeAwarded[];
  crownEarned: boolean;
  skillsAdvanced: SkillAdvance[];
  weekCompleted: boolean;
  levelCompleted: boolean;
}>;

// src/actions/gamification.ts
export async function getDailyStatus(workspaceId): Promise<{
  xpToday: number;
  goalXp: number;
  currentStreak: number;
  hearts: number;
  nextRefillIn: number;
}>;
export async function refillHeart(workspaceId): Promise<void>;
```

**Quy tắc:** mọi action validate `workspaceId` thuộc user; log `activity_log`; revalidate path tương ứng.

---

## 11. UNLOCK RULES — chi tiết

```ts
// src/lib/learn/unlock-rules.ts

// Week unlock:
//   Week 1 of each Level: always unlocked when Level unlocked
//   Week N (N>1): unlocked when (N-1) reach pct_complete >= 0.8
//
// Level unlock:
//   XS: always unlocked
//   S: unlocked when XS user_level_progress.status = 'completed'
//      (completed = all 12 weeks pct_complete >= 0.8)
//   M: same dependency on S
//   L: same dependency on M
//
// Lesson order: lessons within a module ordered by display_order.
// User can replay any unlocked lesson for practice (no XP if already mastered).

// Mastered lesson:
//   First completion pct >= 1.0 → 'mastered' (gold ring).
//   Otherwise 'completed' (green check).
```

---

## 12. XP RULES

| Action | XP |
|---|---|
| Exercise correct (first try) | +10 |
| Exercise correct after retry | +5 |
| Lesson completed | +20 bonus |
| Lesson mastered (100% no mistake) | +30 bonus |
| Week completed (≥80% lessons) | +100 |
| Level completed | +500 |
| Daily streak day +1 | +5 (auto on first lesson of day) |
| Streak milestone (7/14/30/100 days) | +50 / +100 / +300 / +1000 |
| Badge earned | +25 |
| First-time assessment skill | +5 (one-time per skill) |

---

## 13. BADGES (seed 10)

```jsonc
[
  { "slug":"first-step",       "name":"First Step",       "rule":{"kind":"lesson_completed","value":1} },
  { "slug":"committed",        "name":"Committed",        "rule":{"kind":"lesson_completed","value":10} },
  { "slug":"week-warrior",     "name":"Week Warrior",     "rule":{"kind":"week_completed","value":1} },
  { "slug":"level-up-xs",      "name":"Foundational",     "rule":{"kind":"level_completed","value":"XS"} },
  { "slug":"streak-7",         "name":"On Fire",          "rule":{"kind":"streak","value":7} },
  { "slug":"streak-30",        "name":"Unstoppable",      "rule":{"kind":"streak","value":30} },
  { "slug":"crown-collector",  "name":"Crown Collector",  "rule":{"kind":"crowns_total","value":10} },
  { "slug":"aws-foundational", "name":"AWS Foundational", "rule":{"kind":"category_level","category":"aws","level":"S"} },
  { "slug":"matrix-master",    "name":"Matrix Master",    "rule":{"kind":"all_skills_assessed"} },
  { "slug":"100k-xp",          "name":"XP Centurion",     "rule":{"kind":"total_xp","value":100000} }
]
```

Badge evaluator chạy server-side sau `completeLesson` + `updateAssessment`.

---

## 14. SEED DATA STRATEGY

- File `drizzle/seeds/devops.json` chứa full payload.
- Categories + Skills lấy từ **Tab 1** (Claude tự generate từ Sheet CSV người dùng cung cấp, hoặc fallback dùng list trong `01_DEVOPS_12MONTH_ROADMAP_SUMMARY.md`).
- Levels từ **Tab 2**.
- Tracks/Weeks/Modules/Lessons/Exercises:
  - **Level XS** (12 weeks): chi tiết — mỗi week 3 modules × 3 lessons × 4 exercises = ~108 lessons, ~432 exercises. **Claude generate đầy đủ.**
  - **Level S** (12 weeks): mỗi week 1 module × 2 lessons × 3 exercises = stub đủ cấu trúc. Claude generate **tối thiểu**, kèm comment `"_todo": "expand from roadmap file"`.
  - **Level M / L:** stub mỗi week 1 lesson 3 exercises.

> Để cân bằng MVP scope: **chỉ Level XS đầy đủ**. Khi user vào Learn, Level S/M/L vẫn locked đến khi XS hoàn thành — nên content stub cũng OK ở MVP.

---

## 15. README & DESIGN_FUTURE.md — yêu cầu

### README.md
1. Tagline + screenshot placeholders (Course Map + Lesson Runner).
2. Tính năng MVP bullets.
3. Setup local (Node 20+, pnpm 9+, env, db:push, db:seed, dev).
4. Cách thêm framework mới (chỉ thêm 1 JSON seed).
5. Cách extend exercise type mới (5 step: schema → evaluator → React component → register → seed).
6. Tech stack table.
7. Folder structure.
8. Inspiration credits.
9. License (MIT).

### DESIGN_FUTURE.md — 10 sections
1. Multi-tenant Org/Team.
2. Export PDF/Excel.
3. Spaced repetition (SM-2 thuật toán).
4. League / Leaderboard.
5. AI Tutor chat (giải thích khi sai).
6. Public sharing read-only.
7. Community templates publish.
8. Code-challenge exercise type.
9. Real-lab integration.
10. Mobile native (Expo).

---

## 16. BUILD ORDER — 16 STEPS

Mỗi step **một message duy nhất**, dừng chờ "next".

| Step | Tên | Deliverable |
|---|---|---|
| 0 | Docs skeleton | README + DESIGN_FUTURE + .env.example + ADR-001 (2-axis model) |
| 1 | DB schema + migrations + RLS | Drizzle schema file + SQL migration + 6 RLS policy mẫu |
| 2 | Seed system template "devops" | `drizzle/seeds/devops.json` (Level XS đầy đủ + S/M/L stub) + `drizzle/seed.ts` |
| 3 | Auth + workspace context | Supabase server/client + `requireWorkspaceAccess` + sign-in page |
| 4 | Layout + theme + sidebar + bottom tab bar | App shell, dark default, workspace switcher, command palette stub |
| 5 | Templates catalog + Onboarding + Fork action | `/templates`, fork, `/onboarding` |
| 6 | Skills Matrix table | Filter / search / virtualized / inline edit / bulk |
| 7 | Skill Drawer | Rubric + assessment form + auto-save + "Lessons that advance" section |
| 8 | Framework Editor tabs | Categories / Skills / Levels CRUD + Import/Export JSON |
| 9 | Course Map page (Duolingo path) | SVG curve, week nodes, locked/unlocked states |
| 10 | Week Detail page | Modules collapsible + lesson list + sidebar skills |
| 11 | Lesson Runner — core state machine + 3 exercise types (mcq, mcq_multi, fill_blank) | Full runner + feedback + end screen |
| 12 | Remaining exercise types (order_steps, type_answer, code_block_review) + To-review queue | |
| 13 | Gamification (XP, streak, hearts, crowns, badges) + Daily status header chip | Server actions + UI |
| 14 | Dashboard charts + Today block + Recent activity | |
| 15 | Profile + Settings + Roadmap placeholder | |
| 16 | Tests + CI + Polish | Vitest, Playwright smoke, GH Actions, polish empty states, mobile, sounds, lottie, performance audit |

Format mỗi step:

```
## Step N — <title>
**Goal:** ...
**Files:** ...
**Code:** <full contents per file>
**Verify:** commands + expected outcome
**Notes/Assumptions:** [ASSUMPTION] when guessing
**Next step preview:** ...
```

Không dump 20 file 1 lần. Không `// TODO` ngoài seed stub.

---

## 17. TESTING minimum

- **Unit:**
  - `exercise-evaluator.test.ts` — 6 kind × happy + 3 edge each.
  - `unlock-rules.test.ts` — week/level unlock matrix.
  - `xp-calculator.test.ts` — accumulator correctness.
  - `badge-evaluator.test.ts` — 10 badges triggered correctly.
  - `streak.test.ts` — DST, timezone, freeze.
- **E2E (Playwright smoke):**
  - Mocked sign-in → fork DevOps → open Course Map → click Week 1 → start first lesson → answer 3 exercises (1 wrong) → end screen → XP > 0, hearts < 5, streak = 1.

---

## 18. DEFINITION OF DONE — MVP

- [ ] `pnpm dev` chạy, sign-in được.
- [ ] User mới fork DevOps template → có data: 10 categories, ~150 skills, 12 weeks Level XS đầy đủ.
- [ ] Skills Matrix list + filter + drawer + assess.
- [ ] Course Map render đúng tất cả Level + nodes; lock/unlock logic chính xác.
- [ ] Lesson Runner chạy 5 exercise types không bug.
- [ ] XP / streak / hearts / crowns / badges hoạt động.
- [ ] Dashboard hiển thị radar / heatmap / today block / activity.
- [ ] Mobile responsive đầy đủ; touch target ≥ 44px; bottom tab bar.
- [ ] Sound + reduced-motion toggle.
- [ ] Lighthouse ≥ 90 (Perf, A11y, Best Practices).
- [ ] DESIGN_FUTURE.md đủ 10 mục.
- [ ] Smoke E2E pass.
- [ ] 0 `any`, 0 console errors.

---

## 19. NGUYÊN TẮC KHI UNCLEAR

- Được phép giả định, gắn `[ASSUMPTION]`.
- Khi UI mơ hồ → Linear/Duolingo aesthetic.
- Khi schema mơ hồ → normalize đủ, ưu tiên type-safety > flexibility.
- Không hỏi user > 2 câu / step.

---

## 20. PHỤ LỤC

### XP table cheat-sheet
| Action | XP |
|---|---|
| Exercise đúng | 10 |
| Exercise đúng (retry) | 5 |
| Lesson done | +20 |
| Lesson mastered | +30 |
| Week done | +100 |
| Level done | +500 |
| Streak day | +5 |
| Streak 7d | +50 |
| Streak 30d | +300 |
| Badge | +25 |

### Crown thresholds
- 0 crown: chưa hoàn thành lesson nào của skill.
- 1: ≥ 1 lesson "completed".
- 2: ≥ 50% lessons "completed".
- 3: 100% lessons "completed".
- 4: ≥ 50% lessons "mastered".
- 5: 100% lessons "mastered".

### Heart logic
- Start 5/5.
- Wrong exercise: -1.
- Refill 1 per 4 hours (cron-less: compute on read).
- 0 hearts: redirect to "Practice mode" (no XP) or wait.
- Future: unlimited via streak freeze / ads / pro.

### Inspiration repos cho Claude khi cần
- stride-so/matrix (cấu trúc matrix data)
- henfrydls/Skima (assessment UI)
- kamranahmedse/developer-roadmap (template gallery + fork concept)
- vercel/next-learn (lesson runner pattern)

---

**START NOW with Step 0.** Không hỏi xác nhận — vào việc.

=== END PROMPT ===

---

## 📌 Ghi chú cho bạn (không paste cho AI)

### Vì sao bản này mạnh hơn 2 bản trước

1. **2-axis mental model** chính thức: Competency Matrix × Learning Path. Mọi feature gắn vào 1 trong 2.
2. **P0/P1 hierarchy first-class:** Level (P0) → Weeks (P1) → Modules → Lessons → Exercises. Đúng yêu cầu của bạn.
3. **Duolingo-style đầy đủ:** Course Map curve path, Lesson Runner, 5 exercise types, hearts, streak, crowns, XP, badges.
4. **Schema gộp đủ 2 trục** + bảng `lesson_skill_map` liên kết 2 trục → khi học xong lesson thì skill cũng tăng level (Learned vs Self-claimed).
5. **Build order 16 steps** + cho phép Level S/M/L stub để MVP không kẹt content.
6. **Framework template payload v2.0** chuẩn để dễ thêm FE/BE/DS sau.
7. **Mobile-first thực sự** (bottom tab bar + touch target + bottom-sheet feedback).
8. **Định nghĩa rõ rule unlock + XP + crown + heart** — không mơ hồ.

### Cách dùng

1. **Chuẩn bị input cho Claude:**
   - 2 CSV export từ Google Sheets.
   - File `01_DEVOPS_12MONTH_ROADMAP_SUMMARY.md` (đính kèm để Claude có content sinh lessons).
   - (Tuỳ chọn) đính kèm 5 file `0X_*.md` để Claude generate exercises chính xác hơn.

2. **Paste prompt** vào Claude Opus 4.7 (context lớn) hoặc Cursor (AI tạo file trực tiếp).

3. **Sau Step 0** — review README/DESIGN_FUTURE skeleton, gõ "next" để Claude vào Step 1 (schema). Đi từ từ từng step.

4. **Khi gặp blocker** (vd: Claude generate seed quá lớn) — yêu cầu Claude giảm scope content (chỉ 4 weeks Level XS thay vì 12) để chạy được trước, rồi mở rộng.

### Nếu prompt vẫn quá dài cho 1 lượt
Cắt làm 2: gửi Sections 0–10 trước (architecture + skills axis), sau khi xong gửi Sections 11–20 (learning axis).

---

**File tại:** `/root/application/devops-roadmap/PROMPT_DEVOPS_MASTERY_WEB_APP.md`

Sẵn sàng paste. Đây là bản cuối cùng — đủ mạnh để Claude/Cursor build ra web app mạnh hơn roadmap.sh + Duolingo cho lĩnh vực DevOps. 🚀
