/**
 * Drizzle schema — Journal / Posts feature.
 *
 * Per-node blog-style entries. One node (Week / Session / Lesson / any) can
 * have many journal entries authored by different users. Supports the
 * recurring use case: "1 buổi có nhiều bài post/blog/bài học/lab".
 *
 * SQL DDL lives in drizzle/migrations/0003_node_journal.sql. Re-exported from
 * src/lib/db/schema.ts so callers keep using `@/lib/db/schema`.
 */
import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { workspaces } from './schema';
import { roadmapTreeNodes } from './schema-tree';

export const nodeJournalEntries = pgTable(
  'node_journal_entries',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    nodeId: uuid('node_id')
      .notNull()
      .references(() => roadmapTreeNodes.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    bodyMd: text('body_md').notNull(),
    tags: text('tags').array().default(sql`'{}'::text[]`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    wsNodeCreatedIdx: index('nje_ws_node_created_idx').on(
      t.workspaceId,
      t.nodeId,
      t.createdAt,
    ),
    authorIdx: index('nje_author_idx').on(t.authorUserId),
  }),
);

export type NodeJournalEntry = typeof nodeJournalEntries.$inferSelect;
export type NewNodeJournalEntry = typeof nodeJournalEntries.$inferInsert;
