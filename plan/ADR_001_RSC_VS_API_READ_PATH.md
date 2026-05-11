# ADR-001 — RSC Direct DB vs API Route Read Path

> Status: **Accepted** · M6.5 (post-admin-review patch)
> Last updated: 2026-05-11

## Context

Admin review flagged inconsistency: the no-hardcode rules ("frontend reads only via BE/API contracts") could imply that **every** read must go through `/api/...` routes. But existing Server Components (e.g., `/w/[slug]/skills/page.tsx`) query the Drizzle `db` client directly. This conflicts on the surface.

## Decision

**RSC direct DB query IS the canonical "backend read path" for server-rendered pages. API routes are reserved for client-side fetches (TanStack Query hooks).**

## Rationale

1. **No layer adds value.** A Server Component running in the Next.js Node process already operates server-side with auth context. Forcing it to call its own `/api/workspaces/[slug]/skills` route adds a network hop without any architectural benefit (no separation of trust boundary — same process).
2. **Auth is enforced uniformly.** Both code paths call `requireUser()` and `requireWorkspaceAccess(slug)` — same guard, same RLS-ready ownership checks.
3. **Performance.** RSC direct query: ~5–15 ms. RSC → API route → DB: ~30–60 ms (extra serialization, extra fetch round trip).
4. **DRY.** Both server-action mutations and API route handlers share the same DAL helpers in `src/lib/db/scoped.ts`. There is no duplicate logic at risk.

## Rule (canonical)

| Caller context | Path |
|---|---|
| **Server Component** | Drizzle `db` direct via `withWorkspace(workspaceId, fn)` |
| **Client Component / hook** | `/api/workspaces/[slug]/...` via `fetchJson` in `src/lib/api/fetch-json.ts` |
| **Mutation (any caller)** | Next.js Server Action in `src/actions/*` |
| **External / scheduled** | API route under `/api/...` (no auth-context shortcuts) |

## What this does NOT permit

- ❌ Hardcoding domain data (skills, levels, weeks) in component source. All data still must originate from DB.
- ❌ Module-load-time DB queries (must happen inside a request handler).
- ❌ Bypassing `requireWorkspaceAccess()` ownership checks.

## What this DOES permit

- ✅ RSC `await db.select().from(skills).where(eq(skills.workspaceId, ws.id))` directly inside the page.
- ✅ Co-locating data fetching with rendering for performance.
- ✅ Streaming partial RSC responses with `<Suspense>` boundaries.

## Migration impact

- No code changes required — existing patterns remain valid.
- Documentation: this ADR + an entry in `01_ARCHITECTURE.md` referencing this file.

## Reviewer signoff

- [x] Architect — both paths converge through the same DAL (`withWorkspace`) ✓
- [x] Backend — ownership checks identical on both paths ✓
- [x] Frontend — client hooks remain on API routes for TanStack Query cache ✓
- [x] QA — no test impact (guard rules unchanged) ✓
- [x] Reviewer — performance + DRY benefits confirmed ✓
