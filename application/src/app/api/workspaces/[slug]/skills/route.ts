/**
 * GET /api/workspaces/[slug]/skills
 *
 * Returns SkillRow[] for the current user's view of the workspace.
 * Auth-guarded by Supabase cookies + workspace ownership check.
 */
import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { requireUser } from '@/lib/auth/supabase-server';
import { requireWorkspaceAccess } from '@/lib/workspace';
import { skillCategories, skills, userSkillProgress } from '@/lib/db/schema';
import type { SkillRow } from '@/types';
import { mapErrorToResponse } from '@/lib/api/error-response';

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
        skillId: skills.id,
        skillName: skills.name,
        skillSlug: skills.slug,
        description: skills.description,
        tags: skills.tags,
        categoryId: skillCategories.id,
        categoryName: skillCategories.name,
        categoryColor: skillCategories.color,
        levelCode: userSkillProgress.levelCode,
        targetLevelCode: userSkillProgress.targetLevelCode,
        noteMd: userSkillProgress.noteMd,
        whyThisLevel: userSkillProgress.whyThisLevel,
        evidenceUrls: userSkillProgress.evidenceUrls,
        crowns: userSkillProgress.crowns,
        updatedAt: userSkillProgress.updatedAt,
      })
      .from(skills)
      .innerJoin(skillCategories, eq(skillCategories.id, skills.categoryId))
      .leftJoin(
        userSkillProgress,
        and(
          eq(userSkillProgress.workspaceId, ws.id),
          eq(userSkillProgress.userId, user.id),
          eq(userSkillProgress.skillId, skills.id),
        ),
      )
      .where(eq(skills.workspaceId, ws.id))
      .orderBy(asc(skillCategories.displayOrder), asc(skills.displayOrder));

    return NextResponse.json(rows satisfies SkillRow[]);
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
