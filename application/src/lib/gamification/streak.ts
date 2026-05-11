/**
 * Streak tick logic — call after a user completes any lesson.
 * Mutates streaks row. Returns whether the streak ticked this call (i.e. first lesson today).
 */
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { streaks } from '@/lib/db/schema';

export type StreakTickResult = {
  ticked: boolean;
  newStreak: number;
  longest: number;
};

export async function tickStreak(workspaceId: string, userId: string): Promise<StreakTickResult> {
  const today = todayIsoLocal(); // YYYY-MM-DD in server tz (good enough for MVP)
  const yesterday = isoDaysAgo(1);

  const rows = await db
    .select()
    .from(streaks)
    .where(and(eq(streaks.workspaceId, workspaceId), eq(streaks.userId, userId)))
    .limit(1);

  if (rows.length === 0) {
    await db.insert(streaks).values({
      workspaceId,
      userId,
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDate: today,
    });
    return { ticked: true, newStreak: 1, longest: 1 };
  }

  const s = rows[0]!;
  const lastDate = s.lastActiveDate ? String(s.lastActiveDate) : null;

  if (lastDate === today) {
    return { ticked: false, newStreak: s.currentStreak ?? 0, longest: s.longestStreak ?? 0 };
  }

  let newStreak: number;
  if (lastDate === yesterday) {
    newStreak = (s.currentStreak ?? 0) + 1;
  } else {
    newStreak = 1;
  }
  const newLongest = Math.max(s.longestStreak ?? 0, newStreak);

  await db
    .update(streaks)
    .set({
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastActiveDate: today,
    })
    .where(and(eq(streaks.workspaceId, workspaceId), eq(streaks.userId, userId)));

  return { ticked: true, newStreak, longest: newLongest };
}

function todayIsoLocal(): string {
  return new Date().toISOString().slice(0, 10);
}
function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
