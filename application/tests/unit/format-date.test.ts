import { describe, it, expect } from 'vitest';
import {
  formatDateVN,
  formatDateTimeVN,
  relativeTimeVN,
  formatNumberVN,
} from '@/lib/format-date';

/** 2026-08-20T16:47:00Z = 23:47 giờ Việt Nam cùng ngày. */
const T = new Date('2026-08-20T16:47:00Z');

describe('định dạng ngày theo vi-VN + Asia/Ho_Chi_Minh', () => {
  it('ngày dạng dd/mm/yyyy, không phải kiểu Mỹ', () => {
    expect(formatDateVN(T)).toBe('20/08/2026');
  });

  it('giờ 24h theo giờ Việt Nam, không phải UTC', () => {
    expect(formatDateTimeVN(T)).toBe('20/08/2026 23:47');
  });

  it('KHÔNG phụ thuộc múi giờ máy chạy — đây là chỗ gây lệch hydration', () => {
    // 17:30Z = 00:30 ngày HÔM SAU theo giờ VN. Nếu ai đó bỏ timeZone, máy chạy
    // ở UTC sẽ render ngày 20 còn trình duyệt VN render ngày 21.
    expect(formatDateVN(new Date('2026-08-20T17:30:00Z'))).toBe('21/08/2026');
  });

  it('nhận cả chuỗi ISO lẫn số epoch', () => {
    expect(formatDateVN('2026-08-20T16:47:00Z')).toBe('20/08/2026');
    expect(formatDateVN(T.getTime())).toBe('20/08/2026');
  });

  it('số có phân cách nhóm', () => {
    expect(formatNumberVN(1234567)).toBe('1.234.567');
  });
});

describe('relativeTimeVN', () => {
  const now = new Date('2026-08-20T16:47:00Z').getTime();
  const ago = (ms: number) => new Date(now - ms);

  it('dưới một phút', () => {
    expect(relativeTimeVN(ago(30_000), now)).toBe('vừa xong');
  });
  it('phút, giờ, ngày — đều tiếng Việt', () => {
    expect(relativeTimeVN(ago(5 * 60_000), now)).toBe('5 phút trước');
    expect(relativeTimeVN(ago(3 * 3_600_000), now)).toBe('3 giờ trước');
    expect(relativeTimeVN(ago(2 * 86_400_000), now)).toBe('2 ngày trước');
  });
  it('quá 7 ngày thì hiện ngày cụ thể', () => {
    expect(relativeTimeVN(ago(30 * 86_400_000), now)).toBe('21/07/2026');
  });
  it('mốc tương lai không nói "trước"', () => {
    expect(relativeTimeVN(new Date(now + 86_400_000), now)).toBe('21/08/2026');
  });
});
