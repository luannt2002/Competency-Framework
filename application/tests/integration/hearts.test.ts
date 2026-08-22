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
  readHearts,
  heartsToNumber,
  SKIP_HEART_COST,
  REFILL_INTERVAL_MS,
} from '@/lib/gamification/hearts';

const TAG = `${process.pid}-${process.hrtime.bigint()}`;
const USER = '00000000-0000-0000-0000-0000000000f8';
let wsId = '';

const readRow = async () => {
  const rows = await db
    .select({ current: hearts.current, nextRefillAt: hearts.nextRefillAt })
    .from(hearts)
    .where(and(eq(hearts.workspaceId, wsId), eq(hearts.userId, USER)))
    .limit(1);
  return rows[0];
};

const readCurrent = async () => heartsToNumber((await readRow())?.current);

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

/**
 * Bất biến của `next_refill_at`, kiểm trên MỌI đường ghi.
 *
 * `computeRefill` và `gainedSql` đều thoát sớm khi cột này NULL — quy ước NULL
 * = "không có đợt hồi nào đang chờ" chỉ đúng cho hàng ĐẦY tim. Một hàng
 * `current = 0` kèm NULL nghĩa là người học kẹt ở 0 tim vĩnh viễn: không nộp
 * được bài nữa, trong khi giao diện vẫn hứa "tim hồi lại 1 trái mỗi 4 giờ".
 *
 * Trước đợt này mọi test đều chỉ kiểm SỐ tim, không test nào kiểm ĐỒNG HỒ hồi
 * tim — nên `applyHeartDecay` và `spendHearts` trừ tim mà quên lên dây cót suốt
 * một thời gian dài mà 447 test vẫn xanh. Nhóm test này bịt đúng đường nối đó.
 */
describe('bất biến: tim chưa đầy thì luôn có mốc hồi', () => {
  const armDecay = () =>
    db.insert(streaks).values({
      workspaceId: wsId,
      userId: USER,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: '2020-01-01',
    });

  it('F8 — nghỉ học vơi tim về 0 thì mốc hồi PHẢI được đặt', async () => {
    await armDecay();
    await applyHeartDecay(wsId, USER);

    const row = await readRow();
    expect(heartsToNumber(row?.current)).toBe(0);
    expect(row?.nextRefillAt).not.toBeNull();
  });

  it('F9 — tiêu tim xuống dưới mức tối đa thì mốc hồi PHẢI được đặt', async () => {
    await spendHearts(wsId, USER, SKIP_HEART_COST);

    const row = await readRow();
    expect(heartsToNumber(row?.current)).toBeLessThan(5);
    expect(row?.nextRefillAt).not.toBeNull();
  });

  it('đã có mốc hồi rồi thì lần mất tim sau KHÔNG đẩy lùi mốc', async () => {
    await spendHearts(wsId, USER, 1);
    const first = (await readRow())?.nextRefillAt;
    expect(first).not.toBeNull();

    // Mất tim lần nữa: phạt hai lần cho một đợt hồi là sai.
    await spendHearts(wsId, USER, 1);
    expect((await readRow())?.nextRefillAt).toEqual(first);
  });

  it('cấp tim đầy lại thì mốc hồi được XOÁ', async () => {
    await spendHearts(wsId, USER, 5);
    expect((await readRow())?.nextRefillAt).not.toBeNull();

    await grantHeartOnce({ workspaceId: wsId, userId: USER, reason: 'test-full', amount: 5 });

    const row = await readRow();
    expect(heartsToNumber(row?.current)).toBe(5);
    expect(row?.nextRefillAt).toBeNull();
  });

  it('kẹt-vĩnh-viễn: hết tim vì nghỉ học rồi vẫn hồi lại được', async () => {
    await armDecay();
    await applyHeartDecay(wsId, USER);
    expect(await readCurrent()).toBe(0);

    // Tua mốc hồi về quá khứ = giả lập đã chờ đủ 4 giờ.
    await db
      .update(hearts)
      .set({ nextRefillAt: new Date(Date.now() - REFILL_INTERVAL_MS) })
      .where(and(eq(hearts.workspaceId, wsId), eq(hearts.userId, USER)));

    const snapshot = await readHearts(wsId, USER);
    expect(snapshot?.current).toBeGreaterThan(0);
  });
});
