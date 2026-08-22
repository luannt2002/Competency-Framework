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
import { todayVN, isoDaysAgoVN } from '@/lib/day-vn';

export type StreakTickResult = {
  ticked: boolean;
  newStreak: number;
  longest: number;
};

// Định nghĩa "hôm nay" nay nằm ở @/lib/day-vn — dùng chung với planner và ô
// "XP hôm nay" trên topbar. Re-export để các chỗ đang import từ đây không vỡ.
export { todayVN, isoDaysAgoVN } from '@/lib/day-vn';

/**
 * Chuỗi ngày học **thực tế tính đến hôm nay**.
 *
 * `streaks.current_streak` chỉ được cập nhật khi người học hoạt động, và không
 * có tiến trình nền nào reset nó. Nghỉ học thì con số cũ nằm nguyên trong bảng:
 * dựng lại được (rà F13) — `last_active_date = 2026-08-01`, hôm nay 21/8, topbar
 * vẫn khoe **Streak 7**. Chuỗi đã đứt từ 20 ngày trước.
 *
 * Không viết tiến trình nền để dọn: tính lúc ĐỌC thì luôn đúng, không cần cron,
 * và không có cửa sổ thời gian nào để hiển thị sai.
 *
 * Chuỗi còn sống khi lần hoạt động cuối là hôm nay hoặc hôm qua — hôm nay chưa
 * học vẫn chưa mất chuỗi, vì ngày còn chưa hết.
 */
export function effectiveStreak(
  currentStreak: number | null | undefined,
  lastActiveDate: string | null | undefined,
  today: string,
  yesterday: string,
): number {
  const n = currentStreak ?? 0;
  if (n <= 0 || !lastActiveDate) return 0;
  return lastActiveDate === today || lastActiveDate === yesterday ? n : 0;
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
