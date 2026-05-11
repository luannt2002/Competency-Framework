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
    it('shows "just now" for fresh date', () => {
      expect(relativeTime(new Date())).toBe('just now');
    });
    it('shows minutes', () => {
      const d = new Date(Date.now() - 5 * 60_000);
      expect(relativeTime(d)).toMatch(/\dm ago/);
    });
    it('shows hours', () => {
      const d = new Date(Date.now() - 3 * 3600_000);
      expect(relativeTime(d)).toMatch(/\dh ago/);
    });
    it('shows days', () => {
      const d = new Date(Date.now() - 3 * 24 * 3600_000);
      expect(relativeTime(d)).toMatch(/\dd ago/);
    });
  });
});
