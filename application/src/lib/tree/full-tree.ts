/**
 * Full-depth tree fetch for the public share page (A3).
 *
 * The dashboard renders 2 levels per page (section + subs, "drill 1 level");
 * the share page instead shows the WHOLE roadmap structure on one page. This
 * helper loads every node of the workspace in a single query (no progress
 * joins — read-only, userId-independent) and assembles the nested tree in
 * memory. Children counts are derived from the rows themselves, so the whole
 * page costs exactly ONE round-trip regardless of tree depth or size.
 */
import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { roadmapTreeNodes } from '@/lib/db/schema';

export type ShareTreeNode = {
  id: string;
  slug: string;
  title: string;
  nodeType: string;
  description: string | null;
  estMinutes: number | null;
  orderIndex: number;
  depth: number;
  /** Total nodes in this subtree EXCLUDING the node itself. */
  descendantCount: number;
  children: ShareTreeNode[];
};

/** Fetch the full node tree of a workspace, nested, ordered by orderIndex. */
export async function getFullTree(workspaceId: string): Promise<ShareTreeNode[]> {
  const rows = await db
    .select({
      id: roadmapTreeNodes.id,
      parentId: roadmapTreeNodes.parentId,
      slug: roadmapTreeNodes.slug,
      title: roadmapTreeNodes.title,
      nodeType: roadmapTreeNodes.nodeType,
      description: roadmapTreeNodes.description,
      estMinutes: roadmapTreeNodes.estMinutes,
      orderIndex: roadmapTreeNodes.orderIndex,
      depth: roadmapTreeNodes.depth,
    })
    .from(roadmapTreeNodes)
    .where(eq(roadmapTreeNodes.workspaceId, workspaceId))
    .orderBy(asc(roadmapTreeNodes.orderIndex));

  const nodesById = new Map<string, ShareTreeNode>();
  for (const r of rows) {
    nodesById.set(r.id, {
      id: r.id,
      slug: r.slug,
      title: r.title,
      nodeType: r.nodeType,
      description: r.description,
      estMinutes: r.estMinutes,
      orderIndex: r.orderIndex,
      depth: r.depth,
      descendantCount: 0,
      children: [],
    });
  }

  const roots: ShareTreeNode[] = [];
  for (const r of rows) {
    const node = nodesById.get(r.id)!;
    if (r.parentId && nodesById.has(r.parentId)) {
      nodesById.get(r.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Bottom-up descendant counts (iterate reverse order: children come after
  // parents in orderIndex ordering, so reverse guarantees children-first).
  for (const r of [...rows].reverse()) {
    const node = nodesById.get(r.id)!;
    if (r.parentId && nodesById.has(r.parentId)) {
      nodesById.get(r.parentId)!.descendantCount += node.descendantCount + 1;
    }
  }

  return roots;
}

/** Total node count of a forest (all descendants included). */
export function countTreeNodes(roots: ShareTreeNode[]): number {
  return roots.reduce((acc, r) => acc + 1 + r.descendantCount, 0);
}
