// @ts-nocheck — one-off CLI to convert flat hierarchy → roadmap_tree_nodes
/**
 * Seed roadmap_tree_nodes from existing level_tracks/weeks/modules/lessons/labs.
 * Idempotent: deletes prior auto-seeded nodes first (marked via meta.autoSeed=true).
 *
 * Hierarchy built:
 *   Root: "DevOps Mastery" (course)
 *     └── Phase per level_track (4)
 *           └── Week per weeks row (12 each, 48 total)
 *                 ├── Session per modules row (with lessons as children)
 *                 │     └── Lesson per lessons row
 *                 └── Lab per labs row (sibling of sessions)
 *
 * Usage: tsx drizzle/scripts/seed-tree-from-tracks.ts <workspace-id>
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, asc, sql as dsql } from 'drizzle-orm';
import {
  workspaces,
  levelTracks,
  weeks as weeksT,
  modules as modulesT,
  lessons as lessonsT,
  labs as labsT,
  roadmapTreeNodes,
} from '../../src/lib/db/schema';

const workspaceId = process.argv[2];
if (!workspaceId) {
  console.error('Usage: seed-tree-from-tracks <workspace-id>');
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL!;
const sql = postgres(dbUrl, { prepare: false, max: 1 });
const db = drizzle(sql);

function slugify(s: string, suffix: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60) + '-' + suffix
  );
}

async function main() {
  console.log('[seed-tree] target workspace=', workspaceId);
  const ws = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  if (!ws[0]) throw new Error('Workspace not found');

  // Wipe prior auto-seeded
  console.log('[seed-tree] removing prior auto-seeded nodes...');
  await db.execute(
    dsql`DELETE FROM roadmap_tree_nodes WHERE workspace_id = ${workspaceId} AND (meta->>'autoSeed')::boolean = true`,
  );

  let counts = { root: 0, phase: 0, week: 0, session: 0, lesson: 0, lab: 0 };

  // ===== Root =====
  const [rootRow] = await db
    .insert(roadmapTreeNodes)
    .values({
      workspaceId,
      parentId: null,
      nodeType: 'course',
      title: 'DevOps Mastery — Lộ trình 12 tháng',
      slug: 'devops-mastery-2026',
      description: '4 giai đoạn · 48 tuần · từ Intern đến Senior Tech Lead',
      bodyMd: null,
      orderIndex: 0,
      estMinutes: 0,
      pathStr: '',
      depth: 0,
      meta: { autoSeed: true, icon: 'GraduationCap', color: '#22D3EE' },
    })
    .returning({ id: roadmapTreeNodes.id });
  const rootId = rootRow.id;
  counts.root = 1;

  // ===== Phases (level_tracks) =====
  const tracks = await db
    .select()
    .from(levelTracks)
    .where(eq(levelTracks.workspaceId, workspaceId))
    .orderBy(asc(levelTracks.displayOrder));

  for (const [ti, track] of tracks.entries()) {
    const [phaseRow] = await db
      .insert(roadmapTreeNodes)
      .values({
        workspaceId,
        parentId: rootId,
        nodeType: 'phase',
        title: `Giai đoạn ${ti + 1}: ${track.title}`,
        slug: slugify(track.title, `phase-${ti}`),
        description: track.description,
        orderIndex: ti,
        depth: 1,
        pathStr: rootId,
        meta: { autoSeed: true, levelCode: track.levelCode },
      })
      .returning({ id: roadmapTreeNodes.id });
    const phaseId = phaseRow.id;
    counts.phase++;

    // Weeks under this phase
    const weeks = await db
      .select()
      .from(weeksT)
      .where(and(eq(weeksT.workspaceId, workspaceId), eq(weeksT.trackId, track.id)))
      .orderBy(asc(weeksT.weekIndex));

    for (const [wi, w] of weeks.entries()) {
      const [weekRow] = await db
        .insert(roadmapTreeNodes)
        .values({
          workspaceId,
          parentId: phaseId,
          nodeType: 'week',
          title: `Tuần ${w.weekIndex}: ${w.title}`,
          slug: slugify(w.title, `${track.levelCode}-w${w.weekIndex}`),
          description: w.summary,
          bodyMd: (w.goals && w.goals.length > 0)
            ? '### Mục tiêu\n' + w.goals.map((g: string) => `- ${g}`).join('\n')
            : null,
          orderIndex: wi,
          estMinutes: (w.estHours ?? 8) * 60,
          depth: 2,
          pathStr: `${rootId}/${phaseId}`,
          meta: { autoSeed: true, levelCode: track.levelCode, weekIndex: w.weekIndex, keywords: w.keywords ?? [] },
        })
        .returning({ id: roadmapTreeNodes.id });
      const weekId = weekRow.id;
      counts.week++;

      // Sessions (modules) under this week
      const mods = await db
        .select()
        .from(modulesT)
        .where(and(eq(modulesT.workspaceId, workspaceId), eq(modulesT.weekId, w.id)))
        .orderBy(asc(modulesT.displayOrder));

      for (const [mi, m] of mods.entries()) {
        const [sessRow] = await db
          .insert(roadmapTreeNodes)
          .values({
            workspaceId,
            parentId: weekId,
            nodeType: 'session',
            title: m.title,
            slug: slugify(m.title, `${track.levelCode}-w${w.weekIndex}-s${mi}`),
            description: m.summary,
            orderIndex: mi,
            depth: 3,
            pathStr: `${rootId}/${phaseId}/${weekId}`,
            meta: { autoSeed: true },
          })
          .returning({ id: roadmapTreeNodes.id });
        const sessId = sessRow.id;
        counts.session++;

        // Lessons under this session
        const lsns = await db
          .select()
          .from(lessonsT)
          .where(and(eq(lessonsT.workspaceId, workspaceId), eq(lessonsT.moduleId, m.id)))
          .orderBy(asc(lessonsT.displayOrder));

        for (const [li, l] of lsns.entries()) {
          await db.insert(roadmapTreeNodes).values({
            workspaceId,
            parentId: sessId,
            nodeType: 'lesson',
            title: l.title,
            slug: slugify(l.title, `${track.levelCode}-w${w.weekIndex}-s${mi}-l${li}`),
            description: null,
            bodyMd: l.introMd,
            orderIndex: li,
            estMinutes: l.estMinutes,
            depth: 4,
            pathStr: `${rootId}/${phaseId}/${weekId}/${sessId}`,
            meta: { autoSeed: true, lessonSlug: l.slug },
          });
          counts.lesson++;
        }
      }

      // Labs under this week (sibling of sessions)
      const labs = await db
        .select()
        .from(labsT)
        .where(and(eq(labsT.workspaceId, workspaceId), eq(labsT.weekId, w.id)))
        .orderBy(asc(labsT.displayOrder));

      for (const [li, lab] of labs.entries()) {
        await db.insert(roadmapTreeNodes).values({
          workspaceId,
          parentId: weekId,
          nodeType: 'lab',
          title: lab.title,
          slug: slugify(lab.title, `${track.levelCode}-w${w.weekIndex}-lab${li}`),
          description: lab.description,
          bodyMd: lab.bodyMd,
          orderIndex: 1000 + li, // labs after sessions in display
          estMinutes: lab.estMinutes ?? 30,
          depth: 3,
          pathStr: `${rootId}/${phaseId}/${weekId}`,
          meta: { autoSeed: true, xpAward: 50 },
        });
        counts.lab++;
      }
    }
  }

  console.log('[seed-tree] Done:', counts);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
