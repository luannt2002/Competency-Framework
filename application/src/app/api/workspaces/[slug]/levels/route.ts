/**
 * GET /api/workspaces/[slug]/levels
 *
 * Returns CompetencyLevel[] ordered by display_order asc for the workspace.
 */
import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { requireWorkspaceAccess } from '@/lib/workspace';
import { competencyLevels } from '@/lib/db/schema';
import type { CompetencyLevel } from '@/types';
import { mapErrorToResponse } from '@/lib/api/error-response';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const ws = await requireWorkspaceAccess(slug);

    const rows = await db
      .select({
        id: competencyLevels.id,
        code: competencyLevels.code,
        label: competencyLevels.label,
        numericValue: competencyLevels.numericValue,
        description: competencyLevels.description,
        examples: competencyLevels.examples,
        color: competencyLevels.color,
        displayOrder: competencyLevels.displayOrder,
      })
      .from(competencyLevels)
      .where(eq(competencyLevels.workspaceId, ws.id))
      .orderBy(asc(competencyLevels.displayOrder));

    return NextResponse.json(rows satisfies CompetencyLevel[]);
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
