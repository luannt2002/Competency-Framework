/**
 * Streak tick logic — call after a user completes any lesson.
 * Mutates streaks row. Returns whether the streak ticked this call (i.e. first lesson today).
 *
 * Concurrency: a single conditional UPDATE (WHERE last_active_date < today) makes the
 * tick idempotent per day even under concurrent completeLesson calls — exactly one
 * caller gets the update, everyone else reads the already-ticked row.
 *
 * Timezone: the product audience is Vietnamese, so "today" is computed in Asia/Ho_Chi_Minh
 * (UTC+7, no DST). Using server/UTC would reset the streak at 07:00 local time.
 */
import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { streaks } from '@/lib/db/schema';

export type StreakTickResult = {
  ticked: boolean;
  newStreak: number;
  longest: number;
};

/** Fixed offset of Asia/Ho_Chi_Minh (UTC+7, no daylight saving). */
const VN_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

/** YYYY-MM-DD of "now" in Vietnam time. Exported for tests. */
export function todayVN(): string {
  return new Date(Date.now() + VN_TZ_OFFSET_MS).toISOString().slice(0, 10);
}

/** YYYY-MM-DD of N days before today (Vietnam time). Exported for tests. */
export function isoDaysAgoVN(n: number): string {
  return new Date(Date.now() + VN_TZ_OFFSET_MS - n * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export async function tickStreak(workspaceId: string, userId: string): Promise<StreakTickResult> {
  const today = todayVN();
  const yesterday = isoDaysAgoVN(1);

  // Ensure the row exists (races resolve to a no-op on conflict), then try the
  // atomic conditional update. If it matches 0 rows the streak already ticked today.
  await db
    .insert(streaks)
    .values({
      workspaceId,
      userId,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
    })
    .onConflictDoNothing();

  const tickedRows = await db
    .update(streaks)
    .set({
      currentStreak: sql`CASE WHEN ${streaks.lastActiveDate} = ${yesterday}::date
                          THEN COALESCE(${streaks.currentStreak}, 0) + 1
                          ELSE 1 END`,
      longestStreak: sql`GREATEST(
                           COALESCE(${streaks.longestStreak}, 0),
                           CASE WHEN ${streaks.lastActiveDate} = ${yesterday}::date
                                THEN COALESCE(${streaks.currentStreak}, 0) + 1
                                ELSE 1 END
                         )`,
      lastActiveDate: sql`${today}::date`,
    })
    .where(
      and(
        eq(streaks.workspaceId, workspaceId),
        eq(streaks.userId, userId),
        // IS DISTINCT FROM today → tick at most once per (Vietnamese) day
        or(isNull(streaks.lastActiveDate), lt(streaks.lastActiveDate, sql`${today}::date`)),
      ),
    )
    .returning({
      current: streaks.currentStreak,
      longest: streaks.longestStreak,
    });

  if (tickedRows.length > 0) {
    return { ticked: true, newStreak: tickedRows[0]!.current ?? 1, longest: tickedRows[0]!.longest ?? 1 };
  }

  // Already ticked today — read current state for the response.
  const rows = await db
    .select({ current: streaks.currentStreak, longest: streaks.longestStreak })
    .from(streaks)
    .where(and(eq(streaks.workspaceId, workspaceId), eq(streaks.userId, userId)))
    .limit(1);
  return {
    ticked: false,
    newStreak: rows[0]?.current ?? 0,
    longest: rows[0]?.longest ?? 0,
  };
}
