import { describe, it, expect } from 'vitest';
import { effectiveStreak } from '@/lib/gamification/streak';

const TODAY = '2026-08-21';
const YESTERDAY = '2026-08-20';
const eff = (n: number | null, last: string | null) =>
  effectiveStreak(n, last, TODAY, YESTERDAY);

describe('effectiveStreak — chuỗi tính lúc đọc, không cần tiến trình nền', () => {
  it('hoạt động hôm nay: giữ nguyên', () => {
    expect(eff(7, TODAY)).toBe(7);
  });

  it('hoạt động hôm qua: vẫn còn — hôm nay chưa hết, chưa mất chuỗi', () => {
    expect(eff(7, YESTERDAY)).toBe(7);
  });

  it('nghỉ một ngày trọn vẹn: chuỗi đứt', () => {
    expect(eff(7, '2026-08-19')).toBe(0);
  });

  it('lỗi F13 dựng lại: last_active 01/08, hôm nay 21/08, bảng ghi 7 → hiện 0', () => {
    expect(eff(7, '2026-08-01')).toBe(0);
  });

  it('chưa từng hoạt động', () => {
    expect(eff(0, null)).toBe(0);
    expect(eff(5, null)).toBe(0);
  });

  it('giá trị rác không làm vỡ', () => {
    expect(eff(null, TODAY)).toBe(0);
    expect(eff(-3, TODAY)).toBe(0);
  });
});
