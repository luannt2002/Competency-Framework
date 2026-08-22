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
    // Sắp theo (depth, orderIndex): cha luôn được nạp trước con, và trong mỗi
    // nhóm anh em thứ tự đúng như người tạo đã xếp. Sắp chỉ theo `orderIndex`
    // là trộn lẫn mọi cấp — `orderIndex` chỉ có nghĩa TRONG một nhóm anh em.
    .orderBy(asc(roadmapTreeNodes.depth), asc(roadmapTreeNodes.orderIndex));

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

  // Đếm hậu duệ bằng cách duyệt CÂY ĐÃ DỰNG, không dựa vào thứ tự dòng.
  //
  // Bản cũ cộng dồn theo thứ tự `orderIndex` đảo ngược, dựa trên giả định "con
  // luôn đứng sau cha". Giả định đó sai — `orderIndex` chỉ có nghĩa trong nhóm
  // anh em, nên một node cấp 4 có orderIndex 0 đứng TRƯỚC một node cấp 1 có
  // orderIndex 3. Hệ quả đo được (rà A3b): trang share hiện "48 mục" trong khi
  // đệ quy cho 159; "Giai đoạn 1" hiện 15 trong khi thật 46.
  //
  // Duyệt hậu thứ tự bằng ngăn xếp thay vì đệ quy: cây do người dùng tự dựng,
  // không có giới hạn độ sâu, nên đệ quy có thể tràn ngăn xếp.
  const post: ShareTreeNode[] = [];
  const stack = [...roots];
  while (stack.length > 0) {
    const n = stack.pop()!;
    post.push(n);
    for (const c of n.children) stack.push(c);
  }
  for (let i = post.length - 1; i >= 0; i--) {
    const n = post[i]!;
    n.descendantCount = n.children.reduce((acc, c) => acc + 1 + c.descendantCount, 0);
  }

  return roots;
}

/** Total node count of a forest (all descendants included). */
export function countTreeNodes(roots: ShareTreeNode[]): number {
  return roots.reduce((acc, r) => acc + 1 + r.descendantCount, 0);
}
