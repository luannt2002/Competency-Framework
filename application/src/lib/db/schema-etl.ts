/**
 * ETL schema — `import_logs` table for tracking markdown / CSV ingestion runs.
 *
 * Should be re-exported from schema.ts in a follow-up commit; for now imported
 * directly where needed (drizzle migrations will still pick this up via
 * drizzle.config.ts once the schema entrypoint is updated).
 */
import { sql } from 'drizzle-orm';
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { workspaces } from './schema';

/* ============================ ENUMS ============================ */

export const importSourceKindEnum = pgEnum('import_source_kind', [
  'markdown',
  'csv_skills',
  'csv_levels',
]);

export const importStatusEnum = pgEnum('import_status', [
  'running',
  'succeeded',
  'failed',
]);

/* ============================ TABLE ============================ */

/**
 * One row per ETL run. `payload` is the structured result of the run
 * (insert/update counts, per-source breakdown). `error_text` is set when
 * `status = 'failed'`.
 *
 * Run lifecycle:
 *   1. INSERT with status='running', started_at=now()
 *   2. UPDATE with status='succeeded'|'failed', finished_at=now(), payload, error_text
 *
 * Idempotency: re-runs of the same `source_ref` are allowed; we keep the
 * history (append-only).
 */
export const importLogs = pgTable(
  'import_logs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    sourceKind: importSourceKindEnum('source_kind').notNull(),
    sourceRef: text('source_ref').notNull(),
    status: importStatusEnum('status').notNull().default('running'),
    payload: jsonb('payload'),
    errorText: text('error_text'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => ({
    wsKindStartedIdx: index('import_logs_ws_kind_started_idx').on(
      t.workspaceId,
      t.sourceKind,
      t.startedAt,
    ),
  }),
);

/* ============================ TYPE HELPERS ============================ */

export type ImportLog = typeof importLogs.$inferSelect;
export type NewImportLog = typeof importLogs.$inferInsert;

export type ImportSourceKind = 'markdown' | 'csv_skills' | 'csv_levels';
export type ImportStatus = 'running' | 'succeeded' | 'failed';
