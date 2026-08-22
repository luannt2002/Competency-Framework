/**
 * Đích chuyển hướng sau đăng nhập chỉ được là đường dẫn nội bộ.
 *
 * Bối cảnh: audit gán `src/app/auth/callback/route.ts` là open redirect. Đo lại
 * thì KHÔNG PHẢI — với `${origin}${next}` và `origin` không có dấu `/` cuối, mọi
 * payload thử qua đều cho ra host của chính mình:
 *
 *   next="//evil.com"       -> https://app.example.com//evil.com  host=app.example.com
 *   next="///evil.com"      -> https://app.example.com///evil.com host=app.example.com
 *   next="https://evil.com" -> https://app.example.comhttps://... host=app.example.comhttps
 *
 * Nhưng an toàn ấy dựa vào một bất biến NGẦM về cách ghép chuỗi. Đổi sang
 * `new URL(next, origin)` — refactor trông vô hại — là `//evil.com` thoát ngay.
 * Nhóm test này khoá ràng buộc lại để nó không còn phụ thuộc vào cách ghép.
 *
 * Bản sao logic: `route.ts` là Route Handler, import thẳng vào vitest sẽ kéo
 * theo cả supabase server client. Bài cuối đối chiếu ngược với file thật để bản
 * sao không âm thầm lệch đi.
 */
import { describe, it, expect } from 'vitest';

const FALLBACK = '/onboarding';

function safeNextPath(raw: string | null): string {
  if (!raw) return FALLBACK;
  if (!raw.startsWith('/')) return FALLBACK;
  if (raw.startsWith('//') || raw.startsWith('/\\')) return FALLBACK;
  if (raw.includes('\\')) return FALLBACK;
  return raw;
}

describe('đường dẫn nội bộ hợp lệ thì giữ nguyên', () => {
  it.each(['/onboarding', '/w/abc', '/w/abc/n/xyz/practice', '/discover?q=1'])(
    '%s',
    (path) => {
      expect(safeNextPath(path)).toBe(path);
    },
  );
});

describe('mọi thứ có thể trỏ ra ngoài đều rơi về mặc định', () => {
  it.each([
    ['//evil.com', 'protocol-relative'],
    ['///evil.com', 'ba gạch'],
    ['/\\evil.com', 'gạch ngược sau gạch xuôi'],
    ['\\\\evil.com', 'hai gạch ngược'],
    ['https://evil.com', 'có scheme'],
    ['http://evil.com', 'có scheme'],
    ['evil.com', 'không mở đầu bằng /'],
    ['/w/a\\b', 'gạch ngược ở giữa'],
  ])('%s (%s)', (path) => {
    expect(safeNextPath(path)).toBe(FALLBACK);
  });

  it('thiếu hẳn tham số thì về mặc định', () => {
    expect(safeNextPath(null)).toBe(FALLBACK);
    expect(safeNextPath('')).toBe(FALLBACK);
  });
});

describe('bản sao không được lệch với route thật', () => {
  it('route.ts vẫn lọc next qua safeNextPath', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile('src/app/auth/callback/route.ts', 'utf8');

    expect(src).toMatch(/function safeNextPath/);
    expect(src).toMatch(/const next = safeNextPath\(searchParams\.get\('next'\)\)/);

    // Bốn nhánh từ chối phải còn đủ.
    const fn = src.slice(src.indexOf('function safeNextPath'));
    expect(fn).toMatch(/startsWith\('\/'\)/);
    expect(fn).toMatch(/startsWith\('\/\/'\)/);
    expect(fn).toMatch(/includes\('\\\\'\)/);
  });
});
