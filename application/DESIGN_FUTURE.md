# 🔮 DESIGN_FUTURE — Schema-ready, code-pending

> This document describes features for which the **database schema is already in place** but the **UI/logic is not yet implemented**. They are unlocked progressively after MVP ships.

---

## 1. Multi-tenant Org / Team

### Status
Schema: ✅ `organizations`, `org_members` tables exist.
Code: ❌ Not implemented.

### Design

```
organizations (1) ──< org_members (M) >── auth.users
       │
       └──< workspaces (M)   (workspaces.org_id nullable in MVP, required in v2)
```

### Migration path

1. Add column `workspaces.shared = boolean` (default false).
2. Implement `inviteMember(orgId, email, role)` server action.
3. Update RLS policy to allow access if `(owner_user_id = uid())` OR `(workspace.org_id IN (SELECT org_id FROM org_members WHERE user_id = uid()))`.
4. UI: workspace switcher gains "Organizations" section.
5. Team dashboard `/org/[slug]` showing aggregated competency heatmap of members (anonymizable).

### RBAC
- `owner` — full CRUD.
- `admin` — manage members, workspaces.
- `member` — read all, write own progress.
- `viewer` — read-only.

---

## 2. Export PDF / Excel

### Status
Schema: ✅ `export_jobs`.
Code: ❌ Not implemented.

### API contract

```yaml
POST /api/exports
body:
  workspaceId: uuid
  format: 'pdf' | 'xlsx' | 'json'
response:
  jobId: uuid
  status: 'queued'

GET /api/exports/{jobId}
response:
  status: 'queued' | 'running' | 'done' | 'failed'
  fileUrl?: string (signed Supabase storage URL, 1h TTL)
```

### Libraries
- PDF: `@react-pdf/renderer` (server-side render).
- XLSX: `exceljs`.

### PDF layout
- Page 1 (cover): workspace name, user, date, accent gradient banner, total XP, radar chart screenshot.
- Page 2+ (matrix): table of all skills with category, level, last updated, note (truncated).

### XLSX structure
- Sheet 1 "Skills": columns Category | Skill | Level | Source | Updated | Note.
- Sheet 2 "Levels": Code | Label | Numeric | Description | Examples.

---

## 3. Spaced Repetition (SM-2)

### Status
Schema: ✅ `review_schedules`.
Code: ❌ Not implemented.

### SM-2 algorithm (simplified)

```ts
function nextReview(
  ease: number,        // 2.5 default
  intervalDays: number,
  quality: number      // 0..5 (user's recall confidence)
): { ease: number; intervalDays: number; dueAt: Date } {
  if (quality < 3) {
    return { ease, intervalDays: 1, dueAt: addDays(now(), 1) };
  }
  const newEase = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  const newInterval =
    intervalDays === 0 ? 1 :
    intervalDays === 1 ? 6 :
    Math.round(intervalDays * newEase);
  return { ease: newEase, intervalDays: newInterval, dueAt: addDays(now(), newInterval) };
}
```

### UI
- "Review now" card on Dashboard showing # due exercises today.
- After exercise feedback, ask "How well did you remember?" 0..5.

---

## 4. League / Leaderboard

### Status
Schema: ✅ `leagues`.
Code: ❌ Not implemented.

### Design
- Weekly cycle (Mon 00:00 → Sun 23:59 user's tz).
- 8 tiers: Bronze → Silver → Gold → Sapphire → Ruby → Emerald → Diamond → Obsidian.
- Top 7 of league → promote.
- Bottom 5 → demote.
- Solo users grouped randomly (15–30 per league).
- Schema needs `league_memberships` (week-scoped).

---

## 5. AI Tutor chat

### Status
Schema: TBD (per-conversation messages table).
Code: ❌ Not implemented.

### Design
- Trigger: user gets exercise wrong twice → "Want help?" button.
- Edge function calls Claude API with: exercise prompt + user's answer + rubric + last 5 attempts.
- Response streamed back; max 200 words.
- Prompt caching for rubric.

---

## 6. Public sharing read-only

### Status
Schema: ✅ `workspaces.visibility = 'public-readonly'`.
Code: ❌ Not implemented.

### Design
- Route `/u/[handle]/[workspace-slug]` (no auth required).
- Server fetches with service_role (bypass RLS).
- Read-only UI: no edit buttons, no drawer save.
- OG image: dynamic radar chart render.
- SEO meta.

---

## 7. Community templates publish

### Status
Schema: ✅ `framework_templates.author_kind = 'community'`.
Code: ❌ Not implemented.

### Flow
1. In a workspace, user clicks "Publish as template" → modal: slug, name, description, license.
2. Server snapshots current workspace (categories, skills, levels, tracks/weeks/modules/lessons/exercises) into `framework_templates.payload`.
3. Status `pending_review` → admin approves → `is_published=true`.
4. Appears in `/templates` catalog.

---

## 8. Code-challenge exercise type

### Status
Schema: ✅ `exercises.kind` includes future `'code_block_review'`. Future: `'code_challenge'`.
Code: ❌ Not implemented.

### Design
- Monaco editor in-browser.
- Predefined skeleton + hidden test cases.
- Run via Judge0 or Sphere Engine API.
- Pass = green tests.

---

## 9. Real-lab integration

### Status
Schema: TBD.
Code: ❌ Not implemented.

### Design
- Exercise kind `'real_lab'`.
- Embed Killercoda / Instruqt / Play with K8s iframe.
- Mark "done" with evidence URL (screenshot, asciinema).

---

## 10. Mobile native (Expo)

### Status
Code: ❌ Not implemented.

### Design
- Expo app reuses Server Actions via REST wrapper.
- Course Map + Lesson Runner are highest priority for native UX.
- Push notifications for streak reminder.
- Offline mode: cache lessons + replay attempts when online.

---

## 🎯 Implementation priority (post-MVP)

1. **Multi-tenant org/team** (unlock B2B)
2. **Export PDF** (deliverable for users)
3. **Spaced repetition** (learning effectiveness)
4. **Public sharing** (growth)
5. **Community templates** (ecosystem)
6. **AI tutor** (engagement)
7. **League** (engagement)
8. **Code challenge** (depth)
9. **Real lab** (depth)
10. **Mobile native** (reach)
