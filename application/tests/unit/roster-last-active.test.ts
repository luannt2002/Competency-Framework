/**
 * D3.3 — unit tests cho định dạng tương đối của cột "Hoạt động" trên roster.
 */
import { describe, it, expect } from 'vitest';
import { formatLastActive, daysSinceISO } from '@/components/admin/roster-table';

const NOW = new Date('2026-08-20T12:00:00Z');

describe('formatLastActive (D3.3)', () => {
  it('trả "—" khi không có dữ liệu', () => {
    expect(formatLastActive(null, NOW)).toBe('—');
  });

  it('trả "hôm nay" cho hoạt động trong ngày', () => {
    expect(formatLastActive('2026-08-20T01:00:00Z', NOW)).toBe('hôm nay');
  });

  it('trả "hôm qua" cho 1 ngày trước', () => {
    expect(formatLastActive('2026-08-19T18:00:00Z', NOW)).toBe('hôm qua');
  });

  it('trả "X ngày trước" cho X ≥ 2', () => {
    expect(formatLastActive('2026-08-13T00:00:00Z', NOW)).toBe('7 ngày trước');
  });
});

describe('daysSinceISO (D3.4 threshold helper)', () => {
  it('đếm theo ngày lịch UTC, không theo 24h khối', () => {
    // 23h trước nhưng lấn sang hôm qua → 1 ngày.
    expect(daysSinceISO('2026-08-19T13:00:00Z', NOW)).toBe(1);
  });

  it('đúng ngưỡng ≥ 7 ngày cho At Risk', () => {
    expect(daysSinceISO('2026-08-13T00:00:00Z', NOW)).toBe(7);
    expect(daysSinceISO('2026-08-14T23:00:00Z', NOW)).toBe(6);
  });
});
