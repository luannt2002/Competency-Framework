# FLOW A — Viewer khám phá (rà 2026-08-20, chỉ phân loại chưa vá)
Bước:  7 ĐỦ · 1 THIẾU · 0 ĐỨT · 3 SAI
A1  /discover danh sách public | ĐỦ | discover/page.tsx:46 — lọc public-readonly, live 200
A2  /share tên + mô tả | ĐỦ | hero = root node title/description; gate private đúng
A3  Cây node tất cả level | SAI | share/page.tsx:160-172 — chỉ render 2 cấp, cấp sâu phải click từng node
A4  Badge "X nodes, Y% hoàn thành" | SAI | chỉ có X nodes + stats cấu trúc, không có % hoàn thành
A5  Resource từng node ngay trên share | SAI | ResourcesSection readOnly chạy nhưng nằm ở trang node; DB node_resources count=0
A6  Tiến độ creator (demo) | THIẾU | userId=null mọi query
A7  Không lộ tiến độ cá nhân khi chưa login | ĐỦ | readOnly, null userId
A8  Click node đọc nội dung | ĐỦ | share/n/[nodeSlug] live 200, MD + TOC + breadcrumb
A9  CTA Fork cuối trang | ĐỦ | xác nhận text xuất hiện 2 lần trong HTML
A10 OG image | ĐỦ | /api/og 200 image/png
A11 Fork → đăng ký | ĐỦ | /sign-in?next=... đúng
A12 Bounce | ĐỦ | —
Ghi chú: thiếu 2 yếu tố bằng chứng xã hội: % hoàn thành + tiến độ demo creator.
