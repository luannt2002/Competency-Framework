# FLOW C — Creator (rà 2026-08-20, chỉ phân loại chưa vá)

Bước:  15 ĐỦ · 3 THIẾU · 0 ĐỨT · 5 SAI

---
C1    Tạo workspace (tên/slug/mô tả) | SAI | workspaces.ts:432; onboarding/page.tsx:115 — wizard 3 bước, slug KHÔNG sửa được (settings:117 "fixed for MVP"), KHÔNG có trường Mô tả
C2.1  Empty state → /new | ĐỦ | w/[slug]/page.tsx:199-212
C2.2  Form tạo root node | SAI | new/page.tsx:74-127 — thiếu Est. minutes lúc tạo; type thiếu reading/video/tool, thừa stage/session/module/theory/task/capstone/custom
C2.3  Submit → redirect | ĐỦ | new/page.tsx:38-47; tree-nodes.ts:141
C2.4  Thêm bước con | ĐỦ | node-toolbar.tsx:219,413
C3.1  Edit body Markdown | ĐỦ | node-toolbar.tsx:477-512; tree-nodes.ts:263
C3.2  Resources video/doc/tool/lab/link | SAI | node-resources.ts:106; resource-add-dialog.tsx:29-33 — kind chỉ link|video|doc|book, thiếu tool/lab; không auto-fetch title
C3.3  Est. minutes | ĐỦ | node-toolbar.tsx:449 (chỉ set qua Edit sau khi tạo)
C4.1  Settings 3 lựa chọn visibility | SAI | settings/page.tsx:197-204 — chỉ toggle Private/Public, không phân biệt 2 chế độ private
C4.2  Share public không login | SAI | share/[slug]/page.tsx:100-108 — BUG: share page KHÔNG kiểm visibility, workspace private vẫn trả 200 full content (curl xác nhận) → LỘ LỘ TRÌNH PRIVATE
C4.3  Nút Fork trên share | ĐỦ | fork-button.tsx:17-48; workspaces.ts:484-560
C5.1  Analytics ai học/%/last active | SAI | audit/page.tsx:22-136 — là audit log mutation, không phải learning analytics; % có ở /roster nhưng last active không
C5.2  Phân tích stuck/drop-off | THIẾU | không có code
C5.3  Skills distribution team | THIẾU | /skills là matrix cá nhân
C5.4  Action từ insight | THIẾU | không có reminder/insight action
