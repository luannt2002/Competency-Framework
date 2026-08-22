/**
 * schema-badges.ts — bí danh giữ tương thích, KHÔNG còn là định nghĩa thứ hai.
 *
 * File này từng khai lại `pgTable('badges', …)` một lần nữa để thêm cột
 * `is_active` mà migration 0013 tạo ra, với lý do "schema.ts đang đóng băng".
 * Hậu quả: một bảng VẬT LÝ có hai định nghĩa lệch nhau, và drizzle-kit chỉ
 * nhìn thấy bản trong `schema.ts` — bản thiếu cột. Ngày 22/08/2026 một lần
 * `pnpm db:push --force` vì thế sinh ra `ALTER TABLE badges DROP COLUMN
 * is_active` và xoá cột thật khỏi DB.
 *
 * Cột đã được gộp về đúng chỗ trong `schema.ts`. Giữ tên `badgesAdmin` ở đây
 * để hai nơi đang import không phải sửa, nhưng nó chỉ còn là một cái tên khác
 * của cùng một đối tượng — không có bản sao nào nữa.
 *
 * Đừng khai lại bảng ở file khác để "thêm cột": sửa thẳng định nghĩa gốc.
 */
export { badges as badgesAdmin } from './schema';
