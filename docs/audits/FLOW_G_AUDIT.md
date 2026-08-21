# FLOW G — Certificate (rà 2026-08-20, chỉ phân loại chưa vá)

Bước:  5 ĐỦ · 5 THIẾU · 0 ĐỨT · 2 SAI

---
G1  Notification đủ điều kiện ≥80% | THIẾU | không có logic fire; UI thay thế: link "Chứng nhận của tôi" khi >=80% (w/[slug]/page.tsx:121-130)
G2  Route certificate | ĐỦ | /w/[slug]/certificate/[memberId] (thêm memberId so spec); reachable từ members page + workspace page
G3  Tên người học trên cert | SAI | hiển thị subjectUserId (UUID) — "no profile system yet" (page.tsx:324)
G4  Tên lộ trình | ĐỦ | workspaceName render (:349)
G5  Ngày hoàn thành | ĐỦ* | "Ngày cấp" = new Date() lúc xem, không lưu issued date thật
G6  % hoàn thành + gate ≥80% | ĐỦ | tính từ userNodeProgress, gate (:136)
G7  Skills đã đạt trên cert | THIẾU | không query skill nào
G8  QR code verify | THIẾU | không có qrcode lib
G9  Export PDF A4 | SAI | window.print() nhưng sheet 210×297 PORTRAIT, spec landscape
G10 Share link /cert/[unique-id] | THIẾU | route /cert/* 404, không có bảng cert id
G11 Badge image LinkedIn | THIẾU | không có endpoint sinh ảnh
G12 Verify employer thấy progress thật | ĐỦ* | /share render progress thật nhưng KHÔNG được nối từ cert (thiếu QR/link) — chỉ nửa flow
