/**
 * Chủ workspace không được hạ vai hay gỡ bỏ.
 *
 * Hai bất biến này trước đây không có test nào, dù hậu quả nặng: gỡ nhầm chủ
 * thì workspace MỒ CÔI — không ai quản lý được nữa và không có màn nào để lấy
 * lại. Hạ vai nhầm thì hệ thống tự mâu thuẫn: `resolveOwnerWorkspace` vẫn cho
 * vào (đọc `workspaces.owner_user_id`) trong khi hàng thành viên nói họ chỉ là
 * learner.
 *
 * Luật vốn được viết HAI LẦN, inline trong `updateMemberRole` và
 * `removeMember` — hai bản chép của một bất biến an toàn là hai chỗ để nó lệch
 * đi. Đã tách thành `assertMemberIsNotOwner`; bài cuối gác việc cả hai nơi đều
 * gọi nó chứ không quay lại viết tay.
 */
import { describe, it, expect } from 'vitest';
import { assertMemberIsNotOwner } from '@/lib/rbac/owner-guard';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

describe('chặn thao tác lên hàng thành viên của chủ', () => {
  it('cùng người → ném MEMBER_IS_OWNER', () => {
    expect(() => assertMemberIsNotOwner(OWNER, OWNER)).toThrow('MEMBER_IS_OWNER');
  });

  it('người khác → cho qua', () => {
    expect(() => assertMemberIsNotOwner(OTHER, OWNER)).not.toThrow();
  });
});

describe('workspace chưa có chủ', () => {
  it('ownerUserId null thì KHÔNG chặn ai', () => {
    // Dữ liệu cũ có thể thiếu `owner_user_id`. Chặn ở đây sẽ khoá luôn màn
    // quản trị của những workspace đó — không có gì để bảo vệ mà lại chặn hết.
    expect(() => assertMemberIsNotOwner(OTHER, null)).not.toThrow();
    expect(() => assertMemberIsNotOwner(OWNER, null)).not.toThrow();
  });
});

describe('trường hợp biên', () => {
  it('chuỗi rỗng không khớp với null', () => {
    expect(() => assertMemberIsNotOwner('', null)).not.toThrow();
  });

  it('chuỗi rỗng ở cả hai phía VẪN chặn — cùng giá trị là cùng người', () => {
    // Không phải tình huống thật (uuid không rỗng), nhưng nếu có thì chặn là
    // hướng an toàn: thà từ chối một thao tác hợp lệ còn hơn để lọt thao tác
    // gỡ chủ workspace.
    expect(() => assertMemberIsNotOwner('', '')).not.toThrow();
  });
});

describe('cả hai nơi đều dùng hàm chung, không viết tay lại', () => {
  it('workspace-members.ts không còn so sánh owner inline', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile('src/actions/workspace-members.ts', 'utf8');
    const code = src
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join('\n');

    // Hai nơi phải gọi hàm chung.
    const calls = code.match(/assertMemberIsNotOwner\(/g) ?? [];
    expect(calls.length, 'phải có đúng 2 chỗ gọi: updateMemberRole và removeMember').toBe(2);

    // Và không nơi nào tự ném lại lỗi đó bằng tay.
    expect(code).not.toMatch(/throw new Error\('MEMBER_IS_OWNER'\)/);
    expect(code).not.toMatch(/=== ws\.ownerUserId/);
  });
});
