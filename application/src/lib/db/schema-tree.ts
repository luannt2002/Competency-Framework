/**
 * Generic recursive roadmap_tree_nodes — flexible n-depth hierarchy.
 *
 * Unlike the rigid level_tracks → weeks → modules → lessons → exercises chain,
 * this table supports ARBITRARY depth + user-defined node types so a workspace
 * can model e.g.:
 *   Course (AWS) → Phase 1 → Stage A → Session → Lesson / Theory / Lab / Project
 *
 * Adjacency list (parent_id). Path field for fast subtree queries.
 *
 * Should be re-exported from schema.ts in a follow-up commit.
 */
import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { workspaces } from './schema';

/**
 * Node kinds — extensible. User-defined kinds beyond these are stored as `meta.customKind`.
 * Built-ins (icon + UI affordances): course, phase, stage, week, session, module,
 * lesson, theory, lab, project, task, milestone, exam, capstone, custom.
 */
export const roadmapTreeNodes = pgTable(
  'roadmap_tree_nodes',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'), // nullable: roots have no parent
    nodeType: text('node_type').notNull(), // course | phase | stage | week | session | module | lesson | theory | lab | project | task | milestone | exam | capstone | custom
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    bodyMd: text('body_md'),
    orderIndex: integer('order_index').notNull().default(0),
    estMinutes: integer('est_minutes'),
    /** Free-form metadata: skills mapped, level, xp award, links, custom fields */
    meta: jsonb('meta').default({}),
    /** materialized ancestry path "/" delimited (e.g. "uuid1/uuid2/uuid3") for fast subtree query */
    pathStr: text('path_str').notNull().default(''),
    depth: integer('depth').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    wsSlugUq: uniqueIndex('rtn_ws_slug_uq').on(t.workspaceId, t.slug),
    wsParentIdx: index('rtn_ws_parent_idx').on(t.workspaceId, t.parentId, t.orderIndex),
    wsTypeIdx: index('rtn_ws_type_idx').on(t.workspaceId, t.nodeType),
    pathIdx: index('rtn_path_idx').on(t.workspaceId, t.pathStr),
  }),
);

export const userNodeProgress = pgTable(
  'user_node_progress',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    nodeId: uuid('node_id')
      .notNull()
      .references(() => roadmapTreeNodes.id, { onDelete: 'cascade' }),
    status: text('status').default('todo'), // todo | doing | done | skipped
    completedAt: timestamp('completed_at', { withTimezone: true }),
    evidenceUrls: text('evidence_urls').array().default(sql`'{}'::text[]`),
    note: text('note'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    wsUserNodeUq: uniqueIndex('unp_ws_user_node_uq').on(t.workspaceId, t.userId, t.nodeId),
    wsUserIdx: index('unp_ws_user_idx').on(t.workspaceId, t.userId),
  }),
);
