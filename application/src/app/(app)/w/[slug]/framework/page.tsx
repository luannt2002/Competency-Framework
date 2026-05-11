/**
 * Framework Editor — CRUD UI for categories, skills, levels.
 */
import { eq, asc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { skillCategories, skills, competencyLevels } from '@/lib/db/schema';
import { requireWorkspaceAccess } from '@/lib/workspace';
import { Boxes } from 'lucide-react';
import { FrameworkEditor } from '@/components/framework/framework-editor';

export default async function FrameworkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ws = await requireWorkspaceAccess(slug);

  const [cats, allSkills, levels] = await Promise.all([
    db
      .select()
      .from(skillCategories)
      .where(eq(skillCategories.workspaceId, ws.id))
      .orderBy(asc(skillCategories.displayOrder)),
    db.select().from(skills).where(eq(skills.workspaceId, ws.id)).orderBy(asc(skills.displayOrder)),
    db
      .select()
      .from(competencyLevels)
      .where(eq(competencyLevels.workspaceId, ws.id))
      .orderBy(asc(competencyLevels.displayOrder), asc(competencyLevels.numericValue)),
  ]);

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8 space-y-6">
      <header className="flex items-center gap-3">
        <Boxes className="size-7 text-violet-400" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Framework Editor</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Customize categories, skills, levels for {ws.name}
          </p>
        </div>
      </header>

      <FrameworkEditor
        workspaceSlug={ws.slug}
        categories={cats}
        skills={allSkills}
        levels={levels}
      />
    </div>
  );
}
