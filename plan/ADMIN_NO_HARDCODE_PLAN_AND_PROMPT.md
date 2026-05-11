# Admin Pack - No Hardcode / No Mock / Real Backend-DB Only

Role: Admin controls planning + review only.  
Coding is delegated to coder agents.

---

## 1) Master Prompt for Coder Agents

```md
You are a production-grade engineering team.
Role split: Architect, Backend, Frontend, QA, Reviewer.
Admin (human) controls milestone approvals.

NON-NEGOTIABLE RULES
1) No hardcoded business data in UI/components.
2) No runtime mock/fake/sample data.
3) No fallback fake values for domain objects (skills, roadmap, xp, streak, tasks).
4) All data must come from Backend/API/Database only.
5) Missing data => explicit empty/loading/error state, never fabricated defaults.

DATA SOURCES (MANDATORY)
- DevOps competency source:
  - Google Sheet tab gid=1970847068
  - Google Sheet tab gid=1890838692
- Roadmap source:
  - 01_DEVOPS_12MONTH_ROADMAP_SUMMARY.md
  - 02_PHASE1_AWS_TERRAFORM_DEEP_DIVE_Q1.md
  - 03_PHASE2_KUBERNETES_EKS_GOLANG_Q2.md
  - 04_PHASE3_DEVSECOPS_GITOPS_ADVANCED_Q3.md
  - 05_PHASE4_PLATFORM_ENGINEERING_GOLANG_SENIOR_Q4.md

MANDATORY PIPELINE
A) Ingestion layer
- Build ETL jobs to parse Google Sheets + roadmap markdown.
- Normalize into canonical DB schema (workspace-scoped).
- Idempotent upsert + versioned import logs.
- No manual static JSON embedded in app runtime.

B) Backend contracts
- API/Server Actions read only from DB tables.
- Strict validation (zod), typed DTOs, clear error codes.
- Pagination/filter/sort on server side.

C) Frontend contracts
- Presentation only, no business constants except UI constants.
- Query keys and API clients typed.
- Loading/error/empty states required.

D) Quality gates (must pass before milestone done)
- no-hardcode guard
- no-mock guard
- lint
- typecheck
- tests (unit + integration + e2e smoke)

FORBIDDEN PATTERNS
- import from mock-data in app runtime
- NEXT_PUBLIC_USE_MOCK or equivalent runtime toggles
- hardcoded arrays for skills/roadmap/weeks/tasks
- fake defaults for hearts/streak/xp

DELIVERY FORMAT PER MILESTONE
1) Goal
2) Files changed
3) DB/API impact
4) Test evidence
5) Risks
6) Ready for admin review: Yes/No

STOP RULE
Do not continue next milestone until admin replies: "approve + next".
```

---

## 2) Admin Plan (No Coding)

## Milestone M1 - Data Governance and Contracts
- Standardize source schema (sheets + markdown) into canonical tables.
- Define import versioning and audit logs.
- Finalize DTO/API contracts for:
  - skills
  - levels
  - roadmap tree
  - weeks
  - tasks
  - progress

Admin review focus:
- Data lineage is traceable (source row -> DB row -> API payload).

## Milestone M2 - ETL Production Pipeline
- Build parser for 2 sheets + 5 markdown files.
- Ensure idempotent upsert.
- Add import report: inserted/updated/skipped/errors.

Admin review focus:
- Running import twice is stable.
- Error handling and logging are clear.

## Milestone M3 - Backend-first Read APIs
- All key screens read only from backend/database.
- Add server-side filtering/pagination/sorting.
- Remove all business data inline in frontend runtime.

Admin review focus:
- Random UI samples match DB truth.

## Milestone M4 - Frontend Hardening
- Complete loading/empty/error states.
- Responsive on mobile/tablet/desktop.
- Performance baseline with caching/prefetch strategy.

Admin review focus:
- No fake fallback; UX remains clean under slow/error conditions.

## Milestone M5 - Guardrails and CI Enforcement
- Enforce no-hardcode/no-mock checks in CI.
- PR template requires anti-hardcode checklist.
- E2E smoke with real backend data.

Admin review focus:
- CI fails fast if mock/hardcode is introduced.

## Milestone M6 - Competency Accuracy Layer
- Map lesson/lab/project evidence to competency confidence score.
- Separate statuses: self_claimed vs learned vs verified.
- Add admin analytics for confidence quality.

Admin review focus:
- System measures actual competency, not just completion count.

---

## 3) Admin Review Checklist (Use for Every PR)

- Data flows from source -> ETL -> DB -> API -> UI.
- No hardcoded business data in components.
- No runtime mock/fake toggles.
- API contracts are typed and validated.
- Parser/import/unlock tests are present.
- Import audit logs are queryable.
- UI handles loading/error/empty states properly.
- Risks and rollback notes are documented.

---

## 4) Admin Decision Commands

- `Lock scope to milestone Mx only.`
- `Show DB/API contract before coding.`
- `Show import dry-run report first.`
- `Provide commit plan before implementation.`
- `Report blockers first, then progress.`
- `Reject and patch if any hardcode/mock appears.`
- `approve + next` (only when milestone passes all gates)

