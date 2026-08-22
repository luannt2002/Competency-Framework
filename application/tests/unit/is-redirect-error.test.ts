/**
 * Không được nuốt tín hiệu điều hướng của Next.
 *
 * `redirect()` và `notFound()` báo hiệu bằng cách NÉM LỖI. Một `try/catch` bọc
 * quanh server action mà bắt luôn chúng sẽ biến thao tác THÀNH CÔNG thành thất
 * bại: dữ liệu đã ghi xong nhưng người dùng ở lại trang cũ kèm toast lỗi.
 *
 * Bẫy này có thật trong repo: `fork-button.tsx` vốn không có `try/catch` nào
 * (promise bị vứt), nên khi thêm catch để hiện lỗi thì phải nhớ chừa tín hiệu
 * điều hướng ra — nếu không, fork thành công sẽ báo "Fork không thành công"
 * ngay trước lúc chuyển trang.
 */
import { describe, it, expect } from 'vitest';
import { isNextControlFlowError } from '@/lib/is-redirect-error';

describe('nhận ra tín hiệu điều hướng của Next', () => {
  it('digest dạng NEXT_REDIRECT kèm tham số', () => {
    const err = Object.assign(new Error('NEXT_REDIRECT'), {
      digest: 'NEXT_REDIRECT;replace;/w/abc;307;',
    });
    expect(isNextControlFlowError(err)).toBe(true);
  });

  it('chỉ có message, không có digest — vẫn nhận ra', () => {
    expect(isNextControlFlowError(new Error('NEXT_REDIRECT'))).toBe(true);
  });

  it('notFound() cũng cùng cơ chế', () => {
    expect(isNextControlFlowError(new Error('NEXT_NOT_FOUND'))).toBe(true);
    expect(
      isNextControlFlowError(Object.assign(new Error('x'), { digest: 'NEXT_NOT_FOUND' })),
    ).toBe(true);
  });
});

describe('lỗi nghiệp vụ thật thì KHÔNG được nhận nhầm', () => {
  it.each([
    'WORKSPACE_NOT_FOUND',
    'WORKSPACE_NOT_PUBLIC',
    'SOURCE_SLUG_REQUIRED',
    'NO_HEARTS',
    'LESSON_NOT_FOUND',
  ])('%s', (msg) => {
    expect(isNextControlFlowError(new Error(msg))).toBe(false);
  });

  it('chuỗi có chứa NEXT_REDIRECT ở giữa thì không tính', () => {
    // Chỉ nhận khi digest BẮT ĐẦU bằng dấu hiệu, tránh nhận nhầm một thông báo
    // lỗi vô tình nhắc tới nó.
    expect(isNextControlFlowError(new Error('failed after NEXT_REDIRECT'))).toBe(false);
  });

  it('giá trị không phải object thì không nổ', () => {
    expect(isNextControlFlowError(null)).toBe(false);
    expect(isNextControlFlowError(undefined)).toBe(false);
    expect(isNextControlFlowError('NEXT_REDIRECT')).toBe(false);
    expect(isNextControlFlowError(42)).toBe(false);
  });
});

describe('không còn bản chép tay nào', () => {
  it('mọi catch quanh server action đều dùng helper chung', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');

    async function walk(dir: string, out: string[] = []): Promise<string[]> {
      for (const name of await fs.readdir(dir)) {
        const full = path.join(dir, name);
        if ((await fs.stat(full)).isDirectory()) await walk(full, out);
        else if (/\.tsx?$/.test(full)) out.push(full);
      }
      return out;
    }

    const files = await walk('src');
    const viPham: string[] = [];

    for (const file of files) {
      if (file.endsWith('is-redirect-error.ts')) continue;
      const src = await fs.readFile(file, 'utf8');
      const code = src
        .split('\n')
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join('\n');
      // So sánh chuỗi tay với 'NEXT_REDIRECT' là dấu hiệu của một bản chép.
      if (/===\s*'NEXT_REDIRECT'|===\s*"NEXT_REDIRECT"/.test(code)) viPham.push(file);
    }

    expect(viPham, `còn bản chép tay: ${viPham.join(', ')}`).toEqual([]);
  });
});
