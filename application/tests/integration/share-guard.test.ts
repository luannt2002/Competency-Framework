/**
 * `src/lib/share/guard.ts` — cửa duy nhất chặn workspace private rò ra Internet.
 *
 * Trước đợt này nó KHÔNG có một test nào, dù chú thích trong chính file ghi lại
 * một sự cố đã dựng lại được bằng curl ẩn danh: `/share/<private>` trả 404 đúng,
 * nhưng `/share/<private>/n/<node>` trả 200 kèm đầy đủ nội dung và
 * `/api/og?slug=<private>` trả PNG.
 *
 * Chạm DB thật vì luật nằm ở quan hệ owner/member, không phải ở phép tính thuần.
 *
 * Bài kiểm "không dò được slug" là bài quan trọng nhất: người ngoài phải không
 * phân biệt nổi "workspace không tồn tại" với "tồn tại nhưng bạn không được
 * xem". Hai kết quả khác nhau là một kênh rò rỉ danh sách khách hàng.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaces, workspaceMembers } from '@/lib/db/schema';
import {
  resolveShareableWorkspace,
  resolvePublicWorkspaceForCache,
} from '@/lib/share/guard';

const TAG = `${process.pid}-${process.hrtime.bigint()}`;
const OWNER = '00000000-0000-0000-0000-00000000sg01'.replace('sg01', '0f01');
const MEMBER = '00000000-0000-0000-0000-00000000sg02'.replace('sg02', '0f02');
const OUTSIDER = '00000000-0000-0000-0000-00000000sg03'.replace('sg03', '0f03');

const PUBLIC_SLUG = `it-share-public-${TAG}`;
const PRIVATE_SLUG = `it-share-private-${TAG}`;

let publicId = '';
let privateId = '';

beforeAll(async () => {
  const [pub] = await db
    .insert(workspaces)
    .values({
      slug: PUBLIC_SLUG,
      name: 'IT share public',
      visibility: 'public-readonly',
      ownerUserId: OWNER,
    })
    .returning({ id: workspaces.id });
  publicId = pub!.id;

  const [priv] = await db
    .insert(workspaces)
    .values({
      slug: PRIVATE_SLUG,
      name: 'IT share private',
      visibility: 'private',
      ownerUserId: OWNER,
    })
    .returning({ id: workspaces.id });
  privateId = priv!.id;

  await db.insert(workspaceMembers).values({
    workspaceId: privateId,
    userId: MEMBER,
    role: 'learner',
  });
});

afterAll(async () => {
  const ids = [publicId, privateId].filter(Boolean);
  if (ids.length === 0) return;
  await db.delete(workspaceMembers).where(inArray(workspaceMembers.workspaceId, ids));
  await db.delete(workspaces).where(inArray(workspaces.id, ids));
});

describe('resolveShareableWorkspace — workspace công khai', () => {
  it('người ẩn danh xem được', async () => {
    const ws = await resolveShareableWorkspace(PUBLIC_SLUG, null);
    expect(ws?.slug).toBe(PUBLIC_SLUG);
  });

  it('người lạ đã đăng nhập cũng xem được', async () => {
    const ws = await resolveShareableWorkspace(PUBLIC_SLUG, OUTSIDER);
    expect(ws?.slug).toBe(PUBLIC_SLUG);
  });
});

describe('resolveShareableWorkspace — workspace riêng tư', () => {
  it('CHẶN người ẩn danh', async () => {
    expect(await resolveShareableWorkspace(PRIVATE_SLUG, null)).toBeNull();
  });

  it('CHẶN người đã đăng nhập nhưng không phải thành viên', async () => {
    expect(await resolveShareableWorkspace(PRIVATE_SLUG, OUTSIDER)).toBeNull();
  });

  it('cho chủ sở hữu xem', async () => {
    const ws = await resolveShareableWorkspace(PRIVATE_SLUG, OWNER);
    expect(ws?.slug).toBe(PRIVATE_SLUG);
  });

  it('cho thành viên xem', async () => {
    const ws = await resolveShareableWorkspace(PRIVATE_SLUG, MEMBER);
    expect(ws?.slug).toBe(PRIVATE_SLUG);
  });
});

describe('không dò được slug nào tồn tại', () => {
  it('slug không tồn tại và slug bị cấm trả về CÙNG một kết quả', async () => {
    const khongTonTai = await resolveShareableWorkspace(`khong-he-co-${TAG}`, null);
    const biCam = await resolveShareableWorkspace(PRIVATE_SLUG, null);

    // Cả hai đều null — người ngoài không phân biệt được "không có" với
    // "có nhưng cấm". Khác nhau là rò danh sách workspace.
    expect(khongTonTai).toBeNull();
    expect(biCam).toBeNull();
    expect(khongTonTai).toEqual(biCam);
  });
});

describe('resolvePublicWorkspaceForCache — bề mặt bị cache dùng chung', () => {
  it('trả workspace công khai', async () => {
    const ws = await resolvePublicWorkspaceForCache(PUBLIC_SLUG);
    expect(ws?.slug).toBe(PUBLIC_SLUG);
  });

  it('CHẶN workspace riêng tư — kể cả khi bản dựng là do chủ sở hữu kích hoạt', async () => {
    // Hàm này cố ý không nhận người xem: ảnh OG cache ở edge một giờ và dùng
    // chung, nên bản dựng cho chủ sở hữu sẽ được phục vụ lại cho người lạ.
    expect(await resolvePublicWorkspaceForCache(PRIVATE_SLUG)).toBeNull();
  });

  it('slug không tồn tại trả null', async () => {
    expect(await resolvePublicWorkspaceForCache(`khong-he-co-${TAG}`)).toBeNull();
  });
});

/**
 * Bài kiểm quan trọng nhất, và là bài duy nhất bắt được ĐÚNG sự cố đã xảy ra.
 *
 * Lỗi cũ không nằm trong hàm guard — hàm luôn đúng. Lỗi là bề mặt MỚI (trang
 * node share, endpoint OG) được thêm vào mà quên đi qua cửa. Test hành vi của
 * hàm không bao giờ bắt được loại lỗi đó; chỉ có phép kiểm "mọi bề mặt đều gọi
 * cửa" mới bắt được.
 */
describe('mọi bề mặt /share phải đi qua cửa', () => {
  it('không bề mặt share nào tự truy vấn bảng workspaces', async () => {
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

    const surfaces = [
      ...(await walk('src/app/share')),
      ...(await walk('src/app/api/og')),
    ];

    // Có bề mặt để kiểm — nếu đường dẫn đổi, test phải đỏ chứ không im lặng pass.
    expect(surfaces.length).toBeGreaterThan(0);

    const viPham: string[] = [];
    for (const file of surfaces) {
      const src = await fs.readFile(file, 'utf8');
      const goiCua = /resolveShareableWorkspace|resolvePublicWorkspaceForCache/.test(src);
      const tuTruyVan = /\.from\(\s*workspaces\s*[),]/.test(src);
      if (tuTruyVan && !goiCua) viPham.push(file);
      // Bề mặt nào đọc workspace mà không qua cửa thì kể cả không truy vấn
      // trực tiếp cũng đáng ngờ — nhưng chỉ chặn cái đo được, không đoán.
    }

    expect(viPham, `bề mặt share tự truy vấn workspaces: ${viPham.join(', ')}`).toEqual([]);
  });

  it('cả ba bề mặt đã biết đều gọi cửa', async () => {
    const fs = await import('node:fs/promises');
    const expected = [
      'src/app/share/[slug]/page.tsx',
      'src/app/share/[slug]/n/[nodeSlug]/page.tsx',
      'src/app/api/og/route.tsx',
    ];

    for (const file of expected) {
      const src = await fs.readFile(file, 'utf8');
      expect(
        /resolveShareableWorkspace|resolvePublicWorkspaceForCache/.test(src),
        `${file} không gọi guard`,
      ).toBe(true);
    }
  });
});
