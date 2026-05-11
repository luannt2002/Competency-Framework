/**
 * Idempotent ingestion runner — upserts parsed roadmap / sheets data into the
 * canonical Drizzle tables.
 *
 * Re-running on the same inputs must produce the same row counts (no
 * duplicates). All upserts key on the `(workspace_id, slug)` unique indexes
 * defined in {@link ../db/schema}.
 *
 * Sources accepted, all optional:
 *   - `markdownPaths`   → array of PHASE markdown files; one ParsedPhase each.
 *                         Each phase becomes a `level_tracks` row (one per
 *                         level code), populating `weeks` + `labs`.
 *   - `skillsCsvPath`   → categories + skills upsert.
 *   - `levelsCsvPath`   → competency_levels upsert.
 *
 * Activity log: one `activityLog` row with `kind = 'ingestion_run'` per run,
 * payload = the ImportResult.
 *
 * The runner is intentionally not transactional across the whole run — Drizzle
 * + postgres-js + Supabase pooler don't always play well with long
 * transactions. Each upsert is atomic at the row level; the unique indexes
 * provide the idempotency guarantee.
 */
import { readFileSync } from 'node:fs';
import { eq, and } from 'drizzle-orm';
import { db as defaultDb } from '@/lib/db/client';
import {
  workspaces,
  skillCategories,
  skills,
  competencyLevels,
  levelTracks,
  weeks,
  labs,
  activityLog,
} from '@/lib/db/schema';
import { parseMarkdownPhase, type ParsedPhase } from './parse-markdown-roadmap';
import {
  parseSkillsSheetCsv,
  parseLevelsSheetCsv,
  type ParsedSkillsSheet,
  type ParsedLevelsSheet,
} from './parse-google-sheets-csv';
import { toSlug } from '@/lib/utils';

type Db = typeof defaultDb;

export interface IngestionSources {
  markdownPaths?: string[];
  skillsCsvPath?: string;
  levelsCsvPath?: string;
}

export interface IngestionInput {
  workspaceId: string;
  /** Optional override (used by tests). Defaults to the singleton drizzle client. */
  db?: Db;
  sources: IngestionSources;
  /** Optional reviewer userId for the activity_log row. */
  actorUserId?: string;
}

export interface IngestionError {
  /** Free-form pointer at the offending row / file / heading. */
  row: string;
  reason: string;
}

export interface IngestionResult {
  inserted: number;
  updated: number;
  byTable: Record<string, { inserted: number; updated: number }>;
  errors: IngestionError[];
}

const TABLE_KEYS = [
  'skill_categories',
  'skills',
  'competency_levels',
  'level_tracks',
  'weeks',
  'labs',
] as const;

function newResult(): IngestionResult {
  const byTable: IngestionResult['byTable'] = {};
  for (const t of TABLE_KEYS) byTable[t] = { inserted: 0, updated: 0 };
  return { inserted: 0, updated: 0, byTable, errors: [] };
}

function tally(result: IngestionResult, table: string, kind: 'inserted' | 'updated') {
  const bucket = result.byTable[table];
  if (bucket) bucket[kind] += 1;
  result[kind] += 1;
}

/* ============================ workspace guard ============================ */

async function assertWorkspaceExists(db: Db, workspaceId: string): Promise<void> {
  const rows = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!rows[0]) throw new Error('WORKSPACE_NOT_FOUND');
}

/* ============================ levels ============================ */

async function upsertLevels(
  db: Db,
  workspaceId: string,
  sheet: ParsedLevelsSheet,
  result: IngestionResult,
): Promise<void> {
  for (const lvl of sheet.levels) {
    const existing = await db
      .select({ id: competencyLevels.id })
      .from(competencyLevels)
      .where(
        and(
          eq(competencyLevels.workspaceId, workspaceId),
          eq(competencyLevels.code, lvl.code),
        ),
      )
      .limit(1);
    if (existing[0]) {
      await db
        .update(competencyLevels)
        .set({
          label: lvl.label,
          numericValue: lvl.numericValue,
          description: lvl.description,
          examples: lvl.examples,
          color: lvl.color,
          displayOrder: lvl.displayOrder,
        })
        .where(eq(competencyLevels.id, existing[0].id));
      tally(result, 'competency_levels', 'updated');
    } else {
      await db.insert(competencyLevels).values({
        workspaceId,
        code: lvl.code,
        label: lvl.label,
        numericValue: lvl.numericValue,
        description: lvl.description,
        examples: lvl.examples,
        color: lvl.color,
        displayOrder: lvl.displayOrder,
      });
      tally(result, 'competency_levels', 'inserted');
    }
  }
}

/* ============================ skills + categories ============================ */

async function upsertSkillsSheet(
  db: Db,
  workspaceId: string,
  sheet: ParsedSkillsSheet,
  result: IngestionResult,
): Promise<void> {
  for (const cat of sheet.categories) {
    const existingCat = await db
      .select({ id: skillCategories.id })
      .from(skillCategories)
      .where(
        and(
          eq(skillCategories.workspaceId, workspaceId),
          eq(skillCategories.slug, cat.slug),
        ),
      )
      .limit(1);

    let categoryId: string;
    if (existingCat[0]) {
      categoryId = existingCat[0].id;
      await db
        .update(skillCategories)
        .set({
          name: cat.name,
          description: cat.description,
          color: cat.color,
          icon: cat.icon,
          displayOrder: cat.displayOrder,
        })
        .where(eq(skillCategories.id, categoryId));
      tally(result, 'skill_categories', 'updated');
    } else {
      const [inserted] = await db
        .insert(skillCategories)
        .values({
          workspaceId,
          slug: cat.slug,
          name: cat.name,
          description: cat.description,
          color: cat.color,
          icon: cat.icon,
          displayOrder: cat.displayOrder,
        })
        .returning({ id: skillCategories.id });
      if (!inserted) {
        result.errors.push({
          row: `skill_categories:${cat.slug}`,
          reason: 'insert returned no row',
        });
        continue;
      }
      categoryId = inserted.id;
      tally(result, 'skill_categories', 'inserted');
    }

    for (const sk of cat.skills) {
      const existingSk = await db
        .select({ id: skills.id })
        .from(skills)
        .where(and(eq(skills.workspaceId, workspaceId), eq(skills.slug, sk.slug)))
        .limit(1);
      if (existingSk[0]) {
        await db
          .update(skills)
          .set({
            categoryId,
            name: sk.name,
            description: sk.description,
            tags: sk.tags,
            displayOrder: sk.displayOrder,
          })
          .where(eq(skills.id, existingSk[0].id));
        tally(result, 'skills', 'updated');
      } else {
        await db.insert(skills).values({
          workspaceId,
          categoryId,
          slug: sk.slug,
          name: sk.name,
          description: sk.description,
          tags: sk.tags,
          displayOrder: sk.displayOrder,
        });
        tally(result, 'skills', 'inserted');
      }
    }
  }
}

/* ============================ markdown → tracks / weeks / labs ============================ */

async function upsertPhase(
  db: Db,
  workspaceId: string,
  phase: ParsedPhase,
  result: IngestionResult,
): Promise<void> {
  // 1. level_tracks — one per phase, keyed by (workspaceId, levelCode)
  const trackTitle = `${phase.levelCode} · ${phase.phaseTitle}`;
  const existingTrack = await db
    .select({ id: levelTracks.id })
    .from(levelTracks)
    .where(
      and(
        eq(levelTracks.workspaceId, workspaceId),
        eq(levelTracks.levelCode, phase.levelCode),
      ),
    )
    .limit(1);

  let trackId: string;
  if (existingTrack[0]) {
    trackId = existingTrack[0].id;
    await db
      .update(levelTracks)
      .set({
        title: trackTitle,
        description: phase.phaseTitle,
        displayOrder: levelDisplayOrder(phase.levelCode),
      })
      .where(eq(levelTracks.id, trackId));
    tally(result, 'level_tracks', 'updated');
  } else {
    const [inserted] = await db
      .insert(levelTracks)
      .values({
        workspaceId,
        levelCode: phase.levelCode,
        title: trackTitle,
        description: phase.phaseTitle,
        displayOrder: levelDisplayOrder(phase.levelCode),
      })
      .returning({ id: levelTracks.id });
    if (!inserted) {
      result.errors.push({
        row: `level_tracks:${phase.levelCode}`,
        reason: 'insert returned no row',
      });
      return;
    }
    trackId = inserted.id;
    tally(result, 'level_tracks', 'inserted');
  }

  // 2. weeks — keyed by (workspaceId, trackId, weekIndex)
  for (const wk of phase.weeks) {
    const existingWeek = await db
      .select({ id: weeks.id })
      .from(weeks)
      .where(
        and(
          eq(weeks.workspaceId, workspaceId),
          eq(weeks.trackId, trackId),
          eq(weeks.weekIndex, wk.index),
        ),
      )
      .limit(1);

    let weekId: string;
    if (existingWeek[0]) {
      weekId = existingWeek[0].id;
      await db
        .update(weeks)
        .set({
          title: wk.title,
          summary: wk.summary || null,
          goals: wk.goals,
          keywords: wk.keywords,
          estHours: wk.estHours,
          displayOrder: wk.index,
        })
        .where(eq(weeks.id, weekId));
      tally(result, 'weeks', 'updated');
    } else {
      const [inserted] = await db
        .insert(weeks)
        .values({
          workspaceId,
          trackId,
          weekIndex: wk.index,
          title: wk.title,
          summary: wk.summary || null,
          goals: wk.goals,
          keywords: wk.keywords,
          estHours: wk.estHours,
          displayOrder: wk.index,
        })
        .returning({ id: weeks.id });
      if (!inserted) {
        result.errors.push({
          row: `weeks:${phase.levelCode}-${wk.index}`,
          reason: 'insert returned no row',
        });
        continue;
      }
      weekId = inserted.id;
      tally(result, 'weeks', 'inserted');
    }

    // 3. labs — `labs` has no unique slug column; we use a synthetic key
    // (title) per week. We delete-then-insert to keep idempotency.
    if (wk.labs.length > 0) {
      // Delete existing labs for this week so we can re-insert the canonical
      // ordering. Counts as `updated` not `inserted` to avoid the false
      // "all inserts" appearance on a re-run.
      const existingLabs = await db
        .select({ id: labs.id })
        .from(labs)
        .where(and(eq(labs.workspaceId, workspaceId), eq(labs.weekId, weekId)));

      if (existingLabs.length > 0) {
        await db
          .delete(labs)
          .where(and(eq(labs.workspaceId, workspaceId), eq(labs.weekId, weekId)));
      }

      for (let i = 0; i < wk.labs.length; i++) {
        const lab = wk.labs[i];
        if (!lab) continue;
        await db.insert(labs).values({
          workspaceId,
          weekId,
          title: lab.title,
          description: lab.description.slice(0, 4000) || null,
          bodyMd: lab.description || null,
          estMinutes: 60,
          displayOrder: i,
        });
        if (existingLabs.length > 0) {
          tally(result, 'labs', 'updated');
        } else {
          tally(result, 'labs', 'inserted');
        }
      }
    }
  }
}

const LEVEL_ORDER: Record<string, number> = { XS: 0, S: 1, M: 2, L: 3 };
function levelDisplayOrder(code: string): number {
  return LEVEL_ORDER[code] ?? 99;
}

/* ============================ top-level ============================ */

export async function runIngestion(input: IngestionInput): Promise<IngestionResult> {
  const db = input.db ?? defaultDb;
  const result = newResult();

  await assertWorkspaceExists(db, input.workspaceId);

  // 1. Levels CSV
  if (input.sources.levelsCsvPath) {
    try {
      const text = readFileSync(input.sources.levelsCsvPath, 'utf8');
      const sheet = parseLevelsSheetCsv(text);
      await upsertLevels(db, input.workspaceId, sheet, result);
    } catch (err) {
      result.errors.push({
        row: `csv:${input.sources.levelsCsvPath}`,
        reason: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  // 2. Skills CSV
  if (input.sources.skillsCsvPath) {
    try {
      const text = readFileSync(input.sources.skillsCsvPath, 'utf8');
      const sheet = parseSkillsSheetCsv(text);
      await upsertSkillsSheet(db, input.workspaceId, sheet, result);
    } catch (err) {
      result.errors.push({
        row: `csv:${input.sources.skillsCsvPath}`,
        reason: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  // 3. Markdown phases
  if (input.sources.markdownPaths && input.sources.markdownPaths.length > 0) {
    for (const path of input.sources.markdownPaths) {
      try {
        const phase = parseMarkdownPhase(path);
        await upsertPhase(db, input.workspaceId, phase, result);
      } catch (err) {
        result.errors.push({
          row: `markdown:${path}`,
          reason: err instanceof Error ? err.message : 'unknown',
        });
      }
    }
  }

  // 4. Activity log
  try {
    await db.insert(activityLog).values({
      workspaceId: input.workspaceId,
      // Use a synthetic system actor when no human user is on the call path
      // (e.g. CLI bootstrap). The column is `notNull` so we can't insert NULL;
      // we use the workspace owner's user_id as the actor via a subquery.
      userId: input.actorUserId ?? (await resolveWorkspaceOwner(db, input.workspaceId)),
      kind: 'ingestion_run',
      payload: {
        inserted: result.inserted,
        updated: result.updated,
        byTable: result.byTable,
        errors: result.errors,
        sources: input.sources,
      },
    });
  } catch (err) {
    result.errors.push({
      row: 'activity_log',
      reason: err instanceof Error ? err.message : 'unknown',
    });
  }

  return result;
}

async function resolveWorkspaceOwner(db: Db, workspaceId: string): Promise<string> {
  const rows = await db
    .select({ ownerUserId: workspaces.ownerUserId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  const owner = rows[0]?.ownerUserId;
  if (!owner) throw new Error('WORKSPACE_INVALID_OWNER');
  return owner;
}

/** Re-export the slug helper to encourage call-sites to share the same algorithm. */
export { toSlug };
