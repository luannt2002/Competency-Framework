/**
 * Skills Matrix page — Server Component fetches workspace data,
 * delegates interactive UI (filter, drawer) to client component.
 */
import { eq, and, asc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { skills, skillCategories, userSkillProgress, competencyLevels } from '@/lib/db/schema';
import { requireWorkspaceAccess } from '@/lib/workspace';
import { requireUser } from '@/lib/auth/supabase-server';
import { Grid3x3, CheckCircle2, Crown, Layers } from 'lucide-react';
import {
  SkillsTableClient,
  type SkillRow,
} from '@/components/skills/skills-table-client';
import { ExportMenu } from '@/components/skills/export-menu';
import { StatChip } from '@/components/learn/stat-chip';

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

  const assessed = skillRows.filter((r) => r.levelCode).length;
  const totalCrowns = skillRows.reduce((acc, r) => acc + (r.crowns ?? 0), 0);

  return (
    <div
      className="mx-auto max-w-7xl p-6 md:p-10 space-y-8"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
        <div className="flex items-center gap-3">
          <Grid3x3 className="size-7 text-cyan-500" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Skills Matrix</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {skillRows.length} skills · click a row to self-assess
            </p>
          </div>
        </div>
        <div className="md:ml-auto flex items-center gap-2">
          <ExportMenu workspaceSlug={ws.slug} />
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatChip
          icon={Grid3x3}
          label="Total skills"
          value={String(skillRows.length)}
          sub="in this workspace"
          color="text-cyan-500"
        />
        <StatChip
          icon={CheckCircle2}
          label="Self-assessed"
          value={String(assessed)}
          sub={`${skillRows.length - assessed} pending`}
          color="text-emerald-500"
        />
        <StatChip
          icon={Crown}
          label="Crowns earned"
          value={String(totalCrowns)}
          sub="across all skills"
          color="text-yellow-500"
        />
        <StatChip
          icon={Layers}
          label="Levels in rubric"
          value={String(rubricRows.length)}
          sub="competency tiers"
          color="text-purple-500"
        />
      </section>

      <SkillsTableClient workspaceSlug={ws.slug} rows={skillRows} rubric={rubricRows} />
    </div>
  );
}
