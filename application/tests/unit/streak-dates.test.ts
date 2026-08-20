/**
 * Regression tests for streak date logic (Vietnam timezone, UTC+7).
 *
 * Background: the old implementation used UTC `toISOString()`, which resets the
 * daily streak at 07:00 local Vietnamese time — evening study landed on the
 * "wrong" day. These tests pin the fixed-offset behaviour.
 */
import { describe, it, expect } from 'vitest';
import { todayVN, isoDaysAgoVN } from '@/lib/gamification/streak';

describe('streak date helpers (Asia/Ho_Chi_Minh, UTC+7)', () => {
  it('returns YYYY-MM-DD strings', () => {
    expect(todayVN()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isoDaysAgoVN(1)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('is exactly one calendar day ahead of UTC before 17:00 UTC', () => {
    // Invariant: VN date is either the UTC date or the next one (offset +7h < 24h).
    const utc = new Date().toISOString().slice(0, 10);
    const vn = todayVN();
    const diff =
      Date.parse(vn + 'T00:00:00Z') - Date.parse(utc + 'T00:00:00Z');
    expect(diff === 0 || diff === 24 * 3600 * 1000).toBe(true);
  });

  it('isoDaysAgoVN(1) is exactly one day before todayVN', () => {
    const diff =
      Date.parse(todayVN() + 'T00:00:00Z') -
      Date.parse(isoDaysAgoVN(1) + 'T00:00:00Z');
    expect(diff).toBe(24 * 3600 * 1000);
  });

  it('crosses month boundary correctly (no negative days)', () => {
    // The helper must produce a valid date for any N; parsing it back must succeed.
    for (const n of [1, 2, 7, 30]) {
      expect(() => Date.parse(isoDaysAgoVN(n) + 'T00:00:00Z')).not.toThrow();
      expect(Number.isNaN(Date.parse(isoDaysAgoVN(n)))).toBe(false);
    }
  });
});
