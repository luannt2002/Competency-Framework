/**
 * `forkTemplateCore` phải ghi trọn gói hoặc không ghi gì.
 *
 * Docstring đầu `src/actions/workspaces.ts` ghi "Copies, in one transaction" từ
 * lâu, nhưng cả file KHÔNG có `db.transaction` nào: hơn 10 bảng được ghi tuần
 * tự. Hỏng giữa chừng thì để lại một workspace vỡ dở — có dòng `workspaces`
 * nhưng thiếu skills/lessons — mà người dùng không xoá được, và fork lại cũng
 * không được vì `reserveWorkspaceSlug` thấy slug đã bị chiếm nên đẻ ra
 * `slug-2`, `slug-3`.
 *
 * Không gọi thẳng `forkTemplateCore` được (nó cần `requireUser()`), nên test
 * này kiểm ĐÚNG TÍNH CHẤT cần có: một chuỗi ghi nhiều bảng bọc trong
 * `db.transaction` thì khi ném lỗi ở giữa, KHÔNG dòng nào còn lại.
 *
 * Bài cuối đối chiếu ngược với file thật để tính chất ấy không âm thầm mất đi.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { eq, inArray, like } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaces, skillCategories } from '@/lib/db/schema';

const TAG = `${process.pid}-${process.hrtime.bigint()}`;
const OWNER = '00000000-0000-0000-0000-00000000f0f0';
const SLUG = `it-fork-tx-${TAG}`;

afterAll(async () => {
  const rows = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(like(workspaces.slug, `it-fork-tx-${TAG}%`));
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return;
  await db.delete(skillCategories).where(inArray(skillCategories.workspaceId, ids));
  await db.delete(workspaces).where(inArray(workspaces.id, ids));
});

describe('ghi nhiều bảng trong transaction thì hỏng giữa chừng không để lại gì', () => {
  it('lỗi sau khi đã ghi workspace + category → cả hai đều biến mất', async () => {
    await expect(
      db.transaction(async (tx) => {
        const [ws] = await tx
          .insert(workspaces)
          .values({
            slug: SLUG,
            name: 'IT fork transaction',
            visibility: 'private',
            ownerUserId: OWNER,
          })
          .returning({ id: workspaces.id });

        await tx.insert(skillCategories).values({
          workspaceId: ws!.id,
          slug: `cat-${TAG}`,
          name: 'Category',
        });

        // Mô phỏng hỏng giữa chừng: đúng dạng `if (!insertedX) continue` hoặc
        // một ràng buộc DB nổ ở giữa chuỗi fork.
        throw new Error('FORK_FAILED_MIDWAY');
      }),
    ).rejects.toThrow('FORK_FAILED_MIDWAY');

    // Đếm bằng query, không tin exception: hàm có thể ném lỗi sau khi đã ghi.
    const leftover = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, SLUG));

    expect(leftover, 'workspace vỡ dở còn sót lại sau khi transaction hỏng').toEqual([]);
  });

  it('không có transaction thì hàng vỡ dở Ở LẠI — đây là hành vi cũ', async () => {
    const slugBad = `${SLUG}-khong-tx`;

    // Ghi không bọc transaction, rồi "hỏng".
    const [ws] = await db
      .insert(workspaces)
      .values({
        slug: slugBad,
        name: 'IT fork khong tx',
        visibility: 'private',
        ownerUserId: OWNER,
      })
      .returning({ id: workspaces.id });

    // Hàng vẫn còn — chính là workspace vỡ dở mà người dùng không xoá được.
    const leftover = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, slugBad));
    expect(leftover).toHaveLength(1);

    // Dọn tay cho sạch.
    await db.delete(workspaces).where(eq(workspaces.id, ws!.id));
  });
});

describe('forkTemplateCore giữ nguyên transaction', () => {
  it('chuỗi ghi nằm trong db.transaction, audit và revalidate nằm ngoài', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile('src/actions/workspaces.ts', 'utf8');

    // Bỏ chú thích TRƯỚC khi soi. Chú thích ở đây có nhắc `db.transaction` và
    // `await db.` để giải thích lỗi cũ — đó là điều nên khuyến khích, không
    // nên bị test phạt.
    const code = src
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join('\n');

    const start = code.indexOf('async function forkTemplateCore');
    expect(start).toBeGreaterThan(-1);
    const end = code.indexOf('\nexport async function forkTemplate(', start);
    const body = code.slice(start, end);

    expect(body).toMatch(/await db\.transaction\(async \(tx\) => \{/);

    // Trong transaction không được còn lời gọi `db.` trực tiếp nào.
    //
    // Neo điểm đóng vào `return ws;` + dấu đóng ngay sau nó, KHÔNG dùng
    // `lastIndexOf('  });')` — dấu đóng cuối cùng trong đoạn này là của
    // `writeAudit`, nên nó cho ra một phạm vi rộng hơn transaction và làm phép
    // kiểm dưới luôn sai.
    const txStart = body.indexOf('db.transaction');
    const txEnd = body.indexOf('return ws;', txStart);
    expect(txEnd, 'không tìm thấy điểm đóng transaction').toBeGreaterThan(txStart);

    const inside = body.slice(txStart, txEnd);
    expect(inside).not.toMatch(/await db\./);

    // writeAudit phải nằm SAU khi transaction đóng — nhật ký một việc đã thành
    // công thì chỉ ghi khi việc đó thật sự commit.
    expect(body.indexOf('await writeAudit(')).toBeGreaterThan(txEnd);
  });
});
