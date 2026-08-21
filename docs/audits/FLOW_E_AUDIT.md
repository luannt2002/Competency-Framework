# FLOW E — Fork & cộng đồng (rà 2026-08-20, chỉ phân loại chưa vá)
Bước:  11 ĐỦ · 0 THIẾU · 1 ĐỨT · 4 SAI
E1.1 Filter domain/số node/phổ biến/mới | SAI | discover-grid.tsx:30-33 — chỉ search substring, không sort
E1.2 Card tên + mô tả + số node + số fork | SAI | không select description, không track fork count cho workspace
E1.3 Click → /share | ĐỦ | slug sai 404 đúng
E2.1 Nút Fork trên share | ĐỦ | 2 chỗ, ẩn nếu owner
E2.2 Đăng nhập nếu chưa | ĐỦ | fork-button.tsx:27-36
E2.3 Chọn tên workspace mới | SAI | tên tự động "(Fork)", user không đặt được
E2.4a Copy toàn bộ cây | ĐỦ | workspaces.ts:506-553 idMap remap batch 200
E2.4b Copy resources | SAI | forkWorkspace KHÔNG copy nodeResources — MẤT DỮ LIỆU sau fork
E2.4c Copy nội dung | ĐỦ | bodyMd/description/meta/estMinutes
E2.4d Progress trống | ĐỦ | fresh hearts=5, streak=0
E3.0 Fork độc lập | ĐỦ | private, owner mới
E3.1 Xóa node | ĐỦ | deleteTreeNode + UI
E3.2 Thêm node | ĐỦ | createTreeNode + UI
E3.3 Đổi thứ tự node | ĐỨT | moveTreeNode (tree-nodes.ts:394) tồn tại, KHÔNG UI nào gọi
E3.4 Gắn resource | ĐỦ | dialog + xóa
E3.5 Chia sẻ fork | ĐỦ | visibility toggle → hiện /discover
Ghi chú: lỗi nặng nhất E2.4b (mất resources khi fork) và E3.3 (dead code có sẵn action).
