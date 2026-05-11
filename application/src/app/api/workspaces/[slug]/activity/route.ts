/**
 * GET /api/workspaces/[slug]/activity
 *
 * Returns the latest 20 ActivityEntry rows for the current user in the workspace,
 * newest first.
 */
import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { requireUser } from '@/lib/auth/supabase-server';
import { requireWorkspaceAccess } from '@/lib/workspace';
import { activityLog } from '@/lib/db/schema';
import type { ActivityEntry } from '@/types';
import { mapErrorToResponse } from '@/lib/api/error-response';

const ACTIVITY_LIMIT = 20;

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
        id: activityLog.id,
        kind: activityLog.kind,
        payload: activityLog.payload,
        createdAt: activityLog.createdAt,
      })
      .from(activityLog)
      .where(and(eq(activityLog.workspaceId, ws.id), eq(activityLog.userId, user.id)))
      .orderBy(desc(activityLog.createdAt))
      .limit(ACTIVITY_LIMIT);

    return NextResponse.json(rows satisfies ActivityEntry[]);
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
