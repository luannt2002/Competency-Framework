/**
 * Unit tests for the lazy heart-refill math in `@/lib/gamification/hearts`.
 *
 * The DB-side UPDATE mirrors `computeRefill`; these tests pin the pure
 * function so the SQL and the spec can't drift apart silently.
 */
import { describe, it, expect } from 'vitest';
import { computeRefill, REFILL_INTERVAL_MS } from '@/lib/gamification/hearts';

const H = REFILL_INTERVAL_MS;
const now = new Date('2026-08-20T12:00:00Z');

describe('computeRefill (lazy heart refill)', () => {
  it('does nothing when hearts are full', () => {
    const out = computeRefill(5, 5, null, now);
    expect(out).toEqual({ current: 5, max: 5, nextRefillAt: null });
  });

  it('clears a stale nextRefillAt when already at max', () => {
    // Refill timer survived somehow while full → convention: null it out.
    const out = computeRefill(5, 5, new Date(now.getTime() - H), now);
    expect(out.current).toBe(5);
    expect(out.nextRefillAt).toBeNull();
  });

  it('does nothing before nextRefillAt elapses', () => {
    const future = new Date(now.getTime() + 60_000);
    const out = computeRefill(3, 5, future, now);
    expect(out).toEqual({ current: 3, max: 5, nextRefillAt: future });
  });

  it('grants exactly one heart at the refill moment', () => {
    const due = new Date(now.getTime()); // nextRefillAt == now
    const out = computeRefill(3, 5, due, now);
    expect(out.current).toBe(4);
    expect(out.nextRefillAt?.getTime()).toBe(due.getTime() + H);
  });

  it('grants multiple hearts for a long absence', () => {
    // 2.5 intervals overdue → 3 hearts (1 + floor(2.5)).
    const due = new Date(now.getTime() - 2.5 * H);
    const out = computeRefill(1, 5, due, now);
    expect(out.current).toBe(4);
    expect(out.nextRefillAt?.getTime()).toBe(due.getTime() + 3 * H);
  });

  it('caps at max and clears nextRefillAt', () => {
    const due = new Date(now.getTime() - 10 * H);
    const out = computeRefill(0, 5, due, now);
    expect(out).toEqual({ current: 5, max: 5, nextRefillAt: null });
  });

  it('is idempotent — applying twice changes nothing', () => {
    const due = new Date(now.getTime() - H);
    const first = computeRefill(2, 5, due, now);
    const second = computeRefill(
      first.current,
      first.max,
      first.nextRefillAt,
      now,
    );
    expect(second).toEqual(first);
  });
});
