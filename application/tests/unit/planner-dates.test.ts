/**
 * Unit tests for extracted pure helpers (refactor đợt 2).
 * planner-dates: ISO date math used by the daily planner.
 * cascade: the pathStr parsing halves that are pure (DB halves are covered
 * by the integration surfaces in tree-nodes actions).
 */
import { describe, it, expect } from 'vitest';
import { isoDate, todayISO, tomorrowISO, daysBetween } from '@/lib/learn/planner-dates';

describe('planner-dates', () => {
  it('isoDate cắt ngày theo giờ VIỆT NAM, không phải UTC', () => {
    // 23:30Z ngày 19 = 06:30 sáng ngày 20 giờ VN. Bản cũ cắt theo UTC nên trả
    // 19 — lệch đúng 7 tiếng so với streak, mỗi ngày.
    expect(isoDate(new Date('2026-08-19T23:30:00Z'))).toBe('2026-08-20');
    expect(isoDate(new Date('2026-08-19T16:59:00Z'))).toBe('2026-08-19');
    expect(isoDate(new Date('2026-01-04T17:00:00Z'))).toBe('2026-01-05');
  });

  it('todayISO returns yyyy-mm-dd', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('tomorrowISO is exactly one day after todayISO', () => {
    const diff =
      Date.parse(tomorrowISO() + 'T00:00:00Z') - Date.parse(todayISO() + 'T00:00:00Z');
    expect(diff).toBe(86_400_000);
  });

  it('daysBetween: positive when b after a, negative otherwise, Infinity for null', () => {
    expect(daysBetween('2026-08-01', '2026-08-19')).toBe(18);
    expect(daysBetween('2026-08-19', '2026-08-01')).toBe(-18);
    expect(daysBetween(null, '2026-08-19')).toBe(Number.POSITIVE_INFINITY);
    expect(daysBetween('2026-08-19', '2026-08-19')).toBe(0);
  });

  it('daysBetween crosses month/year boundaries', () => {
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1); // 2026 not a leap year
  });
});
