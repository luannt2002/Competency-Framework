import { describe, it, expect } from 'vitest';
import {
  isoDateVN,
  todayVN,
  isoDaysAgoVN,
  tomorrowVN,
  startOfDayVN,
  daysBetweenISO,
  VN_TZ_OFFSET_MS,
} from '@/lib/day-vn';

describe('ranh giới ngày theo giờ Việt Nam', () => {
  it('lệch đúng 7 tiếng', () => {
    expect(VN_TZ_OFFSET_MS).toBe(7 * 3_600_000);
  });

  it('16:59Z vẫn là ngày hôm đó — 17:00Z đã sang ngày mới', () => {
    // Đây chính là chỗ 7 tiếng lệch: cắt theo UTC thì cả hai đều là ngày 20.
    expect(isoDateVN(new Date('2026-08-20T16:59:00Z'))).toBe('2026-08-20');
    expect(isoDateVN(new Date('2026-08-20T17:00:00Z'))).toBe('2026-08-21');
  });

  it('00:30Z vẫn là ngày hôm trước theo giờ VN? Không — đã là 07:30 sáng', () => {
    expect(isoDateVN(new Date('2026-08-21T00:30:00Z'))).toBe('2026-08-21');
  });

  it('todayVN có dạng yyyy-mm-dd', () => {
    expect(todayVN()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('tomorrowVN đúng một ngày sau todayVN', () => {
    expect(daysBetweenISO(todayVN(), tomorrowVN())).toBe(1);
  });

  it('isoDaysAgoVN đếm lùi đúng', () => {
    expect(daysBetweenISO(isoDaysAgoVN(7), todayVN())).toBe(7);
    expect(isoDaysAgoVN(0)).toBe(todayVN());
  });

  it('startOfDayVN trả mốc tuyệt đối = 17:00Z hôm trước', () => {
    expect(startOfDayVN('2026-08-21').toISOString()).toBe('2026-08-20T17:00:00.000Z');
  });

  it('startOfDayVN + isoDateVN khứ hồi khớp nhau', () => {
    for (const iso of ['2026-01-01', '2026-08-21', '2026-12-31']) {
      expect(isoDateVN(startOfDayVN(iso))).toBe(iso);
    }
  });

  it('daysBetweenISO: âm, dương, bằng 0, và null là vô cực', () => {
    expect(daysBetweenISO('2026-08-01', '2026-08-19')).toBe(18);
    expect(daysBetweenISO('2026-08-19', '2026-08-01')).toBe(-18);
    expect(daysBetweenISO('2026-08-19', '2026-08-19')).toBe(0);
    expect(daysBetweenISO(null, '2026-08-19')).toBe(Number.POSITIVE_INFINITY);
  });
});
