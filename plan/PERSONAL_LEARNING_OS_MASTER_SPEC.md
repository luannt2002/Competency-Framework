# Personal Learning OS - Master Plan (Admin Version)

## 0) Mission

Build a personal-first learning operating system for 12-month DevOps self-study:
- Custom hierarchy with unlimited depth
- Weekly learning post + case-study journal
- Evidence-first learning (file/image/video/link attachments)
- Competency progress tied to real artifacts
- No hardcoded business structure

This system must work for:
- Personal self-learning (primary)
- Team training
- Onboarding programs
- Case-study portfolio publishing later

---

## 1) Product Principles (Non-Negotiable)

1. Personal-first before public-first.
2. No hardcoded hierarchy depth.
3. No hardcoded node types in UI logic.
4. Everything editable: add/edit/delete/move/clone/archive.
5. Evidence-first: every learning output can be attached and tracked.
6. Production mindset from day one (typed contracts, audit logs, quality gates).

---

## 2) Core Capabilities

## A. Unlimited Hierarchy Engine
- User can create custom tree with any number of levels.
- Example path (not fixed): Year -> Quarter -> Month -> Week -> Topic -> Lab -> Post.
- Drag-drop reorder and move between branches.
- Node templates supported (optional starter templates).

## B. Weekly T3 Post / Case Study Module
- Weekly post includes:
  - what learned
  - what failed (pain points)
  - root cause
  - fix
  - lessons learned
  - next week plan
- Can publish as private/public later.

## C. Attachment and Media Hub
- Upload and attach:
  - documents
  - images
  - videos
  - external links
- Attach to any node/post/lab/note.
- Taggable and searchable.

## D. Notes / Plans / Checklists
- Block-based notes:
  - markdown
  - checklist
  - code block
  - timeline
  - attachment block
- Reusable templates: weekly review, incident recap, lab report.

## E. Competency Linkage
- Any node/post/lab can link to one or many skills.
- Skill confidence states:
  - self_claimed
  - learned
  - verified
- Progress is computed from evidence and activity.

---

## 3) Data Model Blueprint (High-Level)

## Core workspace
- `workspaces`
- `workspace_settings`

## Dynamic tree
- `nodes`
  - id, workspace_id, parent_id
  - title, node_type, order_index
  - status, visibility
  - meta_json (custom fields)
  - created_by, created_at, updated_at

## Node relations and indexing
- `node_paths` (optional closure/materialized path strategy)
- `node_tags`

## Weekly post and journal
- `weekly_posts`
- `post_sections` (structured components)
- `post_revisions`

## Attachments
- `attachments`
- `attachment_links` (polymorphic relation)

## Notes and plans
- `documents`
- `document_blocks`
- `document_revisions`

## Competency linkage
- `skills`
- `user_skill_progress`
- `node_skill_links`
- `evidence_items`

## Operations
- `activity_log`
- `import_jobs`
- `audit_log`

---

## 4) UX Architecture

## Main surfaces
1. Dashboard (Today + active branch + quick capture)
2. Tree Explorer (primary control center)
3. Weekly Post Editor (T3 focus)
4. Lab Journal + Evidence panel
5. Competency map

## UX requirements
- Mobile/desktop responsive.
- Fast interactions (<100ms perceived for local actions).
- Clear loading/empty/error states.
- Global command palette.
- Keyboard shortcuts for power use.

---

## 5) Implementation Phases

## Phase 1 - Foundation (2-3 weeks)
- Dynamic node model + CRUD + reorder + move
- Workspace-level settings
- Audit logging baseline
- Tree explorer v1

Exit criteria:
- Unlimited-depth hierarchy works without schema changes.

## Phase 2 - Weekly T3 Journal (2-3 weeks)
- Weekly post model + editor + revisions
- Weekly template presets
- Linked notes/checklists

Exit criteria:
- User can create complete weekly case-study post with revisions.

## Phase 3 - Attachments and Evidence (2-3 weeks)
- Upload pipeline and attachment linking
- Gallery/list view per node
- Evidence tagging and search

Exit criteria:
- Any node supports file/image/video/link attachments.

## Phase 4 - Competency Integration (2-3 weeks)
- Node-to-skill linking
- Confidence scoring (self/learned/verified)
- Skill progress update from evidence

Exit criteria:
- Competency progress reflects real artifacts and learning actions.

## Phase 5 - Performance and Hardening (2 weeks)
- Query optimization and caching
- API contract stabilization
- QA automation and regression coverage

Exit criteria:
- Stable performance and quality gates passed.

## Phase 6 - 12-month Personal Runtime (continuous)
- Use as daily driver
- Monthly retrospectives
- Product adjustments based on actual use

Exit criteria:
- 90+ days continuous usage with minimal friction.

---

## 6) Admin Control and Team Protocol

1. Milestone planning first, code second.
2. Every milestone has explicit acceptance criteria.
3. No milestone advance without admin approval.
4. Required output for each milestone:
   - summary
   - changed files
   - test evidence
   - known risks
   - rollback notes

Approval command:
- `approve + next`

---

## 7) Quality Gates

Mandatory before merge:
- No hardcoded business content
- No runtime mock data
- Typed API contracts
- Lint + typecheck + test pass
- Security and upload validation checks
- Migration and rollback notes included

---

## 8) 12-Month Success Criteria (Personal-First)

You can claim success when:
- 48+ weekly posts completed
- 100+ evidence artifacts attached
- Stable custom hierarchy used daily
- Skill progression backed by evidence, not only self-rating
- System remains useful without manual workaround

---

## 9) Publish-Readiness Criteria (After Personal Validation)

Before public release:
- Core workflow validated by personal 1-year usage
- UX polished and simplified for first-time users
- DevOps template packaged and documented
- At least 3 strong case studies derived from real usage

---

## 10) Next Admin Action

Ask coder team to execute in this exact order:
1. Phase 1 (dynamic tree foundation)
2. Phase 2 (weekly journal/T3 post)
3. Phase 3 (attachments and evidence)

Do not start Phase 4+ until daily personal usage confirms Phase 1-3 are smooth.

