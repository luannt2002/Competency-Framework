# FLOW D — Admin (rà 2026-08-20, chỉ phân loại chưa vá)

Bước:  6 ĐỦ · 10 THIẾU · 1 ĐỨT · 6 SAI

---
D1.1 Tạo workspace (blank/fork) | ĐỦ | onboarding/page.tsx:81,115; workspaces.ts:364,432
D1.2 Visibility Private | ĐỦ | visibility-toggle.tsx; workspace-admin.ts:62
D1.3 Đặt tên workspace | ĐỦ | workspace-admin.ts:34
D2.1 Invite nhập EMAIL | SAI | workspace-members.ts:54-57 — bắt paste user UUID, email lookup chưa nối
D2.2 Bulk import CSV | SAI | workspace-members.ts:170-233 — row là {userId UUID, role}, không parse email
D2.3 Role learner/editor khi mời | ĐỦ | workspace-members.ts:34,98,235 (có update/remove)
D2.4 Role owner assignable | THIẾU | workspace-members.ts:33-34 — owner ngoài assignableRole
D2.5 Email link invite → auto-join | THIẾU | insert thẳng workspace_members, không invite token/mail
D2.6 Progress riêng từng member | ĐỦ | schema user_node_progress; roster/page.tsx:163-188
D3.1 Bảng tổng quan progress | ĐỦ | roster/page.tsx:198-218; sidebar có link
D3.2 Cột Name | SAI | roster-table.tsx:46-49 — hiển thị shortId(UUID), không tên/email
D3.3 Cột Last Active | THIẾU | streaks.lastActiveDate có dữ liệu, không hiển thị
D3.4 Cờ At Risk | THIẾU | không có logic/chỗ hiển thị
D3.5 Skills gap matrix team | THIẾU | skills/page.tsx chỉ matrix cá nhân
D3.6 Export Excel progress từng member | SAI | exports.ts:83 — export matrix CỦA NGƯỜI XUẤT, không phải từng member
D3.7 Export PDF báo cáo tổng quan | SAI | exports.ts:145 — .html + tip in tay, không PDF thật
D4.1 Click member → profile | SAI | roster-table.tsx:161 — chỉ drawer phase-level
D4.2 Progress chi tiết node của member | THIẾU | chỉ phase-level
D4.3 Skills matrix của member đó | THIẾU | query cứng theo viewer
D4.4 Activity log per-member | THIẾU | audit là RBAC-wide, /u/[id] là public profile
D4.5 Giao task cho member | THIẾU | không có action gán node
D4.6 Nhắc nhở → notification | THIẾU | notifications chỉ list/count/markRead
D4.7 Verify skill | ĐỨT | evidence.ts:268 verifyEvidence đầy đủ logic — KHÔNG UI nào gọi (grep = 0)
