/**
 * Common utility helpers — tailwind class merge, formatters, etc.
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { relativeTimeVN } from './format-date';

/** Merge tailwind classes safely. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convert a string to a URL-safe slug. */
export function toSlug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * @deprecated Dùng `relativeTimeVN` ở `@/lib/format-date`.
 *
 * Bản này trả tiếng Anh ("just now", "5m ago") và kết thúc bằng
 * `toLocaleDateString()` không truyền locale — cùng một `Date` render khác nhau
 * giữa server và trình duyệt, gây lệch hydration.
 */
export function relativeTime(date: Date | string): string {
  return relativeTimeVN(date);
}

/** Clamp a number between min and max. */
export function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}
