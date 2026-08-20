/**
 * Workspace slug allocation.
 *
 * WHY THIS EXISTS
 * ---------------
 * `workspaces` used to be unique on `(owner_user_id, slug)` only, while every
 * lookup — `resolveWorkspace()`, `requireWorkspaceAccess()`, `/w/[slug]`,
 * `/share/[slug]` — searched by slug ALONE:
 *
 *     .where(eq(workspaces.slug, slug)).limit(1)
 *
 * Two different owners could therefore both hold `devops`, and the URL
 * `/w/devops` resolved to whichever row Postgres happened to return first.
 * The second tenant to pick a slug silently hijacked the first tenant's URL:
 * the original owner got WORKSPACE_NOT_FOUND_OR_FORBIDDEN on their own
 * workspace. No data leaked (RBAC still ran against the resolved id) but the
 * workspace became unreachable.
 *
 * Migration 0010 makes `slug` globally unique, which turns the lookup
 * deterministic. This module is the allocation half: it hands out a slug that
 * is free ACROSS the whole table, so callers never race into the constraint.
 *
 * `nextAvailableSlug` is pure so the numbering rules are unit-testable without
 * a database; `reserveWorkspaceSlug` is the thin DB-aware wrapper.
 */
import { and, like, ne } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaces } from '@/lib/db/schema';
import { toSlug } from '@/lib/utils';

/** Matches `workspaces.slug` — zod caps fork input at 40 chars. */
export const MAX_SLUG_LENGTH = 40;

/** Fallback stem when the caller's text slugifies to nothing (e.g. "🎯🎯"). */
const FALLBACK_STEM = 'workspace';

/**
 * Pick the first free slug for `desired`, given everything already `taken`.
 *
 * Rules:
 *   - The desired slug is normalised (`toSlug`) and clamped to 40 chars.
 *   - If free, it is returned untouched — the common path adds no suffix.
 *   - Otherwise `-2`, `-3`, … are appended. The STEM is truncated (not the
 *     suffix) so the result always fits in 40 chars: a 40-char slug colliding
 *     produces `…38-chars…-2`, never a 42-char overflow that would trip the
 *     column length in Postgres.
 *   - Comparison is case-insensitive because `toSlug` lowercases; callers that
 *     pass raw DB rows are normalised here rather than at every call site.
 */
export function nextAvailableSlug(desired: string, taken: Iterable<string>): string {
  const base = clamp(toSlug(desired) || FALLBACK_STEM);
  const used = new Set<string>();
  for (const t of taken) used.add(t.toLowerCase());

  if (!used.has(base)) return base;

  // `-2` is the first human-sensible suffix: `devops`, `devops-2`, `devops-3`.
  for (let n = 2; n < 10_000; n++) {
    const suffix = `-${n}`;
    const stem = clamp(base, MAX_SLUG_LENGTH - suffix.length);
    const candidate = `${stem}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }

  // 9_998 collisions on one stem is not a real scenario; fail loudly rather
  // than return a duplicate that would blow up on the unique index.
  throw new Error('SLUG_SPACE_EXHAUSTED');
}

function clamp(s: string, max = MAX_SLUG_LENGTH): string {
  // Trailing '-' after truncation would produce `devops--2`.
  return s.slice(0, max).replace(/-+$/, '');
}

/**
 * Reserve a globally-unique slug for `desired`.
 *
 * Only rows whose slug shares the normalised stem are loaded, so this stays a
 * single indexed prefix scan instead of pulling the whole table.
 *
 * `excludeWorkspaceId` lets a rename keep its own slug: without it, renaming a
 * workspace to the name it already has would see itself as a collision and
 * bump to `-2` on every save.
 *
 * Still racy against a concurrent insert by design — the unique index in
 * migration 0010 is the actual guarantee. This just makes the happy path not
 * depend on catching a constraint violation.
 */
export async function reserveWorkspaceSlug(
  desired: string,
  opts: { excludeWorkspaceId?: string } = {},
): Promise<string> {
  const base = clamp(toSlug(desired) || FALLBACK_STEM);

  const where = opts.excludeWorkspaceId
    ? and(like(workspaces.slug, `${base}%`), ne(workspaces.id, opts.excludeWorkspaceId))
    : like(workspaces.slug, `${base}%`);

  const rows = await db.select({ slug: workspaces.slug }).from(workspaces).where(where);
  return nextAvailableSlug(base, rows.map((r) => r.slug));
}
