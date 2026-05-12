/**
 * Drizzle schema — RBAC tables.
 *
 * Two new tables backing the 7-tier role model documented in
 * `docs/dev/RBAC_PERMISSIONS.md`:
 *
 *   workspace_members  — explicit grants (editor / contributor / learner / viewer)
 *                        for a workspace OTHER than the owner. The owner is
 *                        implied by `workspaces.owner_user_id` and is never
 *                        listed here.
 *
 *   audit_log          — append-only trail for sensitive mutations. Written by
 *                        `writeAudit()` in `src/lib/rbac/server.ts`. Includes
 *                        actor_role so we can prove the level at the time of
 *                        the action even if grants change later.
 *
 * Both tables are referenced from `src/lib/db/schema.ts` via re-export so the
 * existing `import { ... } from '@/lib/db/schema'` pattern continues to work.
 */
import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { workspaces } from './schema';

/* ============================ workspace_members ============================ */
export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    /**
     * Canonical role name. One of: workspace_editor | workspace_contributor |
     * learner | viewer. Owner is NOT stored here; super_admin is global env.
     */
    role: varchar('role', { length: 32 }).notNull().default('learner'),
    invitedBy: uuid('invited_by'),
    invitedAt: timestamp('invited_at', { withTimezone: true }).defaultNow(),
    joinedAt: timestamp('joined_at', { withTimezone: true }),
  },
  (t) => ({
    wsUserUq: uniqueIndex('workspace_members_ws_user_uq').on(t.workspaceId, t.userId),
    userIdx: index('workspace_members_user_idx').on(t.userId),
  }),
);

/* ============================ audit_log ============================ */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, {
      onDelete: 'set null',
    }),
    actorUserId: uuid('actor_user_id'),
    actorRole: varchar('actor_role', { length: 32 }),
    action: varchar('action', { length: 64 }).notNull(),
    resourceType: varchar('resource_type', { length: 32 }).notNull(),
    resourceId: varchar('resource_id', { length: 128 }),
    before: jsonb('before'),
    after: jsonb('after'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    wsCreatedIdx: index('audit_log_ws_created_idx').on(t.workspaceId, t.createdAt),
    actorCreatedIdx: index('audit_log_actor_created_idx').on(t.actorUserId, t.createdAt),
  }),
);

/* ============================ TYPE HELPERS ============================ */
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert;
export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;
