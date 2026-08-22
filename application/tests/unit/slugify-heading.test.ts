/**
 * Neo tiêu đề và link mục lục phải khớp — kiểm bằng chính hai đường sinh ra chúng.
 *
 * `MarkdownRenderer` đặt `id` lên thẻ tiêu đề; `parseHeadings()` sinh `href`
 * cho mục lục trỏ tới các `id` đó. Trước đợt này mỗi bên giữ một bản chép của
 * cùng một hàm, kèm chú thích "keep them identical" — mà chú thích còn trỏ sai
 * file (`node-toc.tsx`, nơi hàm đã chuyển đi từ lâu).
 *
 * Lệch một ký tự thì bấm mục lục không nhảy đi đâu cả, và KHÔNG có lỗi nào
 * hiện ra: trang vẫn 200, neo vẫn tồn tại, chỉ là không khớp. Đây đúng là loại
 * hỏng mà chỉ người dùng phát hiện ra.
 *
 * Bài quan trọng nhất là bài cuối: nó chạy `parseHeadings` trên markdown thật
 * rồi đối chiếu với `slugifyHeading` — nếu ai đó lại tách hai đường ra, nó đỏ.
 */
import { describe, it, expect } from 'vitest';
import { slugifyHeading } from '@/lib/learn/slugify-heading';
import { parseHeadings } from '@/lib/learn/parse-headings';

describe('bỏ dấu tiếng Việt', () => {
  it.each([
    ['Kiến trúc hệ thống', 'kien-truc-he-thong'],
    ['Đo lường hiệu năng', 'o-luong-hieu-nang'],
    ['Bảo mật & phân quyền', 'bao-mat-phan-quyen'],
    ['CI/CD với GitHub Actions', 'cicd-voi-github-actions'],
  ])('%s → %s', (input, expected) => {
    expect(slugifyHeading(input)).toBe(expected);
  });
});

describe('gom dấu nối và cắt hai đầu', () => {
  it.each([
    ['  Nhiều   khoảng   trắng  ', 'nhieu-khoang-trang'],
    ['--- Bắt đầu bằng gạch ---', 'bat-au-bang-gach'],
    ['Ký tự !@#$% lạ', 'ky-tu-la'],
    ['UPPERCASE', 'uppercase'],
  ])('%s → %s', (input, expected) => {
    expect(slugifyHeading(input)).toBe(expected);
  });
});

describe('trường hợp biên', () => {
  it('chuỗi rỗng', () => {
    expect(slugifyHeading('')).toBe('');
  });

  it('toàn ký tự bị loại thì ra chuỗi rỗng, không phải chuỗi toàn gạch', () => {
    expect(slugifyHeading('!!!???')).toBe('');
  });

  it('ổn định — gọi hai lần cho cùng kết quả', () => {
    const once = slugifyHeading('Kiến trúc hệ thống');
    expect(slugifyHeading(once)).toBe(once);
  });
});

describe('mục lục trỏ đúng vào neo mà renderer sinh ra', () => {
  it('href của parseHeadings khớp slugifyHeading cho mọi tiêu đề', () => {
    const md = [
      '# Tổng quan',
      'nội dung',
      '## Kiến trúc hệ thống',
      'nội dung',
      '### Đo lường & giám sát',
      'nội dung',
      '## CI/CD với GitHub Actions',
    ].join('\n\n');

    const headings = parseHeadings(md);
    expect(headings.length).toBeGreaterThan(0);

    for (const h of headings) {
      // `id` mà MarkdownRenderer sẽ đặt lên thẻ tiêu đề.
      const anchor = slugifyHeading(h.text);
      expect(h.slug, `mục lục "${h.text}" trỏ tới #${h.slug} nhưng neo là #${anchor}`).toBe(
        anchor,
      );
    }
  });

  it('không còn bản chép nào của hàm này trong src/', async () => {
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

    const viPham: string[] = [];
    for (const file of await walk('src')) {
      if (file.endsWith('slugify-heading.ts')) continue;
      const src = await fs.readFile(file, 'utf8');
      // Định nghĩa lại hàm cùng tên = một bản chép mới.
      if (/function slugifyHeading\s*\(/.test(src)) viPham.push(file);
    }

    expect(viPham, `còn bản chép: ${viPham.join(', ')}`).toEqual([]);
  });
});
