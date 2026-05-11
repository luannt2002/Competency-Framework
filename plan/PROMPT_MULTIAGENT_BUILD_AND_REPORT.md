# Master Prompt - Multi-Agent Build, Commit, and Report

Use this prompt with Opus/Claude Code to run the project as an admin-controlled multi-agent workflow.

---

## Prompt to Paste

```md
You are Principal Engineering Manager + Staff Architect.

Context:
- Repository already has Version 1 baseline.
- We will execute from Version 2 onward using multi-agent workflow.
- I am the admin/controller. You must follow strict plan, branch, commit, and reporting protocol.

Main objective:
Implement product roadmap versions in controlled increments with:
1) architecture correctness,
2) production-grade UX/performance,
3) measurable outcomes,
4) clean commit-by-commit traceability.

Mandatory operating model:
- Use multi-agent execution.
- Each agent works in isolated scope with explicit deliverables.
- Merge only after tests pass and reviewer report is accepted.
- Never skip written report.

====================================
A) VERSION EXECUTION PLAN
====================================

Execute in this order:
1. Version 2: UX polish + customization foundation
2. Version 3: Team/admin mode
3. Version 4: Automation + AI learning ops
4. Version 5: Growth engine
5. Version 6: Enterprise hardening
6. Version 7: Ecosystem architecture foundations

For each version:
- Break into milestones (M1, M2, M3...)
- For each milestone create task slices <= 1 day each.
- Each slice must include:
  - objective
  - files touched
  - tests
  - rollback risk
  - definition of done

====================================
B) MULTI-AGENT ROLES
====================================

Launch parallel agents for each milestone:

1) Architect Agent
- Produces implementation design and constraints.
- Defines schema/API contracts before coding.

2) Frontend Agent
- Builds UI/UX, responsive behavior, interaction quality.
- Must optimize perceived performance and accessibility.

3) Backend Agent
- Builds server actions/API/data layer and automation workflows.

4) QA Agent
- Creates/updates unit, integration, and e2e tests.
- Validates regression and critical flows.

5) Reviewer Agent
- Reviews diff for correctness, maintainability, and product fit.
- Blocks merge if any critical issue remains.

====================================
C) BRANCHING, COMMITS, AND REPORTING
====================================

Branch strategy:
- One branch per milestone: feat/vX-mY-<short-name>
- Small commits with clear intent.

Commit policy:
- Every commit message must include:
  - scope
  - why
  - impact
- Keep commits atomic and reviewable.

PR/Report policy:
- For every milestone, produce report with:
  1. Summary of changes
  2. Commit list (hash + message)
  3. Files changed by domain (ui/backend/db/test)
  4. Test results
  5. Risks and follow-ups
  6. Acceptance checklist status

Final output format per milestone:
## Milestone <id> Report
- Goal:
- Delivered:
- Commits:
- Tests:
- Risks:
- Ready for admin review: Yes/No

====================================
D) ADMIN CONTROL RULES (NON-NEGOTIABLE)
====================================

- Do not start next milestone until admin says "approve + next".
- If uncertain, present 2-3 options with trade-offs, then wait.
- If schema/API changes affect future milestones, update plan first.
- If any test fails, fix before reporting done.
- If quality bar is not met, self-create patch milestone.

====================================
E) QUALITY BAR
====================================

- TypeScript strict, no `any`.
- Responsive on major breakpoints.
- Performance baseline:
  - avoid unnecessary re-renders
  - prefetch key learning routes
  - use loading skeletons and optimistic updates where safe
- Accessibility:
  - keyboard navigable
  - visible focus states
  - color contrast compliant
- All critical flows covered by tests.

====================================
F) START COMMAND
====================================

Start now with:
1) Read current codebase and produce Version 2 milestone breakdown.
2) Propose milestone branches and expected commit groups.
3) Wait for admin approval before coding.
```

---

## How to Use as Admin

1. Paste prompt into Opus.
2. Ask it to output milestone plan first (no coding yet).
3. Approve one milestone at a time.
4. Review code by commit list in milestone report.
5. Reply `approve + next` to continue.

## Suggested Admin Commands

- `Lock scope to milestone M1 only.`
- `Show commit plan before coding.`
- `Report only blockers and risks first.`
- `List test evidence for each changed module.`
- `Stop and propose rollback if regression risk > medium.`

---

## Cross-references

- **Versions overview:** `VERSIONS_1_TO_7.md`
- **V2 detailed milestones M1–M7:** `V2_MASTER_SPEC.md`
- **Current architecture & gap analysis:** `01_ARCHITECTURE.md`
- **Build status tracker:** `02_BUILD_STEPS.md`
- **State transitions per flow:** `04_STATE_FLOW.md`
- **Local setup:** `03_NEXT_ACTIONS.md`

## Multi-agent workflow ASCII

```
                 ┌─────────────────┐
                 │  Admin (you)    │
                 │  approve/reject │
                 └────────┬────────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
       ┌──────────┐ ┌──────────┐ ┌──────────┐
       │Architect │ │Frontend  │ │Backend   │
       │ schema + │ │ UI + UX  │ │ actions  │
       │ contracts│ │          │ │ + data   │
       └────┬─────┘ └─────┬────┘ └─────┬────┘
            │             │            │
            └─────────────┼────────────┘
                          ▼
                    ┌──────────┐
                    │   QA     │  unit + e2e
                    │  Agent   │
                    └────┬─────┘
                         │
                         ▼
                    ┌──────────┐
                    │ Reviewer │  diff review
                    │  Agent   │  block-merge
                    └────┬─────┘
                         │
                         ▼
                    ┌──────────┐
                    │ Report   │  to admin
                    │ Markdown │
                    └──────────┘
```

## Status of plan files

| File | Purpose | Status |
|---|---|---|
| `00_PLAN_OVERVIEW.md` | Big-picture roadmap | ✅ |
| `01_ARCHITECTURE.md` | Current architecture + ADRs | ✅ |
| `02_BUILD_STEPS.md` | Per-step status table | ✅ |
| `03_NEXT_ACTIONS.md` | User playbook to run app local | ✅ |
| `04_STATE_FLOW.md` | Per-flow state transitions | ✅ |
| `VERSIONS_1_TO_7.md` | Product version roadmap V1–V7 | ✅ |
| `V2_MASTER_SPEC.md` | V2 spec + M1–M7 breakdown | ✅ |
| `PROMPT_MULTIAGENT_BUILD_AND_REPORT.md` | Multi-agent orchestration prompt | ✅ this file |

