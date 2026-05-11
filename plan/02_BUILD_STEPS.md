# 🔧 BUILD STEPS — Chi tiết 16 step + status

> Mỗi step ánh xạ 1-1 với section 16 trong `PROMPT_*.md`.
> Cập nhật status khi hoàn thành (✅ done, 🟡 in-progress, ⬜ todo).

---

## Status overview

| Step | Tên | Status | File output chính |
|---|---|---|---|
| 0 | Docs skeleton + ADRs | ✅ done (M0) | README.md, DESIGN_FUTURE.md, plan/* |
| 1 | DB schema + migrations + RLS | ✅ done (M0) | `src/lib/db/schema.ts` |
| 2 | Seed system template "devops" | 🟡 partial (M0) | `drizzle/seeds/devops.json` (minimal) |
| 3 | Auth + workspace context | ✅ done (M0) | `src/lib/auth/*`, `src/lib/workspace.ts` |
| 4 | Layout + theme + sidebar | ✅ done (M0) | `src/app/**/layout.tsx`, sidebar |
| 5 | Templates catalog + Onboarding + Fork | ⬜ todo (M1) | `/templates`, `/onboarding`, fork action |
| 6 | Skills Matrix table + filter/search | ✅ done | `skills/page.tsx` + `skills-table-client.tsx` |
| 7 | Skill Drawer + auto-save assessment | ✅ done | `skill-drawer.tsx` + `actions/assessments.ts` |
| 8 | Framework Editor + Import/Export | 🟡 readonly skeleton (M2) | `framework/page.tsx` |
| 9 | Course Map (Duolingo curved SVG) | ✅ done | `course-path.tsx` + `learn/page.tsx` |
| 10 | Week Detail | ✅ done | `learn/[lvl]/[wk]/page.tsx` |
| 11 | Lesson Runner core + 3 exercise types | ✅ done | `exercise-runner/*` (mcq, fill, type) |
| 12 | Remaining exercise types + review queue | ✅ done | `order-steps`, `code-block-review` + review queue |
| 13 | Gamification (XP + streak + crowns + badges + unlock) | ✅ done | `streak.ts`, `crowns.ts`, `badge-evaluator.ts`, `unlock-rules.ts` |
| 14 | Dashboard charts + Today block | ✅ done | `radar-coverage`, `skill-heatmap`, `progress-ring`, dashboard page |
| 15 | Profile + Settings + Roadmap placeholder | ✅ profile polish + sonner; settings stub | profile/settings pages |
| 16 | Tests + CI + Polish | ⬜ remaining (vitest unit, Playwright smoke, GH Actions) | tests/* |

---

## Detailed checklist per step

### ✅ Step 0 — Docs skeleton
- [x] `README.md` mô tả product + setup local
- [x] `DESIGN_FUTURE.md` 10 sections
- [x] `.env.example`
- [x] `plan/` 4 files
- [x] ADRs trong `01_ARCHITECTURE.md`

### ✅ Step 1 — DB Schema
- [x] `src/lib/db/schema.ts` — Drizzle definitions cho **18 tables**:
  - Tenancy: organizations, org_members, workspaces
  - Templates: framework_templates
  - Matrix: skill_categories, skills, competency_levels, user_skill_progress
  - Learning: level_tracks, weeks, modules, lessons, lesson_skill_map, exercises, user_lesson_progress, user_exercise_attempts, user_week_progress, user_level_progress
  - Gamification: xp_events, streaks, hearts, badges, user_badges
  - Misc: activity_log
  - Future: review_schedules, leagues, export_jobs
- [x] `drizzle.config.ts`
- [x] Migration script in seed.ts

### 🟡 Step 2 — Seed system template "devops" (M0: minimal; M3+ expand)
- [x] `drizzle/seeds/devops.json` — 4 levels (XS/S/M/L) + 10 categories + ~30 skills + Level XS Week 1 đầy đủ (1 module × 2 lessons × 3 exercises) + Week 2..12 stub
- [ ] Expand Level XS đầy đủ 12 weeks × 3 modules × 3 lessons × 4 exercises = ~432 exercises **(M4)**
- [ ] Stub Level S/M/L với 1 lesson/week placeholder **(M4)**

### ✅ Step 3 — Auth + workspace
- [x] `src/lib/auth/supabase-server.ts` — server-side client
- [x] `src/lib/auth/supabase-client.ts` — browser client
- [x] `src/lib/workspace.ts` — `getCurrentWorkspace`, `requireWorkspaceAccess`
- [x] Sign-in page

### ✅ Step 4 — Layout
- [x] Root layout với theme provider (dark default)
- [x] App shell layout với sidebar + topbar
- [x] Workspace context layout
- [x] Sidebar component với nav items

### 🟡 Step 5 — Templates + Onboarding + Fork (M1) — PARTIALLY DONE

**Files done:**
- ✅ `src/actions/workspaces.ts` — `forkTemplate` action (full transaction copying)
- ✅ `src/lib/framework/payload-schema.ts` — Zod validation
- ✅ `src/app/(app)/onboarding/page.tsx` — wired with real fork form

**Files still to create (M1 next):**
- `src/app/(marketing)/templates/page.tsx`
- `src/components/templates/template-card.tsx`
- `src/components/workspace/new-workspace-modal.tsx`

**Logic to implement:**
```ts
// src/actions/workspaces.ts
export async function createWorkspaceFromTemplate({
  templateId, slug, name
}: ForkInput) {
  const tpl = await db.query.frameworkTemplates.findFirst({...});
  const payload = tpl.payload as FrameworkPayload;

  return await db.transaction(async (tx) => {
    const ws = await tx.insert(workspaces).values({...}).returning();
    // Copy levels → categories → skills → tracks → weeks → modules → lessons → exercises
    // Insert lesson_skill_map links
    // Insert badges
    // Init user_level_progress (XS unlocked)
    // Increment forks_count
    // Log activity
    return { workspaceId: ws.id, slug };
  });
}
```

### ⬜ Step 6 — Skills Matrix table (M1)

**Files:**
- `src/app/(app)/w/[slug]/skills/page.tsx` (Server Component fetch)
- `src/components/skills/skills-table.tsx` (TanStack Table)
- `src/components/skills/bulk-edit-bar.tsx`
- `src/actions/skills.ts` — `listSkills, bulkSetLevel`

**Acceptance:**
- Filter Category multi + Level multi.
- Search debounce 200ms.
- Inline level edit (click badge → popover).
- Bulk select → floating action bar.

### ⬜ Step 7 — Skill Drawer (M1)

**Files:**
- `src/components/skills/skill-drawer.tsx` (shadcn Sheet)
- `src/actions/assessments.ts` — `updateAssessment`

**Logic:**
- Auto-save 500ms debounce.
- Markdown preview tab.
- Evidence URLs chip input.

### ⬜ Step 8 — Framework Editor (M2)

**Files:**
- `src/app/(app)/w/[slug]/framework/page.tsx` (Tabs)
- `src/components/framework/category-list.tsx` (dnd-kit reorder)
- `src/components/framework/skill-list.tsx`
- `src/components/framework/level-editor.tsx`
- `src/components/framework/import-panel.tsx`
- `src/actions/categories.ts`, `actions/levels.ts`, `actions/imports.ts`

### ⬜ Step 9 — Course Map (M3) ⭐

**Files:**
- `src/app/(app)/w/[slug]/learn/page.tsx`
- `src/components/learn/course-path.tsx` (SVG curve path)
- `src/components/learn/week-node.tsx`

**Visual reference:** Duolingo path tree (curved nodes lệch trái-phải).

**Implementation hint:**
```tsx
// Generate SVG path string from week positions
function generateCurve(positions: {x:number,y:number}[]) {
  // C cubic bezier between nodes
  // ...
}

<svg viewBox="0 0 600 1200">
  <path d={curve} stroke="..." />
  {weeks.map(w =>
    <WeekNode {...w} status="locked|unlocked|completed|mastered" />
  )}
</svg>
```

### ⬜ Step 10 — Week Detail (M3)

**Files:**
- `src/app/(app)/w/[slug]/learn/[levelCode]/[weekIndex]/page.tsx`

### ⬜ Step 11 — Lesson Runner core (M4) ⭐⭐

**Files:**
- `src/app/(app)/w/[slug]/learn/[levelCode]/[weekIndex]/[lessonSlug]/page.tsx`
- `src/components/learn/exercise-runner/runner.tsx` (state machine + Zustand)
- 3 exercise components: `mcq.tsx`, `mcq-multi.tsx`, `fill-blank.tsx`
- `src/components/learn/exercise-runner/feedback-card.tsx`
- `src/components/learn/exercise-runner/end-screen.tsx`
- `src/actions/learn.ts` — `startLesson, submitExercise, completeLesson`
- `src/lib/learn/exercise-evaluator.ts` (server-side validate per kind)

**State machine** (Zustand store):
```ts
type RunnerState = {
  lessonId: string;
  queue: Exercise[];
  reviewQueue: Exercise[];
  currentIdx: number;
  answers: Record<string, unknown>;
  xpEarned: number;
  heartsLeft: number;
  phase: 'intro' | 'exercise' | 'feedback' | 'review' | 'end';
}
```

### ⬜ Step 12 — Remaining exercise types + review queue (M4)

3 components: `order-steps.tsx`, `type-answer.tsx`, `code-block-review.tsx`.
Implement review queue replaying wrong answers.

### ⬜ Step 13 — Gamification (M5)

**Files:**
- `src/lib/gamification/streak.ts`
- `src/lib/gamification/hearts.ts`
- `src/lib/gamification/badge-evaluator.ts`
- `src/components/gamification/{hearts-pill, streak-flame, xp-counter, crown-row, badge-toast, confetti}.tsx`
- `src/actions/gamification.ts`

### ⬜ Step 14 — Dashboard charts (M5)

**Files:**
- `src/components/charts/radar-coverage.tsx` (Recharts)
- `src/components/charts/skill-heatmap.tsx` (Tremor or custom)
- `src/components/charts/progress-ring.tsx`

### ⬜ Step 15 — Profile + Settings (M5)

### ⬜ Step 16 — Tests + CI + Polish (M5)

**Files:**
- `tests/unit/*` (Vitest)
- `tests/e2e/smoke.spec.ts` (Playwright)
- `.github/workflows/ci.yml`

---

## Re-prompt template cho Claude/Cursor (mỗi milestone)

Khi muốn AI tiếp tục từ milestone tiếp theo, paste prompt sau:

```
Bạn đã có project tại /root/application/devops-roadmap/application/ (Next.js project tên "competency-framework").
Đã hoàn thành Step 0–4 (foundation scaffold).
Tham chiếu:
- Plan: /root/application/devops-roadmap/plan/
- Prompt gốc: /root/application/devops-roadmap/PROMPT_DEVOPS_MASTERY_WEB_APP.md (Section "Build Order")

Yêu cầu: Implement Step {N} — {Tên} theo format đã định nghĩa (file list, code đầy đủ, verify cmd, notes).
Bắt đầu ngay.
```
