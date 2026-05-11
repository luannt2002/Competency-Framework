# Execution Plan - 12 Weeks (Personal Learning OS)

## Objective

Execute a production-minded build for:
- Personal self-learning first
- Team training/onboarding ready by architecture
- Unlimited customization without hardcoded hierarchy

Admin mode:
- You control scope and approvals.
- Coder team executes milestone-by-milestone.

---

## Global Delivery Rules

1. No hardcoded business data.
2. No runtime mock data.
3. Backend/DB is source of truth.
4. Every milestone must include:
   - design note
   - changed files
   - test evidence
   - risk + rollback
5. No next milestone without admin command: `approve + next`.

---

## Sprint Structure

- Duration: 12 weeks
- Cadence: 6 sprints x 2 weeks
- Review cycle:
  - Day 1-7: build
  - Day 8: internal QA
  - Day 9: admin review
  - Day 10: patch + signoff

---

## Sprint 1 (Week 1-2) - Core Data and Tree Engine

### Goal
Ship unlimited-depth hierarchy foundation.

### Scope
- Implement dynamic node model (`nodes`) with parent-child tree.
- Add CRUD for node add/edit/delete/move/reorder.
- Add API contracts for tree operations.
- Add basic tree explorer UI (expand/collapse).

### Deliverables
- DB migrations
- Tree API routes/server actions
- Tree explorer v1
- Unit tests for tree operations

### Acceptance
- User can create any-depth hierarchy without schema change.
- Move node across branches works safely.

---

## Sprint 2 (Week 3-4) - Weekly Post / Case Study System

### Goal
Enable weekly T3 journal and case-study workflow.

### Scope
- Weekly post entity + revisions.
- Structured sections:
  - what learned
  - pain points
  - root cause
  - fix
  - lessons learned
  - next week plan
- Weekly template creation.

### Deliverables
- Weekly post editor v1
- Weekly post list by workspace
- Revision history
- Search by week/tag

### Acceptance
- One complete weekly case-study post can be created, edited, and versioned.

---

## Sprint 3 (Week 5-6) - Notes, Checklist, and Document Blocks

### Goal
Build strong personal knowledge base workflow.

### Scope
- Block-based document model:
  - markdown
  - checklist
  - code block
  - link block
- Notes linked to any node.
- Quick capture from dashboard.

### Deliverables
- Note editor + list + filter
- Reusable templates (weekly review/lab recap)
- Full-text search baseline

### Acceptance
- User can maintain structured notes for each roadmap branch.

---

## Sprint 4 (Week 7-8) - Attachment and Evidence Hub

### Goal
Turn workspace into real learning evidence vault.

### Scope
- Upload support:
  - file
  - image
  - video
  - external link
- Attach media to nodes/posts/notes/labs.
- Evidence metadata (tags, caption, source).

### Deliverables
- Attachment service + storage integration
- Evidence panel UI
- Media list/gallery views

### Acceptance
- User can attach and retrieve learning evidence across workspace.

---

## Sprint 5 (Week 9-10) - Competency Linkage and Progress

### Goal
Connect learning artifacts to competency progression.

### Scope
- Node/post/lab -> skill linking.
- Confidence states:
  - self_claimed
  - learned
  - verified
- Progress scoring from evidence + activity.

### Deliverables
- Skill linkage UI
- Progress computation service
- Competency overview panel

### Acceptance
- Skill progression reflects real outputs, not only self-rating.

---

## Sprint 6 (Week 11-12) - Performance, UX Polish, and Stability

### Goal
Make it fast, clean, and daily-usable.

### Scope
- Performance tuning:
  - query indexes
  - lazy-load tree branches
  - cache hot reads
- UX polish:
  - loading/empty/error states
  - responsive refinements
  - fast quick-add flows
- Quality hardening:
  - anti-hardcode checks
  - anti-mock checks
  - e2e critical flow coverage

### Deliverables
- Performance report
- UX polish pass
- QA final report

### Acceptance
- App feels smooth for daily use.
- Quality gates all green.

---

## Database Performance Checklist (PostgreSQL)

Mandatory for backend team:
- Index `(workspace_id, parent_id, order_index)` on nodes.
- Index `(workspace_id, node_type)` for filtered queries.
- GIN index for tag/meta json fields.
- Full-text search index for notes/posts.
- Timeline index `(workspace_id, created_at desc)` for activity feeds.
- Pagination on all list APIs.
- No deep tree full-fetch by default; branch lazy loading only.

---

## Quality Gates (Every Sprint)

1. Functional correctness
2. No hardcode/no mock violations
3. Lint + typecheck pass
4. Unit/integration/e2e checks pass
5. Migration + rollback note present
6. Admin acceptance checklist completed

---

## Admin Review Template (Use Every Sprint)

1. Goal achieved? (Yes/No)
2. Any hardcode/mock found? (Yes/No)
3. Data lineage clear from DB to UI? (Yes/No)
4. Performance regression? (Yes/No)
5. UX friction in daily flow? (Yes/No)
6. Risk and rollback documented? (Yes/No)
7. Decision:
   - `approve + next`
   - `reject + patch`

---

## Start Order (Immediate)

1. Run Sprint 1 planning meeting output (schema + API contracts first).
2. Implement Sprint 1 only.
3. Send milestone report for admin review.
4. Wait for `approve + next`.

