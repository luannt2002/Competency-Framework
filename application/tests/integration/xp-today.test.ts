/**
 * `sumXpOnDateVN` — cộng ở DB phải cho ĐÚNG kết quả bản lọc bằng JS.
 *
 * Bản cũ kéo toàn bộ lịch sử `xp_events` về rồi
 * `.filter((r) => isoDateVN(r.createdAt) === planDate)`. Chi phí tăng theo tuổi
 * tài khoản: học một năm là hàng nghìn dòng qua mạng để tính một phép cộng, mỗi
 * lần mở trang Hôm nay.
 *
 * Đổi phép lọc ngày từ JS sang SQL là chỗ DỄ SAI NHẤT trong cả đợt tối ưu, vì
 * ranh giới ngày phải giữ nguyên. `lib/day-vn.ts` ghi lại một sự cố đã xảy ra
 * thật: `streak.ts` cắt theo giờ VN còn nơi khác cắt theo UTC — lệch 7 tiếng
 * mỗi ngày, hai màn hình nói hai ngày khác nhau.
 *
 * Nên nhóm test này không kiểm "SQL chạy được". Nó dựng các mốc thời gian nằm
 * ĐÚNG HAI BÊN ranh giới ngày VN rồi đối chiếu SQL với chính phép tính JS.
 */
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaces, xpEvents } from '@/lib/db/schema';
import { isoDateVN } from '@/lib/day-vn';
import { sumXpOnDateVN } from '@/lib/learn/xp-today';

const TAG = `${process.pid}-${process.hrtime.bigint()}`;
const USER = '00000000-0000-0000-0000-0000000000d1';

let wsId = '';

/**
 * Các mốc chọn có chủ đích quanh ranh giới ngày VN (UTC+7).
 *
 * 2026-03-10T16:59:59Z là 23:59:59 ngày 10/03 giờ VN.
 * 2026-03-10T17:00:00Z là 00:00:00 ngày 11/03 giờ VN — sang ngày mới.
 * Cắt theo UTC thì cả hai đều là 10/03, nên đây đúng là chỗ bản cũ từng sai.
 */
const SAMPLES: { at: string; amount: number }[] = [
  { at: '2026-03-09T17:00:00Z', amount: 7 },   // 00:00 ngày 10/03 VN
  { at: '2026-03-10T03:30:00Z', amount: 11 },  // 10:30 ngày 10/03 VN
  { at: '2026-03-10T16:59:59Z', amount: 13 },  // 23:59:59 ngày 10/03 VN
  { at: '2026-03-10T17:00:00Z', amount: 17 },  // 00:00 ngày 11/03 VN
  { at: '2026-03-11T09:00:00Z', amount: 19 },  // 16:00 ngày 11/03 VN
];

beforeAll(async () => {
  const [ws] = await db
    .insert(workspaces)
    .values({
      slug: `it-xptoday-${TAG}`,
      name: 'IT xp today',
      visibility: 'private',
      ownerUserId: USER,
    })
    .returning({ id: workspaces.id });
  wsId = ws!.id;

  await db.insert(xpEvents).values(
    SAMPLES.map((s) => ({
      workspaceId: wsId,
      userId: USER,
      amount: s.amount,
      reason: 'exercise_correct',
      refKind: 'exercise',
      // `ref_id` là cột uuid — chuỗi tự chế không lọt qua.
      refId: randomUUID(),
      createdAt: new Date(s.at),
    })),
  );
});

afterAll(async () => {
  if (!wsId) return;
  await db.delete(xpEvents).where(inArray(xpEvents.workspaceId, [wsId]));
  await db.delete(workspaces).where(inArray(workspaces.id, [wsId]));
});

/** Đúng phép tính mà bản cũ dùng, giữ lại để đối chiếu. */
function sumInJs(dateVN: string): number {
  return SAMPLES.filter((s) => isoDateVN(new Date(s.at)) === dateVN).reduce(
    (sum, s) => sum + s.amount,
    0,
  );
}

describe('SQL cho cùng kết quả với phép lọc JS cũ', () => {
  it.each(['2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12'])(
    'ngày %s',
    async (dateVN) => {
      expect(await sumXpOnDateVN(wsId, USER, dateVN)).toBe(sumInJs(dateVN));
    },
  );
});

describe('ranh giới ngày cắt theo giờ VN, không theo UTC', () => {
  it('23:59:59 giờ VN vẫn thuộc ngày hôm đó', async () => {
    // 7 + 11 + 13 — ba mốc nằm trong ngày 10/03 giờ VN.
    expect(await sumXpOnDateVN(wsId, USER, '2026-03-10')).toBe(31);
  });

  it('00:00:00 giờ VN đã sang ngày mới', async () => {
    // 17 + 19. Cắt theo UTC thì mốc 17 rơi nhầm về ngày 10/03.
    expect(await sumXpOnDateVN(wsId, USER, '2026-03-11')).toBe(36);
  });

  it('mốc 17:00Z hôm trước thuộc về ngày hôm sau theo giờ VN', async () => {
    // Nếu ai đó đổi sang cắt theo UTC, mốc `2026-03-09T17:00:00Z` (amount 7)
    // sẽ rơi về 09/03 và bài này đỏ.
    expect(await sumXpOnDateVN(wsId, USER, '2026-03-09')).toBe(0);
  });
});

describe('ngày không có sự kiện nào', () => {
  it('trả 0 chứ không phải NaN — SUM của tập rỗng là NULL', async () => {
    const v = await sumXpOnDateVN(wsId, USER, '2026-01-01');
    expect(v).toBe(0);
    expect(Number.isNaN(v)).toBe(false);
  });
});

describe('không đếm lẫn của workspace hay người khác', () => {
  it('workspace khác trả 0', async () => {
    expect(
      await sumXpOnDateVN('00000000-0000-0000-0000-0000000000ff', USER, '2026-03-10'),
    ).toBe(0);
  });

  it('người khác trong cùng workspace trả 0', async () => {
    expect(
      await sumXpOnDateVN(wsId, '00000000-0000-0000-0000-0000000000fe', '2026-03-10'),
    ).toBe(0);
  });
});
