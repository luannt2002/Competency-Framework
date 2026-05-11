/**
 * GET /api/workspaces/[slug]/hearts
 *
 * Returns the user's `Hearts` row from DB. If no row exists yet (e.g. user
 * just forked but hearts init hasn't run), returns the explicit empty shape
 * `{ current: 0, max: 5, nextRefillAt: null }` — this is NOT a fake "5/5"
 * fallback; it surfaces the absence so the UI can render an empty state.
 *
 * The `max: 5` is the schema default for the column (see schema.ts), not a
 * fabricated business value — it is what the DB will provision on first insert.
 */
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { requireUser } from '@/lib/auth/supabase-server';
import { requireWorkspaceAccess } from '@/lib/workspace';
import { hearts } from '@/lib/db/schema';
import type { Hearts } from '@/types';
import { mapErrorToResponse } from '@/lib/api/error-response';

/**
 * Explicit empty Hearts — used ONLY when no row exists for (workspace, user).
 * Not a fallback for real data. `max: 5` mirrors the DB column default so the
 * UI never silently assumes a different cap.
 */
const EMPTY_HEARTS: Hearts = {
  current: 0,
  max: 5,
  nextRefillAt: null,
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
        current: hearts.current,
        max: hearts.max,
        nextRefillAt: hearts.nextRefillAt,
      })
      .from(hearts)
      .where(and(eq(hearts.workspaceId, ws.id), eq(hearts.userId, user.id)))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return NextResponse.json(EMPTY_HEARTS satisfies Hearts);
    }

    // The drizzle columns are nullable at the type level due to defaults; we
    // still return the underlying value (not a fabricated fallback). Falling
    // back to 0/0/null only happens if the DB itself stored NULL, which is the
    // explicit-empty case.
    const payload: Hearts = {
      current: row.current ?? 0,
      max: row.max ?? 0,
      nextRefillAt: row.nextRefillAt,
    };
    return NextResponse.json(payload);
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
