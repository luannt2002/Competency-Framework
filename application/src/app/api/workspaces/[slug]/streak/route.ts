/**
 * GET /api/workspaces/[slug]/streak
 *
 * Returns the user's Streak row from DB. If no row exists, returns the
 * explicit empty shape `{ currentStreak: 0, longestStreak: 0,
 * lastActiveDate: null, freezeCount: 0 }` — those are factual zeros, not
 * fabricated defaults: the user has not logged any activity yet.
 */
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { requireUser } from '@/lib/auth/supabase-server';
import { requireWorkspaceAccess } from '@/lib/workspace';
import { streaks } from '@/lib/db/schema';
import type { Streak } from '@/types';
import { mapErrorToResponse } from '@/lib/api/error-response';

/** Explicit empty Streak — factual zeros, only used when no DB row exists. */
const EMPTY_STREAK: Streak = {
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: null,
  freezeCount: 0,
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const user = await requireUser();
    const ws = await requireWorkspaceAccess(slug);

    const rows = await db
      .select({
        currentStreak: streaks.currentStreak,
        longestStreak: streaks.longestStreak,
        lastActiveDate: streaks.lastActiveDate,
        freezeCount: streaks.freezeCount,
      })
      .from(streaks)
      .where(and(eq(streaks.workspaceId, ws.id), eq(streaks.userId, user.id)))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return NextResponse.json(EMPTY_STREAK satisfies Streak);
    }

    const payload: Streak = {
      currentStreak: row.currentStreak ?? 0,
      longestStreak: row.longestStreak ?? 0,
      lastActiveDate: row.lastActiveDate ?? null,
      freezeCount: row.freezeCount ?? 0,
    };
    return NextResponse.json(payload);
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
