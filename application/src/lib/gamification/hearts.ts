/**
 * Heart refill logic (lazy, computed on read/write).
 *
 * Hearts regenerate at 1 per REFILL_INTERVAL_MS (4h) up to `max`. There is no
 * cron — refills are applied lazily whenever a hearts row is read or written,
 * via `applyHeartRefills`.
 *
 * The refill count math is kept in a pure function (`computeRefill`) so it can
 * be unit-tested without a DB; the SQL in `applyHeartRefills` mirrors it in a
 * single atomic UPDATE (race-tolerant for the single-user row it targets).
 */
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { hearts } from '@/lib/db/schema';

/** One heart every 4 hours (matches the interval written on heart loss). */
export const REFILL_INTERVAL_MS = 4 * 60 * 60 * 1000;

export type HeartsSnapshot = {
  current: number;
  max: number;
  nextRefillAt: Date | null;
};

/**
 * Pure refill math: how many hearts and what next_refill_at a row should have
 * as of `now`.
 *
 * Rules:
 *  - While current < max and next_refill_at <= now: +1 heart per elapsed
 *    interval (the first refill is due exactly at next_refill_at).
 *  - next_refill_at advances one interval per granted heart.
 *  - Reaching max clears next_refill_at (null = no pending refill — same
 *    convention as the bootstrap insert of a full 5/5 row).
 *  - Idempotent: applying it to an already-refilled row changes nothing.
 */
export function computeRefill(
  current: number,
  max: number,
  nextRefillAt: Date | null,
  now: Date = new Date(),
): HeartsSnapshot {
  if (nextRefillAt === null || current >= max) {
    return {
      current,
      max,
      // Full row: no pending refill.
      nextRefillAt: current >= max ? null : nextRefillAt,
    };
  }
  if (nextRefillAt.getTime() > now.getTime()) {
    return { current, max, nextRefillAt };
  }
  const overdueMs = now.getTime() - nextRefillAt.getTime();
  const gained = 1 + Math.floor(overdueMs / REFILL_INTERVAL_MS);
  const newCurrent = Math.min(max, current + gained);
  return {
    current: newCurrent,
    max,
    nextRefillAt:
      newCurrent >= max
        ? null
        : new Date(nextRefillAt.getTime() + gained * REFILL_INTERVAL_MS),
  };
}

/**
 * SQL fragment: number of hearts owed right now (0 when nothing is pending).
 * Mirrors `computeRefill`'s gained count, capping handled by the caller.
 */
function gainedSql() {
  return sql<number>`
    CASE
      WHEN ${hearts.current} < ${hearts.max}
        AND ${hearts.nextRefillAt} IS NOT NULL
        AND ${hearts.nextRefillAt} <= NOW()
      THEN GREATEST(
        1,
        1 + FLOOR(EXTRACT(EPOCH FROM (NOW() - ${hearts.nextRefillAt})) / ${REFILL_INTERVAL_MS / 1000})
      )
      ELSE 0
    END`;
}

/**
 * Apply pending refills to one (workspace, user) row in a single atomic
 * UPDATE, then return the refreshed row (or null when no row exists).
 *
 * Because both computed columns derive from the PRE-update values (Postgres
 * UPDATE semantics), the two SET expressions stay consistent; a concurrent
 * call can at worst re-derive the same values (idempotent) — safe for a row
 * only its owning user writes.
 */
export async function applyHeartRefills(
  workspaceId: string,
  userId: string,
): Promise<HeartsSnapshot | null> {
  const gained = gainedSql();
  const rows = await db
    .update(hearts)
    .set({
      current: sql`LEAST(${hearts.max}, ${hearts.current} + ${gained})`,
      nextRefillAt: sql`
        CASE
          WHEN ${hearts.current} + ${gained} >= ${hearts.max} THEN NULL
          ELSE ${hearts.nextRefillAt} + (${gained} * interval '4 hours')
        END`,
    })
    .where(and(eq(hearts.workspaceId, workspaceId), eq(hearts.userId, userId)))
    .returning({
      current: hearts.current,
      max: hearts.max,
      nextRefillAt: hearts.nextRefillAt,
    });
  const row = rows[0];
  if (!row) return null;
  return {
    current: row.current ?? 0,
    max: row.max ?? 0,
    nextRefillAt: row.nextRefillAt ?? null,
  };
}
