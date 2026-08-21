import { describe, it, expect } from 'vitest';
import {
  computeDecay,
  heartsToNumber,
  DECAY_GRACE_DAYS,
  SKIP_HEART_COST,
} from '@/lib/gamification/hearts';

describe('computeDecay — F8 nghỉ học thì vơi tim', () => {
  it('người chưa từng học không bị phạt', () => {
    expect(computeDecay(null, null, '2026-08-22')).toEqual({ lost: 0, decayedThrough: null });
  });

  it('học hôm nay: không mất gì', () => {
    expect(computeDecay('2026-08-22', null, '2026-08-22').lost).toBe(0);
  });

  it('học hôm qua: chưa có ngày trọn vẹn nào bị bỏ', () => {
    expect(computeDecay('2026-08-21', null, '2026-08-22').lost).toBe(0);
  });

  it('nghỉ trọn một ngày: mất 1 tim', () => {
    // hoạt động 20/8, hôm nay 22/8 → ngày 21/8 là ngày trọn vẹn duy nhất bị tính
    const r = computeDecay('2026-08-20', null, '2026-08-22');
    expect(r.lost).toBe(1);
    expect(r.decayedThrough).toBe('2026-08-21');
  });

  it('nghỉ nhiều ngày: mất theo số ngày', () => {
    expect(computeDecay('2026-08-15', null, '2026-08-22').lost).toBe(6);
  });

  it('IDEMPOTENT: chạy lại trong cùng ngày không trừ chồng', () => {
    const first = computeDecay('2026-08-15', null, '2026-08-22');
    const second = computeDecay('2026-08-15', first.decayedThrough, '2026-08-22');
    expect(second.lost).toBe(0);
    expect(second.decayedThrough).toBe(first.decayedThrough);
  });

  it('sang ngày mới chỉ trừ thêm đúng phần mới', () => {
    const day1 = computeDecay('2026-08-15', null, '2026-08-22');
    const day2 = computeDecay('2026-08-15', day1.decayedThrough, '2026-08-23');
    expect(day2.lost).toBe(1);
    expect(day2.decayedThrough).toBe('2026-08-22');
  });

  it('học lại rồi nghỉ tiếp: mốc cũ không chặn nhầm', () => {
    // đã trừ tới 21/8, sau đó học lại ngày 25/8, rồi nghỉ tới 28/8
    const r = computeDecay('2026-08-25', '2026-08-21', '2026-08-28');
    expect(r.lost).toBe(2); // ngày 26 và 27
    expect(r.decayedThrough).toBe('2026-08-27');
  });

  it('không tha thêm ngày nào ngoài "hôm nay chưa hết" — đúng spec F8', () => {
    expect(DECAY_GRACE_DAYS).toBe(0);
  });
});

describe('heartsToNumber — numeric trả về chuỗi', () => {
  it('đổi chuỗi thành số', () => {
    expect(heartsToNumber('4.5')).toBe(4.5);
    expect(heartsToNumber('5.0')).toBe(5);
  });
  it('null / undefined / rác đều thành 0, không thành NaN', () => {
    expect(heartsToNumber(null)).toBe(0);
    expect(heartsToNumber(undefined)).toBe(0);
    expect(heartsToNumber('abc')).toBe(0);
  });
  it('giữ nguyên số', () => {
    expect(heartsToNumber(3)).toBe(3);
  });
  it('nửa tim biểu diễn được (F9)', () => {
    expect(SKIP_HEART_COST).toBe(0.5);
    expect(heartsToNumber('0.5')).toBe(0.5);
  });
});
