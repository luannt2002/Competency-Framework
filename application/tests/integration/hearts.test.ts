/**
 * F8 / F9 / F11 chạm DB thật: cột `hearts.current` là `numeric(3,1)` và sổ
 * chống cấp trùng `heart_grants` dựa vào unique index — hai thứ chỉ kiểm được
 * bằng Postgres thật.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaces, hearts, heartGrants, streaks } from '@/lib/db/schema';
import {
  spendHearts,
  grantHeartOnce,
  applyHeartDecay,
  heartsToNumber,
  SKIP_HEART_COST,
} from '@/lib/gamification/hearts';

const TAG = `${process.pid}-${process.hrtime.bigint()}`;
const USER = '00000000-0000-0000-0000-0000000000f8';
let wsId = '';

const readCurrent = async () => {
  const rows = await db
    .select({ current: hearts.current })
    .from(hearts)
    .where(and(eq(hearts.workspaceId, wsId), eq(hearts.userId, USER)))
    .limit(1);
  return heartsToNumber(rows[0]?.current);
};

beforeAll(async () => {
  const [ws] = await db
    .insert(workspaces)
    .values({
      slug: `it-hearts-${TAG}`,
      name: 'IT hearts',
      visibility: 'private',
      ownerUserId: USER,
    })
    .returning({ id: workspaces.id });
  wsId = ws!.id;
});

beforeEach(async () => {
  await db.delete(heartGrants).where(eq(heartGrants.workspaceId, wsId));
  await db.delete(hearts).where(eq(hearts.workspaceId, wsId));
  await db.delete(streaks).where(eq(streaks.workspaceId, wsId));
  await db.insert(hearts).values({ workspaceId: wsId, userId: USER, current: '5', max: 5 });
});

afterAll(async () => {
  if (!wsId) return;
  await db.delete(heartGrants).where(eq(heartGrants.workspaceId, wsId));
  await db.delete(hearts).where(eq(hearts.workspaceId, wsId));
  await db.delete(streaks).where(eq(streaks.workspaceId, wsId));
  await db.delete(workspaces).where(eq(workspaces.id, wsId));
});

describe('F9 — bỏ qua task tốn nửa tim', () => {
  it('numeric(3,1) giữ được nửa tim (integer thì không)', async () => {
    expect(await spendHearts(wsId, USER, SKIP_HEART_COST)).toBe(4.5);
    expect(await readCurrent()).toBe(4.5);
  });

  it('không bao giờ xuống dưới 0', async () => {
    for (let i = 0; i < 12; i++) await spendHearts(wsId, USER, SKIP_HEART_COST);
    expect(await readCurrent()).toBe(0);
  });
});

describe('F11 — ôn lại bài cũ được thêm tim, chỉ một lần mỗi ngày', () => {
  it('lần đầu trong ngày thì cấp, lần sau thì không', async () => {
    await spendHearts(wsId, USER, 2);
    expect(await readCurrent()).toBe(3);

    expect(await grantHeartOnce({ workspaceId: wsId, userId: USER, reason: 'lesson_replay', refId: 'L1' })).toBe(true);
    expect(await readCurrent()).toBe(4);

    expect(await grantHeartOnce({ workspaceId: wsId, userId: USER, reason: 'lesson_replay', refId: 'L1' })).toBe(false);
    expect(await readCurrent()).toBe(4);
  });

  it('bài khác nhau thì cấp riêng', async () => {
    await spendHearts(wsId, USER, 3);
    await grantHeartOnce({ workspaceId: wsId, userId: USER, reason: 'lesson_replay', refId: 'L1' });
    await grantHeartOnce({ workspaceId: wsId, userId: USER, reason: 'lesson_replay', refId: 'L2' });
    expect(await readCurrent()).toBe(4);
  });

  it('không vượt quá mức tối đa', async () => {
    expect(await readCurrent()).toBe(5);
    await grantHeartOnce({ workspaceId: wsId, userId: USER, reason: 'lesson_replay', refId: 'L9' });
    expect(await readCurrent()).toBe(5);
  });
});

describe('F8 — nghỉ học thì vơi tim', () => {
  it('không có dòng streak thì không trừ (người chưa từng học)', async () => {
    expect(await applyHeartDecay(wsId, USER)).toBe(0);
    expect(await readCurrent()).toBe(5);
  });

  it('nghỉ nhiều ngày thì trừ, và chạy lại KHÔNG trừ chồng', async () => {
    await db.insert(streaks).values({
      workspaceId: wsId,
      userId: USER,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: '2020-01-01',
    });

    const lost = await applyHeartDecay(wsId, USER);
    expect(lost).toBeGreaterThan(0);
    expect(await readCurrent()).toBe(0); // nghỉ nhiều năm → chạm sàn

    // Lần gọi thứ hai trong cùng ngày: mốc decayed_through đã chặn.
    expect(await applyHeartDecay(wsId, USER)).toBe(0);
  });

  it('không có dòng hearts thì không nổ', async () => {
    await db.delete(hearts).where(eq(hearts.workspaceId, wsId));
    expect(await applyHeartDecay(wsId, USER)).toBe(0);
  });
});
