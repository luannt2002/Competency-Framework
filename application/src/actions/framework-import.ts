/**
 * Framework import — paste a PHASE markdown file, get a tree.
 *
 * Parses the standard 4-phase roadmap markdown convention (see
 * parse-markdown-roadmap.ts) and inserts a `phase` root node + `week`
 * children (with goals/keywords/topics/labs in bodyMd) into
 * roadmap_tree_nodes for the workspace.
 */
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaces, roadmapTreeNodes } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/supabase-server';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { requireMinLevel, writeAudit, RBACError } from '@/lib/rbac/server';
import { parseMarkdownPhaseText } from '@/lib/etl/parse-markdown-roadmap';
import { toSlug } from '@/lib/utils';

const input = z.object({
  workspaceSlug: z.string(),
  markdown: z.string().min(50).max(500_000),
});

export type ImportResult = {
  phaseTitle: string;
  weeksImported: number;
  rootSlug: string;
};

async function uniqueSlug(workspaceId: string, base: string): Promise<string> {
  let slug = base;
  let counter = 2;
  for (;;) {
    const hit = await db
      .select({ id: roadmapTreeNodes.id })
      .from(roadmapTreeNodes)
      .where(and(eq(roadmapTreeNodes.workspaceId, workspaceId), eq(roadmapTreeNodes.slug, slug)))
      .limit(1);
    if (!hit[0]) return slug;
    slug = `${base}-${counter++}`;
  }
}

export async function importMarkdownPhase(
  workspaceSlug: string,
  markdown: string,
): Promise<ImportResult> {
  const parsed = input.parse({ workspaceSlug, markdown });

  const user = await requireUser();
  const rows = await db
    .select({ id: workspaces.id, slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.slug, parsed.workspaceSlug))
    .limit(1);
  const ws = rows[0];
  if (!ws) throw new Error('WORKSPACE_NOT_FOUND_OR_FORBIDDEN');
  try {
    await requireMinLevel(ws.id, RBAC_LEVELS.OWNER);
  } catch (err) {
    if (err instanceof RBACError) throw new Error('WORKSPACE_NOT_FOUND_OR_FORBIDDEN');
    throw err;
  }

  // Parse (throws on malformed input — mapped by the caller's error surface)
  const phase = parseMarkdownPhaseText(parsed.markdown);
  if (phase.weeks.length === 0) {
    throw new Error('INGESTION_VALIDATION_FAILED');
  }

  // Root phase node
  const rootSlug = await uniqueSlug(ws.id, toSlug(phase.phaseTitle) || `phase-${Date.now()}`);
  const [root] = await db
    .insert(roadmapTreeNodes)
    .values({
      workspaceId: ws.id,
      parentId: null,
      nodeType: 'phase',
      title: phase.phaseTitle,
      slug: rootSlug,
      description: `${phase.quarter} · ${phase.levelCode} — import từ markdown (${phase.weeks.length} tuần)`,
      orderIndex: 0,
      pathStr: '',
      depth: 0,
      meta: {},
    })
    .returning({ id: roadmapTreeNodes.id });
  if (!root) throw new Error('INSERT_FAILED');

  // Week children
  for (let i = 0; i < phase.weeks.length; i++) {
    const wk = phase.weeks[i]!;
    const body = [
      wk.summary && `> ${wk.summary}`,
      wk.goals.length > 0 && `## Mục tiêu\n${wk.goals.map((g) => `- ${g}`).join('\n')}`,
      wk.keywords.length > 0 && `## Keywords\n${wk.keywords.map((k) => `\`${k}\``).join(' · ')}`,
      wk.mainTopics.length > 0 && `## Chủ đề chính\n${wk.mainTopics.map((t) => `- ${t}`).join('\n')}`,
      wk.labs.length > 0 && `## Labs\n${wk.labs.map((l) => `- 🧪 **${l.title}** — ${l.description}`).join('\n')}`,
      wk.resources.length > 0 && `## Tài liệu\n${wk.resources.map((r) => `- ${r}`).join('\n')}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const weekSlug = await uniqueSlug(ws.id, toSlug(`${wk.title}-w${i + 1}`) || `week-${i + 1}`);
    await db.insert(roadmapTreeNodes).values({
      workspaceId: ws.id,
      parentId: root.id,
      nodeType: 'week',
      title: wk.title,
      slug: weekSlug,
      description: wk.summary || null,
      bodyMd: body || null,
      orderIndex: i,
      estMinutes: wk.estHours * 60,
      pathStr: root.id,
      depth: 1,
      meta: { keywords: wk.keywords },
    });
  }

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: 'workspace_owner',
    action: 'framework.import_markdown',
    resourceType: 'tree_node',
    resourceId: root.id,
    after: { phaseTitle: phase.phaseTitle, weeks: phase.weeks.length },
  });

  revalidatePath(`/w/${ws.slug}`);
  return { phaseTitle: phase.phaseTitle, weeksImported: phase.weeks.length, rootSlug };
}
