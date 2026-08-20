/**
 * The bridge between the two learning surfaces this app carries.
 *
 * `roadmap_tree_nodes` is the canvas a workspace draws its path on — arbitrary
 * depth, arbitrary node types, the thing every learner-facing URL points at.
 * `lessons` + `exercises` is the older rigid chain (track -> week -> module ->
 * lesson -> exercise) that all 72 authored exercises still hang off.
 *
 * The importer already linked them: a node of type `lesson` carries
 * `meta.lessonSlug`, matching `lessons.slug` inside the same workspace. That
 * one string is the only join between the surfaces, and this module is the
 * only place that knows it — so if the link ever becomes a real FK, exactly
 * one file changes.
 *
 * Every query here is workspace-scoped.
 */
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { lessons, roadmapTreeNodes } from '@/lib/db/schema';
import { openExercises } from '@/lib/db/schema-exercises';

/**
 * Read `meta.lessonSlug` off a node. Pure.
 *
 * Returns null for every shape that is not a usable slug, so a hand-edited
 * `meta` cannot turn into a lookup for the empty string.
 */
export function lessonSlugOfNodeMeta(meta: unknown): string | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const raw = (meta as Record<string, unknown>).lessonSlug;
  if (typeof raw !== 'string') return null;
  const slug = raw.trim();
  return slug === '' ? null : slug;
}

/** A node's runnable lesson, with enough detail to render the CTA. */
export type NodeLesson = {
  lessonId: string;
  lessonSlug: string;
  title: string;
  estMinutes: number;
  exerciseCount: number;
};

/**
 * Find the lesson a node runs, or null when the node is not lesson-backed.
 *
 * A node whose lesson exists but has zero exercises still resolves — the
 * caller decides whether "0 exercises" is worth a button. Hiding it here
 * would make "why is there no practice section?" undebuggable.
 */
export async function findNodeLesson(params: {
  workspaceId: string;
  nodeMeta: unknown;
}): Promise<NodeLesson | null> {
  const lessonSlug = lessonSlugOfNodeMeta(params.nodeMeta);
  if (lessonSlug === null) return null;

  const rows = await db
    .select({
      lessonId: lessons.id,
      lessonSlug: lessons.slug,
      title: lessons.title,
      estMinutes: lessons.estMinutes,
    })
    .from(lessons)
    .where(and(eq(lessons.workspaceId, params.workspaceId), eq(lessons.slug, lessonSlug)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // Counted with its own statement rather than a correlated subquery inside a
  // sql`` template: drizzle emits column references UNQUALIFIED there, so
  // `WHERE ${openExercises.lessonId} = ${lessons.id}` renders as
  // `WHERE "lesson_id" = "id"` and Postgres resolves BOTH names against the
  // subquery's own table — a self-comparison that silently counts zero.
  const counted = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(openExercises)
    .where(
      and(
        eq(openExercises.workspaceId, params.workspaceId),
        eq(openExercises.lessonId, row.lessonId),
      ),
    );

  return {
    lessonId: row.lessonId,
    lessonSlug: row.lessonSlug,
    title: row.title,
    estMinutes: row.estMinutes ?? 8,
    exerciseCount: counted[0]?.n ?? 0,
  };
}

/**
 * Reverse direction: which node runs this lesson?
 *
 * Needed by anything holding a legacy `lessons.id` — a daily task, a
 * notification — that has to send the learner to a URL. Lessons have no page
 * of their own; nodes do.
 */
export async function findNodeSlugForLesson(params: {
  workspaceId: string;
  lessonId: string;
}): Promise<string | null> {
  const rows = await db
    .select({ slug: roadmapTreeNodes.slug })
    .from(roadmapTreeNodes)
    .innerJoin(
      lessons,
      and(
        eq(lessons.workspaceId, roadmapTreeNodes.workspaceId),
        eq(lessons.slug, sql`${roadmapTreeNodes.meta}->>'lessonSlug'`),
      ),
    )
    .where(
      and(eq(roadmapTreeNodes.workspaceId, params.workspaceId), eq(lessons.id, params.lessonId)),
    )
    .limit(1);
  return rows[0]?.slug ?? null;
}

/** The node that runs the lesson an exercise belongs to. */
export async function findNodeSlugForExercise(params: {
  workspaceId: string;
  exerciseId: string;
}): Promise<string | null> {
  const rows = await db
    .select({ lessonId: openExercises.lessonId })
    .from(openExercises)
    .where(
      and(
        eq(openExercises.workspaceId, params.workspaceId),
        eq(openExercises.id, params.exerciseId),
      ),
    )
    .limit(1);
  const lessonId = rows[0]?.lessonId;
  if (!lessonId) return null;
  return findNodeSlugForLesson({ workspaceId: params.workspaceId, lessonId });
}
