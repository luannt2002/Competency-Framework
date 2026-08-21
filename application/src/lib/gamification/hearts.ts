/**
 * Heart refill logic (lazy, computed on read/write).
 *
 * Hearts regenerate at 1 per REFILL_INTERVAL_MS (4h) up to `max`. There is no
 * cron — refills are applied lazily whenever a hearts row is read or written,
 * via `applyHeartRefills`.
 *
 * The refill count math is kept in a pure function (`computeRefill`) so it can
 * be unit-tested without a DB; the SQL in `applyHeartRefills` mirrors it in a
 * single atomic UPDATE (race-tolerant for the single-user row it targets).
 */
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { hearts, heartGrants, streaks } from '@/lib/db/schema';
import { todayVN } from '@/lib/gamification/streak';

/**
 * `hearts.current` là `numeric(3,1)` (F9 trừ nửa tim) và driver Postgres trả
 * numeric về dạng CHUỖI. So sánh `row.current > 0` trên một chuỗi là bẫy im
 * lặng — mọi chỗ đọc phải đi qua đây.
 */
export function heartsToNumber(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Số ngày nghỉ được THA THÊM ngoài quy tắc "hôm nay không bao giờ bị tính".
 *
 * Spec F8 là "mỗi ngày bỏ học mất 1 tim", nên bằng 0: ngày trọn vẹn đầu tiên
 * không hoạt động đã bị trừ. Ngày hôm nay vẫn luôn miễn vì nó còn chưa hết —
 * đó là bản chất của phép đếm, không phải ân hạn.
 */
export const DECAY_GRACE_DAYS = 0;
/** Tim mất cho mỗi ngày nghỉ học sau thời gian ân hạn (F8). */
export const DECAY_PER_IDLE_DAY = 1;
/** Tim mất khi bỏ qua một task trong ngày (F9). */
export const SKIP_HEART_COST = 0.5;
/** Tim được thưởng khi ôn lại một bài đã hoàn thành (F11). */
export const REPLAY_HEART_REWARD = 1;

/** One heart every 4 hours (matches the interval written on heart loss). */
export const REFILL_INTERVAL_MS = 4 * 60 * 60 * 1000;

export type HeartsSnapshot = {
  current: number;
  max: number;
  nextRefillAt: Date | null;
};

/**
 * Pure refill math: how many hearts and what next_refill_at a row should have
 * as of `now`.
 *
 * Rules:
 *  - While current < max and next_refill_at <= now: +1 heart per elapsed
 *    interval (the first refill is due exactly at next_refill_at).
 *  - next_refill_at advances one interval per granted heart.
 *  - Reaching max clears next_refill_at (null = no pending refill — same
 *    convention as the bootstrap insert of a full 5/5 row).
 *  - Idempotent: applying it to an already-refilled row changes nothing.
 */
export function computeRefill(
  current: number,
  max: number,
  nextRefillAt: Date | null,
  now: Date = new Date(),
): HeartsSnapshot {
  if (nextRefillAt === null || current >= max) {
    return {
      current,
      max,
      // Full row: no pending refill.
      nextRefillAt: current >= max ? null : nextRefillAt,
    };
  }
  if (nextRefillAt.getTime() > now.getTime()) {
    return { current, max, nextRefillAt };
  }
  const overdueMs = now.getTime() - nextRefillAt.getTime();
  const gained = 1 + Math.floor(overdueMs / REFILL_INTERVAL_MS);
  const newCurrent = Math.min(max, current + gained);
  return {
    current: newCurrent,
    max,
    nextRefillAt:
      newCurrent >= max
        ? null
        : new Date(nextRefillAt.getTime() + gained * REFILL_INTERVAL_MS),
  };
}

/**
 * SQL fragment: number of hearts owed right now (0 when nothing is pending).
 * Mirrors `computeRefill`'s gained count, capping handled by the caller.
 */
function gainedSql() {
  return sql<number>`
    CASE
      WHEN ${hearts.current} < ${hearts.max}
        AND ${hearts.nextRefillAt} IS NOT NULL
        AND ${hearts.nextRefillAt} <= NOW()
      THEN GREATEST(
        1,
        1 + FLOOR(EXTRACT(EPOCH FROM (NOW() - ${hearts.nextRefillAt})) / ${REFILL_INTERVAL_MS / 1000})
      )
      ELSE 0
    END`;
}

/**
 * Apply pending refills to one (workspace, user) row in a single atomic
 * UPDATE, then return the refreshed row (or null when no row exists).
 *
 * Because both computed columns derive from the PRE-update values (Postgres
 * UPDATE semantics), the two SET expressions stay consistent; a concurrent
 * call can at worst re-derive the same values (idempotent) — safe for a row
 * only its owning user writes.
 */
export async function applyHeartRefills(
  workspaceId: string,
  userId: string,
): Promise<HeartsSnapshot | null> {
  const gained = gainedSql();
  const rows = await db
    .update(hearts)
    .set({
      current: sql`LEAST(${hearts.max}, ${hearts.current} + ${gained})`,
      nextRefillAt: sql`
        CASE
          WHEN ${hearts.current} + ${gained} >= ${hearts.max} THEN NULL
          ELSE ${hearts.nextRefillAt} + (${gained} * interval '4 hours')
        END`,
    })
    .where(and(eq(hearts.workspaceId, workspaceId), eq(hearts.userId, userId)))
    .returning({
      current: hearts.current,
      max: hearts.max,
      nextRefillAt: hearts.nextRefillAt,
    });
  const row = rows[0];
  if (!row) return null;
  return {
    current: heartsToNumber(row.current),
    max: row.max ?? 0,
    nextRefillAt: row.nextRefillAt ?? null,
  };
}

/* ============================ F8 — nghỉ học thì vơi tim ============================ */

/**
 * Số tim phải trừ vì nghỉ học, và mốc mới của `decayed_through`. Thuần, test được.
 *
 * Quy tắc: mỗi NGÀY TRỌN VẸN không hoạt động mất 1 tim. Ngày trọn vẹn là ngày
 * nằm hẳn giữa ngày hoạt động cuối và hôm nay. Hôm nay không bao giờ bị tính —
 * ngày còn chưa hết; ngày hoạt động cuối cũng không, vì hôm đó có học.
 *
 * `decayedThrough` làm cho phép tính LƯỜI này idempotent: chạy lại trong cùng
 * một ngày không trừ chồng. Không có mốc đó thì mỗi lần mở trang là một lần trừ.
 *
 * @param lastActive ngày hoạt động gần nhất (ISO yyyy-mm-dd), null = chưa từng.
 * @param decayedThrough đã trừ tới hết ngày nào (ISO), null = chưa trừ lần nào.
 * @param today hôm nay theo giờ VN (ISO).
 */
export function computeDecay(
  lastActive: string | null,
  decayedThrough: string | null,
  today: string,
): { lost: number; decayedThrough: string | null } {
  // Chưa từng học thì không có gì để mất — người mới không bị phạt.
  if (!lastActive) return { lost: 0, decayedThrough };

  const day = 86_400_000;
  const at = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
  const todayMs = at(today);
  // Ngày cuối cùng CÓ THỂ bị tính là hôm qua.
  const lastCountableMs = todayMs - day;
  // Bắt đầu tính từ sau ngày hoạt động cuối + ân hạn, và sau mốc đã trừ.
  const fromMs = Math.max(
    at(lastActive) + (DECAY_GRACE_DAYS + 1) * day,
    decayedThrough ? at(decayedThrough) + day : 0,
  );
  if (lastCountableMs < fromMs) return { lost: 0, decayedThrough };

  const days = Math.floor((lastCountableMs - fromMs) / day) + 1;
  return {
    lost: days * DECAY_PER_IDLE_DAY,
    decayedThrough: new Date(lastCountableMs).toISOString().slice(0, 10),
  };
}

/** Áp F8 cho một (workspace, user). Trả số tim đã mất trong lần gọi này. */
export async function applyHeartDecay(workspaceId: string, userId: string): Promise<number> {
  const rows = await db
    .select({ current: hearts.current, decayedThrough: hearts.decayedThrough })
    .from(hearts)
    .where(and(eq(hearts.workspaceId, workspaceId), eq(hearts.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return 0;

  const streakRows = await db
    .select({ lastActiveDate: streaks.lastActiveDate })
    .from(streaks)
    .where(and(eq(streaks.workspaceId, workspaceId), eq(streaks.userId, userId)))
    .limit(1);

  const { lost, decayedThrough } = computeDecay(
    streakRows[0]?.lastActiveDate ?? null,
    row.decayedThrough ?? null,
    todayVN(),
  );
  if (lost <= 0) return 0;

  await db
    .update(hearts)
    .set({
      current: sql`GREATEST(${hearts.current} - ${lost}, 0)`,
      decayedThrough,
    })
    .where(and(eq(hearts.workspaceId, workspaceId), eq(hearts.userId, userId)));
  return lost;
}

/* ============================ F9 / F11 — tiêu và kiếm lại ============================ */

/** Trừ tim (F9 bỏ qua task: 0,5). Không bao giờ xuống dưới 0. Trả số tim còn lại. */
export async function spendHearts(
  workspaceId: string,
  userId: string,
  amount: number,
): Promise<number> {
  const rows = await db
    .update(hearts)
    .set({ current: sql`GREATEST(${hearts.current} - ${amount}, 0)` })
    .where(and(eq(hearts.workspaceId, workspaceId), eq(hearts.userId, userId)))
    .returning({ current: hearts.current });
  return heartsToNumber(rows[0]?.current);
}

/**
 * Cấp tim MỘT LẦN cho mỗi (lý do, tham chiếu, ngày) — F11 ôn lại bài cũ +1.
 *
 * Chống cấp trùng bằng unique index ở DB chứ không bằng kiểm tra trước rồi ghi
 * sau: hai tab mở song song sẽ vượt qua được phép kiểm tra kiểu đó.
 * Trả `true` nếu lần này thật sự cấp.
 */
export async function grantHeartOnce(params: {
  workspaceId: string;
  userId: string;
  reason: string;
  refId?: string;
  amount?: number;
}): Promise<boolean> {
  const amount = params.amount ?? REPLAY_HEART_REWARD;
  const inserted = await db
    .insert(heartGrants)
    .values({
      workspaceId: params.workspaceId,
      userId: params.userId,
      reason: params.reason,
      refId: params.refId ?? '',
      grantedOn: todayVN(),
      amount: String(amount),
    })
    .onConflictDoNothing()
    .returning({ id: heartGrants.id });
  if (inserted.length === 0) return false;

  await db
    .update(hearts)
    .set({ current: sql`LEAST(${hearts.max}, ${hearts.current} + ${amount})` })
    .where(and(eq(hearts.workspaceId, params.workspaceId), eq(hearts.userId, params.userId)));
  return true;
}

/**
 * Ảnh chụp tim SAU KHI đã áp hồi phục theo giờ và trừ vì nghỉ học.
 *
 * Mọi bề mặt hiển thị tim phải gọi hàm này. Rà F7 đo được ba mặt trả ba số khác
 * nhau cho cùng một người tại cùng một thời điểm — topbar khoe 5/5 trong khi
 * API trả 0 — vì mỗi nơi tự quyết định giá trị mặc định khi thiếu dòng.
 */
export async function readHearts(
  workspaceId: string,
  userId: string,
): Promise<HeartsSnapshot | null> {
  await applyHeartDecay(workspaceId, userId);
  return applyHeartRefills(workspaceId, userId);
}
