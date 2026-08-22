-- 0020_workspace_description.sql
--
-- `workspaces` không có cột mô tả (rà C1.3 — `\d workspaces` cho 10 cột, không
-- có `description`). Hệ quả không chỉ là thiếu một ô nhập:
--
--   * trang share phải chữa cháy bằng cách MƯỢN `description` của node gốc, và
--     chỉ khi cây có ĐÚNG một gốc — hai gốc trở lên là rơi về chuỗi chung chung
--     (share/[slug]/page.tsx:76). Cả hai workspace public trong DB đều có 2 gốc,
--     nên mô tả **không bao giờ hiện**, kể cả `og:description`.
--   * thẻ trên /discover không có gì để hiện ngoài cái tên — mất một tín hiệu
--     tin cậy ở đúng cửa vào của sản phẩm (rà E1.2).
--
-- 280 ký tự: đủ một hai câu, ngắn hơn một dòng tweet cũ. Giới hạn ở tầng zod,
-- không đặt CHECK ở DB — độ dài là quy ước sản phẩm, không phải bất biến dữ liệu.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS description text;
