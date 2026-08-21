/**
 * Bài học và node là HAI bảng, chỉ nối với nhau qua `meta->>'lessonSlug'`.
 * Vòng lặp học đứt ở đúng chỗ này (rà B4.15): `completeLesson` ghi
 * `user_lesson_progress` nhưng không ai ghi `user_node_progress`, nên làm xong
 * bài mà cây vẫn ○ và dashboard vẫn 0%.
 *
 * Test chạm DB vì mấu chốt là một phép JOIN qua JSONB — mock thì không kiểm
 * được gì.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  workspaces,
  lessons,
  modules,
  weeks,
  levelTracks,
  userNodeProgress,
} from '@/lib/db/schema';
import { roadmapTreeNodes } from '@/lib/db/schema-tree';
import { findNodeForLesson } from '@/lib/learn/node-lesson';
import { upsertNodeStatus } from '@/lib/learn/node-progress';

const TAG = `${process.pid}-${process.hrtime.bigint()}`;
const OWNER = '00000000-0000-0000-0000-000000000001';
let wsId = '';
let lessonId = '';
let nodeId = '';
let moduleId = '';
let childId = '';

beforeAll(async () => {
  const [ws] = await db
    .insert(workspaces)
    .values({
      slug: `it-link-${TAG}`,
      name: 'IT lesson-node link',
      visibility: 'private',
      ownerUserId: OWNER,
    })
    .returning({ id: workspaces.id });
  wsId = ws!.id;

  // `lessons` treo dưới chuỗi cũ level_tracks → weeks → modules (đều NOT NULL),
  // nên phải dựng đủ chuỗi thì mới tạo được một bài học trong workspace tạm.
  const [track] = await db
    .insert(levelTracks)
    .values({ workspaceId: wsId, levelCode: 'XS', title: 'T' })
    .returning({ id: levelTracks.id });
  const [week] = await db
    .insert(weeks)
    .values({ workspaceId: wsId, trackId: track!.id, weekIndex: 1, title: 'W' })
    .returning({ id: weeks.id });
  const [mod] = await db
    .insert(modules)
    .values({ workspaceId: wsId, weekId: week!.id, title: 'M' })
    .returning({ id: modules.id });

  const [lesson] = await db
    .insert(lessons)
    .values({ workspaceId: wsId, moduleId: mod!.id, slug: `l-${TAG}`, title: 'Bài học liên kết' })
    .returning({ id: lessons.id });
  lessonId = lesson!.id;
  moduleId = mod!.id;

  const [node] = await db
    .insert(roadmapTreeNodes)
    .values({
      workspaceId: wsId,
      parentId: null,
      nodeType: 'lesson',
      title: 'Node chạy bài học',
      slug: `n-${TAG}`,
      orderIndex: 0,
      pathStr: '',
      depth: 2,
      meta: { lessonSlug: `l-${TAG}` },
    })
    .returning({ id: roadmapTreeNodes.id });
  nodeId = node!.id;
});

afterAll(async () => {
  if (!wsId) return;
  await db.delete(userNodeProgress).where(eq(userNodeProgress.workspaceId, wsId));
  await db.delete(roadmapTreeNodes).where(eq(roadmapTreeNodes.workspaceId, wsId));
  await db.delete(lessons).where(eq(lessons.workspaceId, wsId));
  await db.delete(modules).where(eq(modules.workspaceId, wsId));
  await db.delete(weeks).where(eq(weeks.workspaceId, wsId));
  await db.delete(levelTracks).where(eq(levelTracks.workspaceId, wsId));
  await db.delete(workspaces).where(eq(workspaces.id, wsId));
});

describe('findNodeForLesson', () => {
  it('tìm được node từ lessonId, kèm depth và hasChildren để tính XP', async () => {
    const found = await findNodeForLesson({ workspaceId: wsId, lessonId });
    expect(found).not.toBeNull();
    expect(found!.id).toBe(nodeId);
    expect(found!.depth).toBe(2);
    expect(found!.hasChildren).toBe(false);
  });

  it('hasChildren đổi thành true khi node có con', async () => {
    const [child] = await db
      .insert(roadmapTreeNodes)
      .values({
        workspaceId: wsId,
        parentId: nodeId,
        nodeType: 'lesson',
        title: 'Con',
        slug: `nc-${TAG}`,
        orderIndex: 0,
        pathStr: nodeId,
        depth: 3,
      })
      .returning({ id: roadmapTreeNodes.id });
    childId = child!.id;

    const found = await findNodeForLesson({ workspaceId: wsId, lessonId });
    expect(found!.hasChildren).toBe(true);

    await db.delete(roadmapTreeNodes).where(eq(roadmapTreeNodes.id, childId));
  });

  it('không nhìn xuyên workspace', async () => {
    const [other] = await db
      .insert(workspaces)
      .values({
        slug: `it-link-other-${TAG}`,
        name: 'other',
        visibility: 'private',
        ownerUserId: OWNER,
      })
      .returning({ id: workspaces.id });
    try {
      const found = await findNodeForLesson({ workspaceId: other!.id, lessonId });
      expect(found).toBeNull();
    } finally {
      await db.delete(workspaces).where(eq(workspaces.id, other!.id));
    }
  });

  it('trả null khi node không khai lessonSlug', async () => {
    const [orphan] = await db
      .insert(lessons)
      .values({
        workspaceId: wsId,
        moduleId,
        slug: `orphan-${TAG}`,
        title: 'Không node nào chạy',
      })
      .returning({ id: lessons.id });
    const found = await findNodeForLesson({ workspaceId: wsId, lessonId: orphan!.id });
    expect(found).toBeNull();
    await db.delete(lessons).where(eq(lessons.id, orphan!.id));
  });
});

describe('xong bài học → node chuyển done', () => {
  it('ghi được user_node_progress cho đúng node đã liên kết', async () => {
    const found = await findNodeForLesson({ workspaceId: wsId, lessonId });
    await upsertNodeStatus({
      workspaceId: wsId,
      userId: OWNER,
      nodeId: found!.id,
      status: 'done',
    });

    const rows = await db
      .select({ status: userNodeProgress.status, completedAt: userNodeProgress.completedAt })
      .from(userNodeProgress)
      .where(
        and(
          eq(userNodeProgress.workspaceId, wsId),
          eq(userNodeProgress.userId, OWNER),
          eq(userNodeProgress.nodeId, nodeId),
        ),
      );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe('done');
    expect(rows[0]!.completedAt).not.toBeNull();
  });

  it('gọi lại không tạo dòng thứ hai (an toàn khi ôn lại)', async () => {
    const found = await findNodeForLesson({ workspaceId: wsId, lessonId });
    await upsertNodeStatus({
      workspaceId: wsId,
      userId: OWNER,
      nodeId: found!.id,
      status: 'done',
    });
    const rows = await db
      .select({ id: userNodeProgress.id })
      .from(userNodeProgress)
      .where(
        and(eq(userNodeProgress.workspaceId, wsId), eq(userNodeProgress.nodeId, nodeId)),
      );
    expect(rows).toHaveLength(1);
  });
});
