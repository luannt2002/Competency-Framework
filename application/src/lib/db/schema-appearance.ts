/**
 * Node-type appearance overrides (Phase 1.1 customization).
 * Owners can replace the default Lucide icon with an emoji and recolor each
 * node type (phase / week / lesson / lab / …) for their workspace.
 * Values are palette-whitelisted server-side (see workspace-theme.ts).
 */
import { pgTable, uuid, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { workspaces } from './schema';

export const nodeTypeAppearance = pgTable(
  'node_type_appearance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    nodeType: text('node_type').notNull(),
    /** Emoji from the curated palette (replaces the Lucide icon). */
    icon: text('icon'),
    /** Hex accent from the curated palette. */
    color: text('color'),
    updatedAt: text('updated_at'),
  },
  (t) => ({
    wsTypeUq: uniqueIndex('nta_ws_type_uq').on(t.workspaceId, t.nodeType),
  }),
);
