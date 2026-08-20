---
name: cf-upgrade
description: Playbook nâng cấp Competency Framework từ "chạy được" lên "dùng được thật". Dùng khi user nói app chưa đạt, UI/UX xấu, custom chưa mạnh, chậm, hoặc muốn đưa các trục lên 5 sao. Gồm 6 trục có tiêu chí đo được, thứ tự làm, và cách chứng minh bằng số đo thật.
---

# Nâng cấp Competency Framework

Sản phẩm là **canvas để bất kỳ ai vẽ lộ trình học của mình** (`PRODUCT_MINDSET.md`) — không phải LMS doanh nghiệp, không phải platform nội dung. Ba vai: Creator / Learner / Admin. Mọi quyết định nâng cấp phải phục vụ ba vai đó, không phình ra ngoài.

## Hạ tầng — biết trước khi kết luận

| | |
|---|---|
| App | `Competency-Framework/application`, Next.js 15 App Router, pnpm |
| DB | container `competency-postgres`, cổng **5434**, db `competency` |
| Bật DB | `docker start competency-postgres` — **kiểm tra trước khi bảo app chậm** |
| Gates | `pnpm typecheck && pnpm lint && pnpm test && pnpm guard` (chạy trong `application/`) |
| Auth dev | `DEV_AUTH_BYPASS_USER_ID` trong `.env.local` → tự đăng nhập, RBAC cho **super_admin** khi `NODE_ENV !== production` |

## Sáu trục + tiêu chí đạt

| Trục | Đạt khi |
|---|---|
| **Tuỳ biến dạng bài** | Thêm dạng bài mới (tự luận, rubric, nộp file…) = thêm dòng DB, **không sửa code, không migration**. Chấm trả `status + score`, không phải boolean. Có hàng đợi chấm tay. |
| **White-label** | Tenant đặt được logo + tên thương hiệu + màu tự do (có kiểm contrast server-side), không chỉ chọn trong 10 màu / 20 emoji cứng. |
| **Cô lập tenant** | Slug không đụng nhau giữa 2 chủ sở hữu; mọi bảng nghiệp vụ có `workspace_id`; có guard tự động bắt query thiếu điều kiện workspace. |
| **Nhiều người dùng** | Đủ 7 tier RBAC, invite, roster, chứng chỉ, audit. Chứng minh bằng test cross-role thật (cần ≥2 tài khoản khác vai). |
| **Hiệu năng** | Đo trên **production build** (`next build && next start`), không đo trên `next dev`. Số query mỗi route là **hằng số**, không tăng theo số node. |
| **UI/UX** | Không tofu emoji; landing có nội dung đủ dày; spacing/consistency/responsive nhất quán; đủ trạng thái loading/empty/error. |

## Thứ tự làm — có lý do

1. **Bật DB + production build trước mọi phép đo.** Không làm bước này thì mọi kết luận hiệu năng đều sai: DB tắt làm request treo 13–15s, `next dev` compile on-demand làm latency dao động 0.3s→13s giữa các lần gọi liên tiếp.
2. **Vá đường đứt trước khi thêm màn mới.** Luồng đứt làm app "chưa dùng được" nhanh hơn là thiếu tính năng.
3. **Gỡ enum cứng trước khi làm đẹp.** Tuỳ biến là giá trị lõi của sản phẩm; UI đẹp trên một cái khung cứng vẫn không bán được.
4. **Đo lại sau mỗi trục**, ghi số vào báo cáo.

## Luật đo — không được vi phạm

- **Không viết con số chưa chạy ra.** Mọi "N query", "X ms", "route 200" phải có lệnh chạy thật kèm theo.
- Đếm query: log Postgres extended protocol ra **3 dòng** cho mỗi query (`parse`/`bind`/`execute`). Chỉ đếm `execute`, và có **hai dấu cách** trước chữ `execute` — `grep -cE 'ms +execute'`.
- Bật log: `ALTER SYSTEM SET log_min_duration_statement=0;` phải chạy **riêng một lệnh** (`ALTER SYSTEM` không chạy được trong transaction block, mà `psql -c "a; b"` gộp thành transaction).
- Đo latency phải **warm-up trước** để tách compile-time ra khỏi phép đo.
- Đo qua tunnel cộng thêm ~2.4s — luôn đo `localhost` khi kết luận về code.

## Agent chuyên trách

- `cf-flow-auditor` — nhận MỘT flow (A→G) trong `USER_FLOWS.md`, đối chiếu code, phân loại ĐỦ/THIẾU/ĐỨT/SAI rồi vá.
- `cf-customization-builder` — gỡ enum cứng / whitelist hẹp, dựng registry dạng bài cắm được.

Giao mỗi agent một phạm vi hẹp. Không giao "làm hết đi".

## Bẫy đã gặp

- `.env.local` bị `.gitignore` — đúng, đừng commit. Nhưng `.env.example` thì có trên repo, giữ nó là placeholder.
- `next dev` + tunnel = số đo vô nghĩa. Luôn tách hai biến này ra.
- Emoji tofu □ không phải icon hỏng: font Outfit/Geist không có glyph emoji, phải đóng font stack bằng `var(--font-emoji)`.
