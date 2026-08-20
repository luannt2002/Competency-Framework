/**
 * Read helpers for node-type appearance overrides.
 */
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { nodeTypeAppearance } from '@/lib/db/schema';

export type NodeTypeOverrideMap = Record<string, { icon: string | null; color: string | null }>;

/** Fetch all overrides for a workspace as a nodeType → {icon, color} map. */
export async function getNodeTypeOverrides(workspaceId: string): Promise<NodeTypeOverrideMap> {
  const rows = await db
    .select({
      nodeType: nodeTypeAppearance.nodeType,
      icon: nodeTypeAppearance.icon,
      color: nodeTypeAppearance.color,
    })
    .from(nodeTypeAppearance)
    .where(eq(nodeTypeAppearance.workspaceId, workspaceId));
  return Object.fromEntries(rows.map((r) => [r.nodeType, { icon: r.icon, color: r.color }]));
}
