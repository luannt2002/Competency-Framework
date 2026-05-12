# Phân quyền hệ thống — Tài liệu nghiệp vụ

> **Đối tượng:** Product, vận hành, hỗ trợ người học. Phiên bản kỹ thuật ở
> [`docs/dev/RBAC_PERMISSIONS.md`](../dev/RBAC_PERMISSIONS.md).

## 1. Vì sao cần phân quyền?

Sản phẩm hiện tại giả định mỗi không gian học tập (workspace) chỉ có một
người dùng — chính là người tạo ra nó (owner). Mô hình đó đủ cho người học
solo, nhưng không đủ khi:

- Mentor hoặc giảng viên muốn cùng chỉnh lộ trình với học viên.
- Một nhóm chia sẻ chung một lộ trình (vd. team DevOps học cùng nhau).
- Người dùng muốn chia sẻ "chỉ xem" lộ trình của mình ra ngoài.
- Đội hỗ trợ cần can thiệp một workspace để gỡ lỗi mà không cần đổi
  chủ sở hữu.

Mô hình 7 bậc dưới đây trả lời rõ ai làm được gì, ở đâu, và lưu vết hành động
quan trọng để truy vết về sau.

## 2. 7 cấp quyền

Quyền hạn được tính bằng số nguyên — số càng lớn càng nhiều quyền. Để được
phép thao tác, mức quyền *thực tế* của người dùng phải `≥` mức yêu cầu của
thao tác.

| Cấp | Tên vai trò              | Lưu ở đâu                                | Ý nghĩa nghiệp vụ                                                            |
|----:|--------------------------|------------------------------------------|------------------------------------------------------------------------------|
| 100 | `super_admin`            | Biến môi trường `PLATFORM_ADMIN_USER_IDS` | Quản trị viên nền tảng — hỗ trợ, vận hành. Truy cập mọi workspace.            |
|  80 | `workspace_owner`        | Cột `owner_user_id` của bảng workspaces  | Chủ workspace. Toàn quyền: tạo, sửa, xoá, chuyển chủ.                         |
|  60 | `workspace_editor`       | Bảng `workspace_members`                 | Chỉnh sửa nội dung lộ trình (node, bài học, lab) nhưng không xoá đồ người khác.|
|  40 | `workspace_contributor`  | Bảng `workspace_members`                 | Thêm node con, thêm ghi chú của mình; không sửa nội dung người khác.          |
|  20 | `learner` (học viên)     | Bảng `workspace_members`                 | Đánh dấu tiến độ học, viết ghi chú cá nhân. Đây là mặc định khi mời thành viên.|
|  10 | `viewer` (chỉ xem)       | Bảng `workspace_members` hoặc mặc định    | Đã đăng nhập, chỉ xem. Thấy XP/streak nhưng không thay đổi gì được.           |
|   0 | `guest` (khách)          | Không có bản ghi                         | Chưa đăng nhập. Chỉ vào được `/share/*` và endpoint sức khoẻ.                 |

### Quy tắc chính
- Owner là **duy nhất** cho mỗi workspace, lưu ở `workspaces.owner_user_id`,
  không lưu vào `workspace_members`. Đổi owner = chuyển workspace.
- Một người chỉ có **một vai trò** trên một workspace (ràng buộc `UNIQUE`).
- Super admin có thể vào mọi workspace nhưng vẫn để lại dấu vết trong
  `audit_log` (xem §8).

## 3. Tóm tắt nhanh — Ai làm được gì?

| Thao tác                                        | Cấp tối thiểu          |
|-------------------------------------------------|------------------------|
| Xem workspace (đã đăng nhập)                    | `learner` (20)         |
| Đánh dấu hoàn thành bài học của mình            | `learner` (20)         |
| Ghi chú cá nhân theo node                       | `learner` (20)         |
| Thêm node con vào lộ trình                      | `contributor` (40)     |
| Sửa node người khác đã tạo                      | `editor` (60)          |
| Xoá node                                         | `owner` (80)           |
| Mời / xoá thành viên                            | `owner` (80)           |
| Chuyển quyền sở hữu workspace                   | `owner` (80)           |
| Truy cập workspace khác để hỗ trợ               | `super_admin` (100)    |

## 4. Trường hợp sử dụng điển hình

### 4.1 Học viên solo (mặc định hiện tại)
Người dùng đăng ký → tự tạo workspace → trở thành owner (80). Không thay đổi
gì so với hiện tại.

### 4.2 Mentor đồng hành
Owner mời mentor làm `editor` (60). Mentor có thể:
- Sửa tiêu đề, mô tả node học.
- Sắp xếp lại thứ tự bài.
- Thêm lab mới.
Nhưng mentor **không xoá** được node — chỉ owner mới làm được, để tránh
trường hợp xoá nhầm lộ trình học viên đang theo.

### 4.3 Đồng học (study group)
Mỗi thành viên được mời với vai trò `contributor` (40). Mọi người cùng thêm
bài học, lab; không ai sửa được nội dung người khác → tránh dẫm chân.

### 4.4 Học viên được mời (read + progress)
Vai trò `learner` (20). Họ xem được toàn bộ lộ trình, đánh dấu tiến độ riêng,
viết ghi chú riêng. Không thay đổi được cấu trúc.

### 4.5 Chia sẻ công khai "chỉ xem"
Bật visibility `public-readonly` ở workspace → khách chưa đăng nhập (`guest`)
truy cập được trang `/share/<slug>` và xem dạng đọc-only. Không có nút mark
done, không có nút edit.

### 4.6 Support / vận hành
Người được liệt kê trong `PLATFORM_ADMIN_USER_IDS` (cấu hình môi trường)
được nâng `super_admin` (100). Họ vào mọi workspace để xử lý hỗ trợ; mỗi
thao tác sửa/xoá đều ghi `actor_role = 'super_admin'` vào `audit_log` để
minh bạch về sau.

## 5. Cách thay đổi vai trò

| Ai làm                | Hành động                                              | Kết quả                                                          |
|-----------------------|--------------------------------------------------------|------------------------------------------------------------------|
| Owner                 | Mời người dùng + chọn vai trò                          | Tạo bản ghi `workspace_members(workspace_id, user_id, role)`.    |
| Owner                 | Thay đổi vai trò thành viên                            | Cập nhật cột `role`. Bản audit log lưu vai trò cũ + mới.         |
| Owner                 | Xoá thành viên                                          | Xoá bản ghi `workspace_members`. Họ về `viewer` (logged-in).     |
| Owner                 | Chuyển owner cho người khác                            | Cập nhật `workspaces.owner_user_id`. Owner cũ về `viewer` mặc định.|
| Super admin           | Thiết lập / huỷ super admin                             | Thay đổi biến môi trường `PLATFORM_ADMIN_USER_IDS` (devops).      |

## 6. Phân biệt page-level và action-level

Sản phẩm có hai lớp kiểm soát:

- **Page-level** — quyết định có cho vào trang `/w/<slug>` hay không. Hiện
  tại vẫn là kiểm tra owner đơn giản, sẽ được nới ra `learner` trong giai
  đoạn 2 để thành viên được mời cũng vào được.
- **Action-level** — quyết định ấn nút "Lưu", "Xoá", "Thêm node" có được
  phép hay không. Đây là phần đã triển khai trong PR này: mọi server action
  liên quan đến `tree_node` đều gọi `requireMinLevel(...)` trước.

Người dùng có thể *nhìn thấy* nút "Xoá" trên UI nhưng nếu cấp quyền không
đủ, server sẽ từ chối và trả lỗi rõ ràng. UI ở giai đoạn 2 sẽ chủ động ẩn
nút theo cấp quyền để trải nghiệm mượt hơn.

## 7. Bảo mật & quyền riêng tư

- **Không lộ sự tồn tại của workspace**: khi không có quyền vào, server trả
  cùng một thông điệp "không tìm thấy hoặc không có quyền". Người ngoài
  không phân biệt được workspace có tồn tại hay không.
- **Lưu vết hành động**: mọi thao tác CRUD trên node lộ trình được ghi
  vào `audit_log` cùng vai trò người làm tại thời điểm đó (snapshot). Sau
  này nếu có khiếu nại "ai đã xoá node X?" thì truy vết được.
- **Atomic mutation**: các câu UPDATE/DELETE đều có ràng buộc `workspace_id`
  bên trong câu lệnh — không thể "đánh tráo" id node sang workspace khác để
  vượt quyền.

## 8. Lưu vết (audit log)

Mỗi thao tác có rủi ro được lưu một dòng vào bảng `audit_log`:

| Cột            | Giá trị ví dụ                   | Ý nghĩa                                                  |
|----------------|---------------------------------|----------------------------------------------------------|
| `created_at`   | 2026-05-12 02:35:00+00          | Thời điểm hành động                                       |
| `actor_user_id`| `00000000-…-099`                | Ai làm                                                    |
| `actor_role`   | `workspace_owner`               | Vai trò tại thời điểm làm — không đổi khi vai trò sau này đổi |
| `action`       | `tree_node.update`              | Loại thao tác                                             |
| `resource_type`| `tree_node`                     | Loại tài nguyên                                           |
| `resource_id`  | `4a8b…`                         | ID node                                                   |
| `before` / `after` | JSON                        | Snapshot trước/sau khi đổi                                |

Bảng audit log được giữ ngay cả khi workspace bị xoá (cột `workspace_id`
chuyển về `NULL`) để phục vụ điều tra về sau.

## 9. Trường hợp đặc biệt — môi trường dev

Khi developer làm việc cục bộ với biến `DEV_AUTH_BYPASS_USER_ID`, người
dùng đó được tự động nâng `super_admin` để thao tác toàn quyền. Cơ chế này
**chỉ bật ở môi trường dev/test**, không hoạt động trên production build.

## 10. Các giới hạn hiện tại

Giai đoạn 1 của RBAC chỉ phủ hệ thống node lộ trình
(`tree_node.create/update/delete/toggle_done`). Các action khác (lessons,
labs, framework, exports) vẫn dùng cơ chế owner-only cũ. Giai đoạn 2 sẽ
phủ rộng dần.

## 11. Câu hỏi thường gặp

**Tôi mời nhầm người làm editor, làm sao thu hồi?**
Owner xoá người đó khỏi `workspace_members` (UI quản trị thành viên, giai
đoạn 2). Người đó lập tức trở về viewer (chỉ xem, không sửa được nữa).

**Người làm `learner` có thể đánh dấu hoàn thành cho người khác không?**
Không. Tiến độ học (`user_node_progress`) gắn với `user_id` riêng. Mỗi
học viên có tiến độ độc lập trên cùng một lộ trình.

**Super admin có sửa được node của mọi workspace không?**
Có. Nhưng mỗi lần sửa đều bị lưu vết trong `audit_log` với
`actor_role = 'super_admin'`. Đây là biện pháp minh bạch nội bộ.

**Khi chuyển owner, dữ liệu cũ có mất không?**
Không. Lộ trình, node, bài học, lab giữ nguyên. Chỉ cột
`workspaces.owner_user_id` đổi. Owner cũ về vai trò mặc định nếu không có
bản ghi `workspace_members` cho người đó.

## 12. Lộ trình triển khai

- ✅ Bậc 1: schema (`workspace_members`, `audit_log`), resolver, guard,
  audit writer.
- ✅ Bậc 1: phủ server action `tree_node.*` (PR này).
- ⏳ Bậc 2: phủ `lessons`, `labs`, `framework`, `exports`.
- ⏳ Bậc 2: UI quản trị thành viên ở `/w/<slug>/settings/members`.
- ⏳ Bậc 2: ẩn nút Sửa/Xoá theo cấp quyền của người dùng (cải thiện UX).
- ⏳ Bậc 3: chia sẻ public-read qua `/share/<slug>` (guest level).

## 13. Tham khảo

- Kỹ thuật chi tiết: [`docs/dev/RBAC_PERMISSIONS.md`](../dev/RBAC_PERMISSIONS.md)
- Mã nguồn chính:
  - [`src/lib/rbac/levels.ts`](../../src/lib/rbac/levels.ts)
  - [`src/lib/rbac/server.ts`](../../src/lib/rbac/server.ts)
  - [`src/lib/db/schema-rbac.ts`](../../src/lib/db/schema-rbac.ts)
  - [`src/actions/tree-nodes.ts`](../../src/actions/tree-nodes.ts)
