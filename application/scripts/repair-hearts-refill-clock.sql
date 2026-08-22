-- Sửa dữ liệu đã hỏng vì thiếu mốc hồi tim.
--
-- Bản vá trong src/lib/gamification/hearts.ts chỉ chặn hàng hỏng MỚI sinh ra.
-- Những hàng đã ở trạng thái `current < max` kèm `next_refill_at IS NULL` từ
-- trước vẫn kẹt vĩnh viễn: cả computeRefill lẫn gainedSql đều thoát sớm ở NULL,
-- nên tim không bao giờ hồi và người học không nộp được bài nữa.
--
-- Chạy:
--   docker exec -i competency-postgres psql -U postgres -d competency \
--     < scripts/repair-hearts-refill-clock.sql

BEGIN;

-- Xem trước thiệt hại.
SELECT
  COUNT(*) FILTER (WHERE current < max  AND next_refill_at IS NULL)     AS ket_vinh_vien,
  COUNT(*) FILTER (WHERE current >= max AND next_refill_at IS NOT NULL) AS day_nhung_con_moc,
  COUNT(*)                                                              AS tong_hang
FROM hearts;

-- 1. Hàng kẹt: mở đợt hồi NGAY (NOW(), không phải NOW() + 4h).
--    Những người này lẽ ra đã hồi tim suốt thời gian qua rồi; bắt họ chờ thêm
--    một chu kỳ nữa là phạt tiếp vì lỗi của hệ thống. Đặt mốc bằng NOW() để lần
--    đọc kế tiếp cấp lại 1 tim rồi chạy tiếp nhịp 4 giờ bình thường.
UPDATE hearts
   SET next_refill_at = NOW()
 WHERE current < max
   AND next_refill_at IS NULL;

-- 2. Hàng đầy tim mà còn sót mốc: xoá cho đúng quy ước
--    (NULL = không có đợt hồi nào đang chờ).
UPDATE hearts
   SET next_refill_at = NULL
 WHERE current >= max
   AND next_refill_at IS NOT NULL;

-- Kiểm lại: cả hai cột phải về 0.
SELECT
  COUNT(*) FILTER (WHERE current < max  AND next_refill_at IS NULL)     AS con_ket,
  COUNT(*) FILTER (WHERE current >= max AND next_refill_at IS NOT NULL) AS con_sot_moc
FROM hearts;

COMMIT;
