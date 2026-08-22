import { describe, it, expect } from 'vitest';
import { toSlug, clamp, relativeTime } from '@/lib/utils';

describe('utils', () => {
  describe('toSlug', () => {
    it('basic ASCII', () => {
      expect(toSlug('Hello World')).toBe('hello-world');
    });
    it('strips special chars', () => {
      expect(toSlug('AWS & Terraform 2026!')).toBe('aws-terraform-2026');
    });
    it('trims leading/trailing dashes', () => {
      expect(toSlug('-Foo-')).toBe('foo');
      expect(toSlug('  Foo  ')).toBe('foo');
    });
  });

  describe('clamp', () => {
    it('within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });
    it('below min', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });
    it('above max', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('relativeTime', () => {
    // Hàm này nay uỷ quyền sang `relativeTimeVN` — app khai lang="vi", và bản
    // cũ kết thúc bằng `toLocaleDateString()` không truyền locale nên cùng một
    // Date render khác nhau giữa server và trình duyệt (lệch hydration).
    it('vừa xong', () => {
      expect(relativeTime(new Date())).toBe('vừa xong');
    });
    it('phút', () => {
      expect(relativeTime(new Date(Date.now() - 5 * 60_000))).toBe('5 phút trước');
    });
    it('giờ', () => {
      expect(relativeTime(new Date(Date.now() - 3 * 3_600_000))).toBe('3 giờ trước');
    });
    it('ngày', () => {
      expect(relativeTime(new Date(Date.now() - 2 * 86_400_000))).toBe('2 ngày trước');
    });
    it('quá 7 ngày thì hiện ngày dd/mm/yyyy', () => {
      expect(relativeTime(new Date(Date.now() - 30 * 86_400_000))).toMatch(
        /^\d{2}\/\d{2}\/\d{4}$/,
      );
    });
  });
});
