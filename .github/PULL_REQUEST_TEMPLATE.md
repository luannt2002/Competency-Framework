# Pull Request

## Summary
<!-- 1-3 sentences describing what this PR does and why. -->

## Changes
<!-- Bulleted list of notable changes. -->

## Quality Checklist
- [ ] No hardcoded business data in components
- [ ] No imports from `@/lib/mock-data/*`
- [ ] No `NEXT_PUBLIC_USE_MOCK` toggles
- [ ] All domain data sourced from DB/API
- [ ] Loading/error/empty states present
- [ ] Tests added for new logic
- [ ] No new `any` types
- [ ] DB migration applied if schema changed
- [ ] Quality gates pass: `pnpm guard && pnpm typecheck && pnpm lint && pnpm test`
- [ ] Risks/rollback documented in PR description

## Risks & Rollback
<!-- What could break? How do we revert if it does? -->

## Test Plan
<!-- How was this verified? Commands run, manual steps, screenshots. -->
