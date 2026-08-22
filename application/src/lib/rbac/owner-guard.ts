/**
 * Chủ workspace không được hạ vai hay gỡ bỏ qua màn quản trị thành viên.
 *
 * Quyền sở hữu lưu ở `workspaces.owner_user_id`, không ở `workspace_members`.
 * Nếu hàng thành viên của chủ bị hạ vai, hệ thống rơi vào trạng thái tự mâu
 * thuẫn: `resolveOwnerWorkspace` vẫn cho họ vào (vì đọc `owner_user_id`) trong
 * khi hàng thành viên nói họ chỉ là learner. Nếu bị GỠ HẲN thì workspace mồ
 * côi — không ai quản lý được nữa, và không có màn nào để lấy lại.
 *
 * Tách ra khỏi `actions/workspace-members.ts` vì hai lý do:
 *  - Cùng một luật đang được viết hai lần (updateMemberRole và removeMember).
 *    Hai bản chép của một bất biến an toàn là hai chỗ để nó lệch đi.
 *  - Hai hàm kia đều đi qua `requireUser()` nên vitest không gọi thẳng được;
 *    luật thì kiểm được, còn vỏ bọc thì không.
 */

/** Ném `MEMBER_IS_OWNER` nếu hàng thành viên này thuộc về chủ workspace. */
export function assertMemberIsNotOwner(
  memberUserId: string,
  ownerUserId: string | null,
): void {
  // `ownerUserId` null nghĩa là workspace chưa có chủ (dữ liệu cũ) — không có
  // gì để bảo vệ, và chặn ở đây sẽ khoá luôn màn quản trị của những workspace đó.
  if (ownerUserId && memberUserId === ownerUserId) {
    throw new Error('MEMBER_IS_OWNER');
  }
}
