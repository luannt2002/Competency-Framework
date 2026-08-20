/**
 * Where does a daily task actually take you?
 *
 * `daily_tasks` stores a `(ref_kind, ref_id)` pair and nothing else — the
 * planner emits `node`, `lesson`, `lab`, `skill`, `exercise` and `custom`
 * refs, and until now the Today list rendered every one of them as inert text.
 * A plan you cannot click is a checklist, not a planner.
 *
 * This module turns those refs into destinations. The rule it encodes:
 * **send the learner to the deepest place they can act.** A node whose lesson
 * has exercises goes straight to the runner; a node without exercises goes to
 * the node page; a ref pointing at a table with no page at all resolves to
 * null and stays inert rather than linking somewhere misleading.
 *
 * Batched: at most three queries no matter how many tasks, all workspace-scoped.
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { lessons, roadmapTreeNodes } from '@/lib/db/schema';
import { openExercises } from '@/lib/db/schema-exercises';

/** The task fields this module needs — deliberately not the whole row. */
export type TaskRefLike = {
  id: string;
  refKind: string;
  refId: string;
};

export type TaskTarget = {
  href: string;
  /** Short verb for the link, e.g. "Làm bài" vs "Mở". */
  action: string;
};

/** Node id -> its slug and how many exercises its lesson carries. */
type NodeTarget = { slug: string; exerciseCount: number };

function nodeHref(workspaceSlug: string, target: NodeTarget): TaskTarget {
  return target.exerciseCount > 0
    ? { href: `/w/${workspaceSlug}/n/${target.slug}/practice`, action: 'Làm bài' }
    : { href: `/w/${workspaceSlug}/n/${target.slug}`, action: 'Mở' };
}

/**
 * Exercises are counted by LEFT JOIN + GROUP BY, not by a correlated subquery
 * inside a sql`` template.
 *
 * Drizzle renders column references inside a raw template unqualified, so
 * `WHERE ${openExercises.lessonId} = ${lessons.id}` becomes
 * `WHERE "lesson_id" = "id"` and Postgres resolves both against the subquery's
 * own table — a self-comparison that returns zero and looks like "no exercises
 * authored". With a real join in the statement drizzle qualifies every name,
 * which is why the expression below is safe and the subquery was not.
 */
const exerciseCountExpr = sql<number>`count(${openExercises.id})::int`;

/** Node meta -> lessons.slug, the one join between the two learning surfaces. */
const lessonSlugOfNode = sql`${roadmapTreeNodes.meta}->>'lessonSlug'`;

async function loadNodeTargets(
  workspaceId: string,
  nodeIds: string[],
): Promise<Map<string, NodeTarget>> {
  if (nodeIds.length === 0) return new Map();
  const rows = await db
    .select({
      id: roadmapTreeNodes.id,
      slug: roadmapTreeNodes.slug,
      exerciseCount: exerciseCountExpr,
    })
    .from(roadmapTreeNodes)
    .leftJoin(
      lessons,
      and(
        eq(lessons.workspaceId, roadmapTreeNodes.workspaceId),
        eq(lessons.slug, lessonSlugOfNode),
      ),
    )
    .leftJoin(openExercises, eq(openExercises.lessonId, lessons.id))
    .where(
      and(eq(roadmapTreeNodes.workspaceId, workspaceId), inArray(roadmapTreeNodes.id, nodeIds)),
    )
    .groupBy(roadmapTreeNodes.id, roadmapTreeNodes.slug);

  return new Map(
    rows.map((r) => [r.id, { slug: r.slug, exerciseCount: r.exerciseCount ?? 0 }]),
  );
}

/** Lesson id -> the node that runs it (lessons themselves have no page). */
async function loadLessonTargets(
  workspaceId: string,
  lessonIds: string[],
): Promise<Map<string, NodeTarget>> {
  if (lessonIds.length === 0) return new Map();
  const rows = await db
    .select({
      lessonId: lessons.id,
      slug: roadmapTreeNodes.slug,
      exerciseCount: exerciseCountExpr,
    })
    .from(lessons)
    .innerJoin(
      roadmapTreeNodes,
      and(
        eq(roadmapTreeNodes.workspaceId, lessons.workspaceId),
        eq(lessonSlugOfNode, lessons.slug),
      ),
    )
    .leftJoin(openExercises, eq(openExercises.lessonId, lessons.id))
    .where(and(eq(lessons.workspaceId, workspaceId), inArray(lessons.id, lessonIds)))
    .groupBy(lessons.id, roadmapTreeNodes.slug);

  return new Map(
    rows.map((r) => [r.lessonId, { slug: r.slug, exerciseCount: r.exerciseCount ?? 0 }]),
  );
}

/** Exercise id -> the lesson it belongs to (streak-keeper tasks ref an exercise). */
async function loadExerciseLessons(
  workspaceId: string,
  exerciseIds: string[],
): Promise<Map<string, string>> {
  if (exerciseIds.length === 0) return new Map();
  const rows = await db
    .select({ id: openExercises.id, lessonId: openExercises.lessonId })
    .from(openExercises)
    .where(
      and(
        eq(openExercises.workspaceId, workspaceId),
        inArray(openExercises.id, exerciseIds),
      ),
    );
  return new Map(rows.map((r) => [r.id, r.lessonId]));
}

/**
 * Resolve every task to a destination, keyed by task id.
 *
 * Tasks that cannot be resolved are simply absent from the map. The caller
 * renders those as plain rows — a dead link is worse than no link.
 */
export async function resolveTaskTargets(params: {
  workspaceId: string;
  workspaceSlug: string;
  tasks: readonly TaskRefLike[];
}): Promise<Map<string, TaskTarget>> {
  const { workspaceId, workspaceSlug, tasks } = params;
  const idsOf = (kind: string) =>
    [...new Set(tasks.filter((t) => t.refKind === kind).map((t) => t.refId))];

  const exerciseIds = idsOf('exercise');
  const [nodeTargets, exerciseLessons] = await Promise.all([
    loadNodeTargets(workspaceId, idsOf('node')),
    loadExerciseLessons(workspaceId, exerciseIds),
  ]);

  // Exercise refs resolve through their lesson, so their lesson ids join the
  // lesson lookup instead of costing a second round trip.
  const lessonIds = [...new Set([...idsOf('lesson'), ...exerciseLessons.values()])];
  const lessonTargets = await loadLessonTargets(workspaceId, lessonIds);

  const out = new Map<string, TaskTarget>();
  for (const task of tasks) {
    switch (task.refKind) {
      case 'node': {
        const target = nodeTargets.get(task.refId);
        if (target) out.set(task.id, nodeHref(workspaceSlug, target));
        break;
      }
      case 'lesson': {
        const target = lessonTargets.get(task.refId);
        if (target) out.set(task.id, nodeHref(workspaceSlug, target));
        break;
      }
      case 'exercise': {
        const lessonId = exerciseLessons.get(task.refId);
        const target = lessonId ? lessonTargets.get(lessonId) : undefined;
        if (target) out.set(task.id, nodeHref(workspaceSlug, target));
        break;
      }
      case 'skill':
        // The skills grid is the only page that renders a single skill.
        out.set(task.id, { href: `/w/${workspaceSlug}/skills`, action: 'Xem kỹ năng' });
        break;
      default:
        // `lab` and `custom` have no destination yet — leave them inert.
        break;
    }
  }
  return out;
}
