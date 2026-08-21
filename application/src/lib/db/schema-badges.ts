/**
 * schema-badges.ts — F16 custom badge management.
 *
 * `badges` physically lives in `schema.ts` but WITHOUT the `is_active` column
 * added by migration 0013 (schema.ts is frozen for this change set). Rather
 * than edit it, this file declares a typed mirror of the SAME physical table
 * (`pgTable('badges', …)`) including the new column. All badge-CRUD code uses
 * this definition; `schema.ts`'s `badges` remains untouched and still works
 * for existing readers (it simply doesn't select is_active).
 *
 * Column list mirrors drizzle/migrations/0000 + 0013 exactly.
 */
import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  jsonb,
  boolean,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const badgesAdmin = pgTable(
  'badges',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    icon: text('icon'),
    rule: jsonb('rule'),
    // Added by 0013_badges_is_active.sql — soft deactivate; earned rows stay.
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => ({
    wsSlugUq: uniqueIndex('badges_ws_slug_uq').on(t.workspaceId, t.slug),
  }),
);
