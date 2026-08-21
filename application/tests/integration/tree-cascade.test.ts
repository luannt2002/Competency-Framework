/**
 * Test CHẠM DB THẬT cho hai bất biến của cây — hai chỗ đã hỏng P0 mà 362 unit
 * test không bắt được, vì không test nào chạm tới `deleteTreeNode` /
 * `moveTreeNode`.
 *
 * Vì sao phải chạm DB: cả hai lỗi đều nằm ở tầng SQL, không nằm ở logic
 * JavaScript. Lỗi 1 là mệnh đề WHERE thiếu một vế; lỗi 2 là Postgres suy kiểu
 * tham số bind thành `text`. Mock DB thì cả hai đều "xanh".
 *
 * Chạy: cần DATABASE_URL trỏ tới một Postgres đã migrate. Test tự dựng
 * workspace riêng và tự dọn, không đụng dữ liệu sẵn có.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, eq, asc, sql as dsql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaces } from '@/lib/db/schema';
import { roadmapTreeNodes } from '@/lib/db/schema-tree';
import { subtreeCondition } from '@/lib/tree/cascade';

const SLUG = `it-tree-${process.pid}-${process.hrtime.bigint()}`;
const OWNER = '00000000-0000-0000-0000-000000000001';
let wsId = '';

async function mkNode(
  title: string,
  parentId: string | null,
  pathStr: string,
  depth: number,
  orderIndex: number,
): Promise<string> {
  const [row] = await db
    .insert(roadmapTreeNodes)
    .values({
      workspaceId: wsId,
      parentId,
      nodeType: 'lesson',
      title,
      slug: `${title.toLowerCase().replace(/\s+/g, '-')}-${orderIndex}-${depth}`,
      orderIndex,
      pathStr,
      depth,
    })
    .returning({ id: roadmapTreeNodes.id });
  return row!.id;
}

const countNodes = async () =>
  (
    await db
      .select({ id: roadmapTreeNodes.id })
      .from(roadmapTreeNodes)
      .where(eq(roadmapTreeNodes.workspaceId, wsId))
  ).length;

beforeAll(async () => {
  const [ws] = await db
    .insert(workspaces)
    .values({ slug: SLUG, name: 'IT tree cascade', visibility: 'private', ownerUserId: OWNER })
    .returning({ id: workspaces.id });
  wsId = ws!.id;
});

afterAll(async () => {
  if (!wsId) return;
  await db.delete(roadmapTreeNodes).where(eq(roadmapTreeNodes.workspaceId, wsId));
  await db.delete(workspaces).where(eq(workspaces.id, wsId));
});

describe('subtreeCondition — phải gồm CHÍNH node, không chỉ hậu duệ', () => {
  it('xoá một node lá xoá đúng 1 dòng (trước đây: 0 dòng, UI vẫn báo đã xoá)', async () => {
    const leaf = await mkNode('Leaf solo', null, '', 0, 90);
    const before = await countNodes();

    const deleted = await db
      .delete(roadmapTreeNodes)
      .where(subtreeCondition(wsId, leaf))
      .returning({ id: roadmapTreeNodes.id });

    expect(deleted).toHaveLength(1);
    expect(deleted[0]!.id).toBe(leaf);
    expect(await countNodes()).toBe(before - 1);
  });

  it('xoá node cha xoá cả cây con VÀ chính nó (trước đây: mất con, giữ cha)', async () => {
    const root = await mkNode('Root', null, '', 0, 91);
    const childA = await mkNode('Child A', root, root, 1, 0);
    const grand = await mkNode('Grand', childA, `${root}/${childA}`, 2, 0);
    const childB = await mkNode('Child B', root, root, 1, 1);

    const deleted = await db
      .delete(roadmapTreeNodes)
      .where(subtreeCondition(wsId, childA))
      .returning({ id: roadmapTreeNodes.id });

    const ids = deleted.map((r) => r.id).sort();
    expect(ids).toEqual([childA, grand].sort());

    const left = await db
      .select({ id: roadmapTreeNodes.id })
      .from(roadmapTreeNodes)
      .where(eq(roadmapTreeNodes.workspaceId, wsId));
    const leftIds = left.map((r) => r.id);
    expect(leftIds).toContain(root);
    expect(leftIds).toContain(childB);
    expect(leftIds).not.toContain(childA);
    expect(leftIds).not.toContain(grand);
  });

  it('không đụng node của workspace khác', async () => {
    const [other] = await db
      .insert(workspaces)
      .values({
        slug: `${SLUG}-other`,
        name: 'other',
        visibility: 'private',
        ownerUserId: OWNER,
      })
      .returning({ id: workspaces.id });
    const otherWs = other!.id;
    try {
      const mine = await mkNode('Mine', null, '', 0, 92);
      const [theirs] = await db
        .insert(roadmapTreeNodes)
        .values({
          workspaceId: otherWs,
          parentId: null,
          nodeType: 'lesson',
          title: 'Theirs',
          slug: 'theirs',
          orderIndex: 0,
          pathStr: '',
          depth: 0,
        })
        .returning({ id: roadmapTreeNodes.id });

      // Cố tình dùng id của workspace kia — điều kiện tenant phải chặn.
      const deleted = await db
        .delete(roadmapTreeNodes)
        .where(subtreeCondition(wsId, theirs!.id))
        .returning({ id: roadmapTreeNodes.id });
      expect(deleted).toHaveLength(0);

      const stillThere = await db
        .select({ id: roadmapTreeNodes.id })
        .from(roadmapTreeNodes)
        .where(eq(roadmapTreeNodes.id, theirs!.id));
      expect(stillThere).toHaveLength(1);
      void mine;
    } finally {
      await db.delete(roadmapTreeNodes).where(eq(roadmapTreeNodes.workspaceId, otherWs));
      await db.delete(workspaces).where(eq(workspaces.id, otherWs));
    }
  });
});

describe('đổi thứ tự anh em — tham số bind phải ép kiểu int', () => {
  it('hoán đổi order_index chạy được (trước đây: integer vs text, hỏng 100%)', async () => {
    const parent = await mkNode('P', null, '', 0, 93);
    const first = await mkNode('First', parent, parent, 1, 0);
    const second = await mkNode('Second', parent, parent, 1, 1);

    // Chính câu lệnh trong moveTreeNode.
    await db.execute(dsql`UPDATE roadmap_tree_nodes
         SET order_index = CASE id
           WHEN ${first}::uuid THEN ${1}::int
           WHEN ${second}::uuid THEN ${0}::int
         END
         WHERE workspace_id = ${wsId} AND id IN (${first}::uuid, ${second}::uuid)`);

    const rows = await db
      .select({ id: roadmapTreeNodes.id, o: roadmapTreeNodes.orderIndex })
      .from(roadmapTreeNodes)
      .where(and(eq(roadmapTreeNodes.workspaceId, wsId), eq(roadmapTreeNodes.parentId, parent)))
      .orderBy(asc(roadmapTreeNodes.orderIndex));

    expect(rows.map((r) => r.id)).toEqual([second, first]);
    expect(rows.map((r) => r.o)).toEqual([0, 1]);
  });
});
