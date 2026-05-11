Bạn là **Full-stack Principal Engineer & UX Designer 2026** chuyên xây dựng các sản phẩm học tập và Internal Developer Platform đẹp, hiện đại và scalable.

**Nhiệm vụ:** Xây dựng web application tên **"DevOps Mastery"** – một Competency Framework + Interactive Learning Roadmap cho DevOps Engineer.

### Yêu cầu quan trọng của sản phẩm:
- Đây là **sản phẩm cá nhân** trước mắt, nhưng phải thiết kế theo kiến trúc **multi-workspace** từ đầu để dễ mở rộng sau này.
- Sử dụng **workspace_id** làm key chính để phân tách dữ liệu.
- Trước mắt sẽ load dữ liệu Competency Framework từ **2 Google Sheets** đã cung cấp.
- Thiết kế phải **ưu tiên UI/UX cực đẹp**, hiện đại, mượt mà, dark mode mặc định, phù hợp với DevOps engineer.

### Tech Stack (2026 best)
- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion
- **Backend**: Next.js Server Actions + API Routes
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (có thể mở rộng sau)
- **Icons & UI**: Lucide React + beautiful charts (Recharts hoặc Tremor)

### Kiến trúc quan trọng:
- Dùng **workspace_id** làm trung tâm (ví dụ: mặc định là "personal-devops-mastery" hoặc "main").
- Toàn bộ dữ liệu (skills, roadmap, progress, notes...) đều liên kết với `workspace_id`.
- Dễ dàng config thêm workspace mới sau này mà không cần hardcode nhiều logic.

### Tính năng chính (ưu tiên UI/UX đẹp):

1. **Competency Framework**
   - Import / Load dữ liệu từ 2 Google Sheets (2 tab)
   - Hiển thị Skills Matrix đẹp, filter, search, sortable
   - Self-Assessment với mức độ XS → S → M → L + ghi chú

2. **Interactive Learning Roadmap**
   - 4 Phase (12 tháng), Duolingo-style
   - Progress tracking theo level và kỹ năng
   - Mỗi tuần có keywords, labs, projects, resources

3. **Gamification & Progress**
   - XP, Streaks, Badges, Level-up animation đẹp
   - Dashboard overview rất trực quan

4. **Workspace System**
   - Hỗ trợ multiple workspace (dễ switch)
   - Dữ liệu của mỗi workspace độc lập

5. **User Experience cao cấp**
   - Sidebar navigation đẹp
   - Dark mode mặc định, animation mượt
   - Mobile friendly
   - Progress visualization mạnh (radar chart, heat map, progress rings...)

### Yêu cầu code:

Hãy tạo dự án với cấu trúc rõ ràng và sinh code chất lượng production:

**Bắt đầu output với:**
1. `README.md` – mô tả project, cách setup, cách load data từ Google Sheets
2. Database Schema (Supabase) – có bảng `workspaces`, `skills`, `user_skill_progress`, `roadmap_phases`, `weeks`, `tasks`, `resources`, `user_notes`...
3. Các trang chính: Dashboard, Skills Matrix, Roadmap, Assessment, Profile

**Quan trọng:**
- Code phải sạch, có comment tốt, dễ maintain.
- Thiết kế DB và logic phải hỗ trợ nhiều workspace ngay từ đầu.
- UI/UX phải cực kỳ đẹp và chuyên nghiệp (dùng shadcn/ui + custom styling).

Bây giờ hãy bắt đầu xây dựng dự án **DevOps Mastery** với chất lượng cao nhất.
https://docs.google.com/spreadsheets/d/1mejAsbHOU2c2GEQ3hTs2_sQyXD4vxgtttsuy7dRbTvw/edit?gid=1970847068#gid=1970847068
https://docs.google.com/spreadsheets/d/1mejAsbHOU2c2GEQ3hTs2_sQyXD4vxgtttsuy7dRbTvw/edit?gid=1890838692#gid=1890838692

Thêm Multi-tenant (nhiều team trong 1 app)?
Thêm Export PDF/Excel competency matrix?

trước mắt là làm cía design cho multi tenant -> nhưng chưa code hẳn-> làm ra core win mvp project với Competency Framework trước nhé



trươc smawts dé