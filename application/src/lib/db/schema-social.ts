/**
 * Drizzle schema — Social / community features.
 *
 * Three tables backing the social layer:
 *
 *   node_comments     — threaded discussion attached to any tree node.
 *                        Self-referencing parent_comment_id for replies.
 *                        Cascade-deletes with workspace + node + parent.
 *
 *   workspace_follows — "follow this roadmap" relationship. A user can follow
 *                        any workspace they can read (in practice, public ones).
 *                        UNIQUE(user_id, workspace_id) — idempotent follows.
 *
 *   notifications     — per-user inbox. Recipient-keyed; foreign key to
 *                        workspace is nullable + ON DELETE SET NULL so a
 *                        deleted workspace doesn't kill its notifications.
 *
 * SQL DDL lives in drizzle/migrations/0005_social.sql. Re-exported from
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
  uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { workspaces } from './schema';
import { roadmapTreeNodes } from './schema-tree';

/* ============================ node_comments ============================ */

/**
 * Threaded comments attached to a tree node. `parent_comment_id` self-FK
 * (nullable) makes a single comment either a root or a reply. Depth is
 * unbounded in the DB; the UI caps visual indent at 3 levels.
 */
export const nodeComments = pgTable(
  'node_comments',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    nodeId: uuid('node_id')
      .notNull()
      .references(() => roadmapTreeNodes.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id').notNull(),
    // Self-FK — declared via a function ref so Drizzle handles forward
    // declaration. Cascade-delete when parent is removed.
    parentCommentId: uuid('parent_comment_id').references(
      (): AnyPgColumn => nodeComments.id,
      { onDelete: 'cascade' },
    ),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    wsNodeCreatedIdx: index('nc_ws_node_created_idx').on(
      t.workspaceId,
      t.nodeId,
      t.createdAt,
    ),
    authorIdx: index('nc_author_idx').on(t.authorUserId),
  }),
);

export type NodeComment = typeof nodeComments.$inferSelect;
export type NewNodeComment = typeof nodeComments.$inferInsert;

/* ============================ workspace_follows ============================ */

export const workspaceFollows = pgTable(
  'workspace_follows',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id').notNull(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userWsUq: uniqueIndex('wf_user_ws_uq').on(t.userId, t.workspaceId),
    userIdx: index('wf_user_idx').on(t.userId),
    wsIdx: index('wf_ws_idx').on(t.workspaceId),
  }),
);

export type WorkspaceFollow = typeof workspaceFollows.$inferSelect;
export type NewWorkspaceFollow = typeof workspaceFollows.$inferInsert;

/* ============================ notifications ============================ */

/** Allowed notification kinds. CHECK constraint in SQL enforces the set. */
export const NOTIFICATION_KINDS = [
  'comment.reply',
  'follow.new',
  'invite.received',
  'workspace.shared',
  'milestone.completed',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    recipientUserId: uuid('recipient_user_id').notNull(),
    kind: varchar('kind', { length: 32 }).notNull(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, {
      onDelete: 'set null',
    }),
    resourceType: varchar('resource_type', { length: 32 }),
    resourceId: varchar('resource_id', { length: 128 }),
    title: text('title').notNull(),
    body: text('body'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    recipientUnreadCreatedIdx: index('notif_recipient_unread_created_idx').on(
      t.recipientUserId,
      t.readAt,
      t.createdAt,
    ),
  }),
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
