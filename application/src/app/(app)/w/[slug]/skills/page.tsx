/**
 * Skills Matrix page — Server Component fetches workspace data,
 * delegates interactive UI (filter, drawer) to client component.
 */
import { eq, and, asc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { skills, skillCategories, userSkillProgress, competencyLevels } from '@/lib/db/schema';
import { requireWorkspaceAccess } from '@/lib/workspace';
import { requireUser } from '@/lib/auth/supabase-server';
import { Grid3x3 } from 'lucide-react';
import {
  SkillsTableClient,
  type SkillRow,
} from '@/components/skills/skills-table-client';
import { ExportMenu } from '@/components/skills/export-menu';

export default async function SkillsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ws = await requireWorkspaceAccess(slug);
  const user = await requireUser();

  // Skills + category + user progress (parallel queries via Promise.all)
  const [rows, rubricRows] = await Promise.all([
    db
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
      .innerJoin(skillCategories, eq(skills.categoryId, skillCategories.id))
      .leftJoin(
        userSkillProgress,
        and(
          eq(userSkillProgress.skillId, skills.id),
          eq(userSkillProgress.userId, user.id),
          eq(userSkillProgress.workspaceId, ws.id),
        ),
      )
      .where(eq(skills.workspaceId, ws.id))
      .orderBy(asc(skillCategories.displayOrder), asc(skills.displayOrder), asc(skills.name)),

    db
      .select({
        code: competencyLevels.code,
        label: competencyLevels.label,
        description: competencyLevels.description,
        examples: competencyLevels.examples,
      })
      .from(competencyLevels)
      .where(eq(competencyLevels.workspaceId, ws.id))
      .orderBy(asc(competencyLevels.displayOrder), asc(competencyLevels.numericValue)),
  ]);

  const skillRows: SkillRow[] = rows.map((r) => ({
    skillId: r.skillId,
    skillName: r.skillName,
    skillSlug: r.skillSlug,
    description: r.description,
    tags: r.tags ?? null,
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    categoryColor: r.categoryColor,
    levelCode: r.levelCode,
    targetLevelCode: r.targetLevelCode,
    noteMd: r.noteMd,
    whyThisLevel: r.whyThisLevel,
    evidenceUrls: r.evidenceUrls ?? null,
    crowns: r.crowns,
    updatedAt: r.updatedAt,
  }));

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8 space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
        <div className="flex items-center gap-3">
          <Grid3x3 className="size-6 text-cyan-400" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Skills Matrix</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {skillRows.length} skills · click a row to self-assess
            </p>
          </div>
        </div>
        <div className="md:ml-auto">
          <ExportMenu workspaceSlug={ws.slug} />
        </div>
      </header>

      <SkillsTableClient workspaceSlug={ws.slug} rows={skillRows} rubric={rubricRows} />
    </div>
  );
}
