/**
 * Drizzle schema — Resource library feature.
 *
 * Per-node curated resources (links / videos / docs / books). A node can have
 * many resources contributed by different learners; resources are tenanted by
 * workspace and cascade-delete with both the workspace and the node.
 *
 * SQL DDL lives in drizzle/migrations/0004_node_resources.sql. Re-exported
 * from src/lib/db/schema.ts so callers keep using `@/lib/db/schema`.
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

/** Allowed resource kinds. CHECK constraint in SQL enforces this set. */
export const RESOURCE_KINDS = ['link', 'video', 'doc', 'book'] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const nodeResources = pgTable(
  'node_resources',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    nodeId: uuid('node_id')
      .notNull()
      .references(() => roadmapTreeNodes.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 16 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    url: text('url').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    addedByUserId: uuid('added_by_user_id'),
  },
  (t) => ({
    wsNodeIdx: index('nr_ws_node_idx').on(t.workspaceId, t.nodeId),
  }),
);

export type NodeResource = typeof nodeResources.$inferSelect;
export type NewNodeResource = typeof nodeResources.$inferInsert;
