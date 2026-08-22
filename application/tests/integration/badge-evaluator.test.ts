/**
 * `evaluateBadges` — hành vi phải giữ nguyên sau khi gom truy vấn.
 *
 * Trước đợt này `evalRule` tự truy vấn cho TỪNG huy hiệu, mà phần lớn luật tính
 * cùng một phép tổng hợp và chỉ khác ngưỡng: một thang huy hiệu streak 3/7/30/100
 * chạy bốn lần y hệt một câu đếm. Đã đo trên DB thật (log Postgres, đếm dòng
 * `execute`), cùng workspace và cùng người dùng:
 *
 *     số huy hiệu   cũ    mới
 *     5             14    10
 *     20            29    10
 *     50            59    10
 *
 * Cũ tăng tuyến tính theo số huy hiệu; mới là hằng số. `evaluateBadges` chạy ở
 * cả `completeLesson` lẫn mỗi lần cập nhật tiến độ node — hai đường nóng nhất
 * của người học — nên chi phí tăng theo số huy hiệu là thứ workspace càng dùng
 * lâu càng chậm.
 *
 * Nhóm test này KHÔNG đo tốc độ. Nó gác thứ quan trọng hơn: gom truy vấn không
 * được làm đổi kết quả. Mỗi bài đặt một điều kiện rồi kiểm đúng những huy hiệu
 * đáng được cấp mới được cấp.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  workspaces,
  badges,
  userBadges,
  streaks,
  xpEvents,
  userLessonProgress,
} from '@/lib/db/schema';
import { evaluateBadges } from '@/lib/gamification/badge-evaluator';

const TAG = `${process.pid}-${process.hrtime.bigint()}`;
const USER = '00000000-0000-0000-0000-0000000000be';

let wsId = '';

async function freshWorkspace(): Promise<string> {
  const [ws] = await db
    .insert(workspaces)
    .values({
      slug: `it-badge-${TAG}-${Math.floor(process.hrtime()[1] / 1000)}`,
      name: 'IT badge evaluator',
      visibility: 'private',
      ownerUserId: USER,
    })
    .returning({ id: workspaces.id });
  return ws!.id;
}

/** Thang huy hiệu streak — cùng luật, khác ngưỡng. Đây là hình dạng gây trùng. */
async function seedStreakLadder(id: string, thresholds: number[]) {
  await db.insert(badges).values(
    thresholds.map((v) => ({
      workspaceId: id,
      slug: `streak-${v}`,
      name: `Streak ${v}`,
      rule: { kind: 'streak', value: v } as Record<string, unknown>,
    })),
  );
}

const allIds: string[] = [];

beforeEach(async () => {
  wsId = await freshWorkspace();
  allIds.push(wsId);
});

afterAll(async () => {
  if (allIds.length === 0) return;
  await db.delete(xpEvents).where(inArray(xpEvents.workspaceId, allIds));
  await db.delete(userBadges).where(inArray(userBadges.workspaceId, allIds));
  await db.delete(userLessonProgress).where(inArray(userLessonProgress.workspaceId, allIds));
  await db.delete(streaks).where(inArray(streaks.workspaceId, allIds));
  await db.delete(badges).where(inArray(badges.workspaceId, allIds));
  await db.delete(workspaces).where(inArray(workspaces.id, allIds));
});

describe('ngưỡng vẫn được so đúng cho từng huy hiệu', () => {
  it('chuỗi 7 ngày cấp đúng các mốc <= 7, không cấp mốc cao hơn', async () => {
    await seedStreakLadder(wsId, [3, 7, 30, 100]);
    await db.insert(streaks).values({
      workspaceId: wsId,
      userId: USER,
      currentStreak: 7,
      longestStreak: 7,
    });

    const granted = await evaluateBadges(wsId, USER);
    const slugs = granted.map((g) => g.slug).sort();

    // Đây là bài quan trọng nhất: gom truy vấn nghĩa là bốn huy hiệu dùng CHUNG
    // một con số chuỗi ngày — nếu ngưỡng bị so nhầm thì lỗi hiện ra ở đây.
    expect(slugs).toEqual(['streak-3', 'streak-7']);
  });

  it('chưa có dòng streak thì không cấp gì', async () => {
    await seedStreakLadder(wsId, [3, 7]);
    expect(await evaluateBadges(wsId, USER)).toEqual([]);
  });

  it('không cấp lại huy hiệu đã sở hữu', async () => {
    await seedStreakLadder(wsId, [3, 7]);
    await db.insert(streaks).values({
      workspaceId: wsId,
      userId: USER,
      currentStreak: 10,
      longestStreak: 10,
    });

    const first = await evaluateBadges(wsId, USER);
    expect(first.map((g) => g.slug).sort()).toEqual(['streak-3', 'streak-7']);

    // Lượt hai: không còn gì mới, và không sinh thêm dòng XP nào.
    const second = await evaluateBadges(wsId, USER);
    expect(second).toEqual([]);

    const xpRows = await db
      .select({ id: xpEvents.id })
      .from(xpEvents)
      .where(and(eq(xpEvents.workspaceId, wsId), eq(xpEvents.userId, USER)));
    expect(xpRows).toHaveLength(2);
  });
});

describe('nhiều luật khác nhau cùng lượt vẫn đúng', () => {
  it('streak và lesson_completed không lẫn số của nhau', async () => {
    await db.insert(badges).values([
      {
        workspaceId: wsId,
        slug: 'streak-5',
        name: 'Streak 5',
        rule: { kind: 'streak', value: 5 } as Record<string, unknown>,
      },
      {
        workspaceId: wsId,
        slug: 'lessons-5',
        name: 'Lessons 5',
        rule: { kind: 'lesson_completed', value: 5 } as Record<string, unknown>,
      },
    ]);

    // Chuỗi đạt ngưỡng, số bài học thì không. Hai phép tổng hợp khác nhau được
    // đệm dưới hai khoá khác nhau — lẫn khoá là bài này đỏ.
    await db.insert(streaks).values({
      workspaceId: wsId,
      userId: USER,
      currentStreak: 5,
      longestStreak: 5,
    });

    const granted = await evaluateBadges(wsId, USER);
    expect(granted.map((g) => g.slug)).toEqual(['streak-5']);
  });
});
