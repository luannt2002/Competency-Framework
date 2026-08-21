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
import { requireUser } from '@/lib/auth/supabase-server';
import { requireWorkspaceAccess } from '@/lib/workspace';
import { readHearts } from '@/lib/gamification/hearts';
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

    // `readHearts` áp CẢ hai chiều rồi mới trả số: hồi phục theo giờ (F10) và
    // hao vì nghỉ học (F8). Dùng thẳng `applyHeartRefills` sẽ bỏ qua vế hao.
    const row = await readHearts(ws.id, user.id);
    if (!row) {
      return NextResponse.json(EMPTY_HEARTS satisfies Hearts);
    }

    // applyHeartRefills returns the post-refill values (not a fabricated
    // fallback); the explicit-empty case (no row) was handled above.
    const payload: Hearts = {
      current: row.current,
      max: row.max,
      nextRefillAt: row.nextRefillAt,
    };
    return NextResponse.json(payload);
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
