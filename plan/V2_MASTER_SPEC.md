# V2 Master Spec - DevOps Competency OS

## Product Positioning

- Not just roadmap viewer.
- Become a `Competency OS`: assess -> roadmap -> daily execution -> lab evidence -> growth report.
- Core moat: deep customization for DevOps teams and individuals.

## Version Plan

### V1.5 (2-4 weeks) - Demo-ready polish

- UX polish: responsive (mobile/tablet/desktop), skeleton loading, strong empty states.
- Performance: route caching, prefetch week/lesson, optimistic updates, virtualized tables.
- Automation baseline: daily task generation + weekly summary.
- Dual view: `Tree view` + `Duolingo path view`.

### V2 (4-8 weeks) - Customization moat

- Framework Builder Pro:
  - Drag-drop hierarchy: Level -> Month -> Week -> Topic/Lab/Project.
  - Custom unlock rules.
  - Skill weights + mastery scoring.
- Import engine: CSV / Google Sheets / JSON -> schema mapping.
- Resource graph: link skills to docs/labs/videos/internal standards.

### V3 - Team & Manager mode (B2B ready)

- Org workspace with role-based access.
- Manager dashboard: skill-gap heatmap, team progress, at-risk users.
- Assignment automation by role (Intern/Fresher/Junior/etc).
- Review workflow: self-assessment + manager validation + evidence approval.

### V4 - AI + Automation

- AI learning copilot:
  - Generate daily/weekly plan from actual progress.
  - Explain mistakes + suggest remedial labs.
- Auto lab checker:
  - Sync GitHub/CI signals into progress.
- Smart nudges based on behavior.

### V5 - Growth & Marketplace

- Public template marketplace.
- Shareable profile (skills, streak, projects).
- Community challenge and cohort leaderboard.
- Referral loop for team invites.

### V6 - Enterprise hardening

- SSO/SAML, audit logs, advanced RBAC.
- SLA-ready ops: backup/restore, export, compliance.
- Public API + webhooks for integrations.

## 7 Must-Win Pillars

1. Fast activation (<10 minutes to first value).
2. Smooth interaction (<100ms for primary actions).
3. Premium UX (clear visual hierarchy, modern dark-first design).
4. Deep customization (hierarchy, rules, scoring, content types).
5. Real automation (daily planning + evidence sync + smart updates).
6. Outcome visibility (what skill improved, what project proved it).
7. Extensibility (templates, import/export, API-first architecture).

## Product KPIs

- Activation D1 (first lesson completed).
- D7 retention.
- Weekly active learners.
- Week completion rate.
- Skill evidence coverage rate.
- Team workspace active rate.
- Time-to-create custom framework.

## Go-to-market Focus

- Sell outcomes, not content library.
- Start with one niche: DevOps/Platform Engineering.
- Launch with 3 flagship templates:
  - DevOps Intern -> Mid
  - Kubernetes Platform Engineer
  - DevSecOps Track

## V2 Milestone Breakdown (executable)

### M1 — Tree data model (3 days)
- DB: `roadmap_tree_nodes` (adjacency list) + `user_node_progress`
- Drizzle schema update + migration SQL applied via psql
- Adapter `treeForWorkspace(slug)` returning nested tree from existing flat data
- Unit tests: cycle detection, depth limit, parent_id integrity
- DoD: existing routes still work; tree API returns 4-level tree (Level→Phase→Week→Lesson)

### M2 — Tree UI page (3 days)
- `/w/[slug]/roadmap-tree` page (RSC + client recursive tree)
- Expand/collapse with URL state (`?expand=node-id-1,node-id-2`)
- Right pane: node detail (description, resources, child progress)
- Domain filter chips (AWS/Terraform/K8s/Go/Sec/Obs)
- Search via cmdk (cmd+K)
- DoD: render 200-node tree < 500ms, keyboard navigable

### M3 — Daily planner (4 days)
- `/w/[slug]/daily` page + `daily_tasks` table
- Server action `generateDailyTasks(slug, date, mood?)`:
  - unfinished labs in current unlocked week
  - 2 weak skills (level < S or numeric < 33)
  - 1 streak-keeper task (review yesterday's exercise)
- Quick check-in UI: done / skip / carry-over
- DoD: planner returns 3–5 tasks, respects user XP goal, mobile-friendly

### M4 — Custom unlock rules (3 days)
- Rule DSL JSONB stored in `roadmap_tree_nodes.unlock_rule`
- Built-in ops: `percent_done`, `node_completed`, `total_xp`, `streak`, `skill_level`
- Engine `evaluateUnlockRule(rule, ctx)` server-side, sandboxed
- Tree UI: lock icon + "Why locked?" tooltip showing missing condition
- DoD: 5 sample rules seeded; engine 100% unit test coverage

### M5 — Skill weights + mastery scoring (2 days)
- `lessons.skill_weights` JSONB: `[{skillSlug, weight}]`
- Aggregator: `computeMastery(userId, skillId)` = weighted average of lessons completed × weight
- Skills Matrix shows mastery 0–100 alongside self-claimed level
- DoD: both Self-claimed + Learned shown distinctly

### M6 — Import engine v2 (3 days)
- Google Sheets via Service Account (multi-sheet read)
- Notion DB import (schema mapping wizard)
- Markdown folder (each .md = lesson + frontmatter)
- Idempotent upsert by slug
- DoD: 3 importers work end-to-end

### M7 — Resource graph (2 days)
- `resources` table linked to skills + lessons
- OpenGraph fetch on add (title/description/image)
- "Suggested next" inference (prerequisite + weakness)
- DoD: 50 resources seeded, suggestions respect prerequisites

## Cumulative V2 deliverables (after M1–M7)

- 2 new pages: `/roadmap-tree`, `/daily`
- 4 new DB tables: `roadmap_tree_nodes`, `user_node_progress`, `daily_tasks`, `resources`
- 7+ new server actions
- 10+ new UI components
- Tests: ≥ 30 new unit + 2 new e2e specs
- Backward compatible — V1 routes intact

## Next Build Recommendation

- Priority now: execute V1.5 + V2 before scaling to V3+.
- Success condition: users can create a custom competency roadmap and run daily labs without manual admin work.
- **To start V2 M1:** paste `PROMPT_MULTIAGENT_BUILD_AND_REPORT.md` into Claude → ask for M1 detailed plan → approve → code.
