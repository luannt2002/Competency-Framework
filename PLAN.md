# Kế hoạch nâng cấp — làm ngầm, không hỏi lại

> Chốt ngày 2026-08-20. Mốc gần nhất: commit `aa1eeac` (131 file, gates xanh).
> Quy tắc vận hành: **tự chạy hết mẻ, ping báo tiến độ, không xin phép giữa chừng.**
> Chỉ dừng lại hỏi khi (a) cần quyết định về diện mạo/hướng sản phẩm, hoặc
> (b) hành động ra ngoài máy (push, deploy, gửi dữ liệu đi).

---

## Luật bất di bất dịch

| Luật | Lý do đã trả giá |
|---|---|
| **Không viết số chưa chạy ra** | mọi "N query", "X ms", "route 200" phải kèm lệnh thật |
| **Bật DB trước khi kết luận app chậm** | `docker start competency-postgres`; container tắt làm request treo 13–15s |
| **Đo perf trên production build** | `next dev` compile on-demand, cùng một route dao động 0.3s → 13s |
| **Đếm query phải lọc `execute`** | log extended protocol ra 3 dòng `parse`/`bind`/`execute`, và có **HAI** dấu cách trước `execute` |
| **`ALTER SYSTEM` chạy riêng một lệnh** | `psql -c "a; b"` gộp thành transaction → lỗi |
| **Không `pnpm db:push`** cho tới khi gộp xong schema | `schema.ts` còn khai `exerciseKindEnum` → push sẽ ép `kind` về enum, phá migration 0006 |
| **Gates phải xanh trước khi commit** | `pnpm typecheck && pnpm lint && pnpm test && pnpm guard` |
| **Không thêm class vào `globals.css`** | 41 class là đủ; hệ màu vừa mất công quy về một mối |

---

## Đợt 1 — Bịt lỗ hổng "động cơ không có bàn đạp"

Hệ dạng bài đã mở (10 loại, `kind` là text, chấm trả `status` + `score`, có hàng
đợi chấm tay) **nhưng không màn nào cho người học làm bài**: 0 component gọi
`startLesson`/`submitExercise`, 0 route `/lesson` hay `/exercise`. Bảng
`exercises` có 72 dòng mà chưa route nào đọc. Đây là chỗ duy nhất đang là bánh vẽ.

- [ ] **1.1 — Trình chạy bài học.** Route dưới node: chọn dạng render theo
      `exercise_types.renderer`, có renderer chung ăn theo schema cho dạng tenant
      tự định nghĩa. Tự luận hiện ô soạn thảo + trạng thái "đang chờ chấm" thay vì
      đúng/sai. Nối `startLesson` → `submitExercise` → hiển thị `GradeResult`.
- [ ] **1.2 — Vòng đời tự luận khép kín.** Nộp → `pending_review` → người chấm thấy
      trong hàng đợi → chấm → thông báo về người học → điểm hiện trong tiến độ.
      Chạy thật một vòng, không chỉ test đơn vị.
- [ ] **1.3 — Gộp `schema-exercises.ts` vào `schema.ts`**, xoá `exerciseKindEnum`,
      gỡ bản khai trùng. Sau bước này `db:push` mới an toàn trở lại.
- [ ] **1.4 — `NOTIFICATION_KINDS` thêm `attempt.graded`** cho khớp DB.
- [ ] **1.5 — `src/types/index.ts`**: `ExerciseKind` nới từ union 6 giá trị thành
      `string` (đang trói `ai-generate.ts`).

## Đợt 2 — Hiệu năng, đo trên bản build

`next build` vừa **thất bại** vì `/sign-in` gọi `useSearchParams()` không bọc
Suspense → **app chưa từng deploy được**. Đã vá, đang build lại.

- [ ] **2.1 — Build xanh**, ghi lại kích thước bundle từng route.
- [ ] **2.2 — Đo lại latency + số query** trên bản production, so với dev
      (dev: `/` 3 query 0.56s · `/w/<slug>` 21 query 1.87s · DB chiếm 1–13%).
- [ ] **2.3 — Xử lý route nào lệch hẳn.** `/w/<slug>` 21 query là nhiều nhất;
      xác minh nó là hằng số chứ không tăng theo số node (đã kiểm sơ bộ: hằng số).
- [ ] **2.4 — Node 18 → 20.** Supabase cảnh báo mỗi lần build; `package.json`
      đã ghi `engines.node >= 20` nhưng máy đang chạy 18.

## Đợt 3 — Vá nốt các luồng còn lại

Flow B (Learner) đã rà: 19 đủ · 6 thiếu · 3 đứt · 6 sai → vá 13/15. Chưa rà C–G.

- [ ] **3.1 — B5.7** deep-link task → node trong `today-focus.tsx` (dữ liệu đã sẵn).
- [ ] **3.2 — B6.2** cột **Source** ở bảng skills (`level_source` đã ghi đúng ở 3 nơi,
      chỉ thiếu hiển thị).
- [ ] **3.3 — Rà Flow C** (Creator: tạo cây, thêm nội dung, publish, analytics).
- [ ] **3.4 — Rà Flow D** (Admin: setup team, invite, theo dõi, assign).
- [ ] **3.5 — Rà Flow E/F/G** (fork, gamification, chứng chỉ).

## Đợt 4 — Cô lập tenant, phần còn thiếu

Slug đã siết unique toàn cục (migration 0010). Còn hai lỗ.

- [ ] **4.1 — RLS.** 0/47 bảng bật, 0 policy. Lưu ý: app nối DB bằng user
      `postgres` (superuser) nên **RLS sẽ bị bỏ qua** — bật không thôi là diễn.
      Phải kèm: tạo role không-superuser, cấp quyền, chuyển `DATABASE_URL`,
      set GUC theo từng transaction. Rủi ro cao → làm sau cùng, có đường lùi.
- [ ] **4.2 — Guard bắt query thiếu `workspaceId`.** Quét AST các truy vấn chạm
      bảng workspace-scoped mà thiếu điều kiện tenant. Rẻ hơn RLS, chặn được
      phần lớn rủi ro.
- [ ] **4.3 — `lesson_skill_map`** là bảng nghiệp vụ duy nhất không có
      `workspace_id`. Xác minh nó luôn được join qua bảng đã scoped.

## Đợt 5 — Đa khách hàng thật sự

- [ ] **5.1 — Kích hoạt tầng tổ chức.** `organizations` + `org_members` +
      `workspaces.org_id` có schema nhưng **0 dòng code dùng**. Cần: tạo org,
      mời thành viên, org admin nhìn xuyên nhiều workspace.
      ⚠️ `PRODUCT_MINDSET.md` viết rõ "không phải LMS doanh nghiệp" — nên đây là
      **quyết định sản phẩm, phải hỏi trước khi làm**.
- [ ] **5.2 — White-label.** Hiện chỉ chọn trong 10 màu + 20 emoji cứng.
      Cần: logo, tên thương hiệu, màu tự do có kiểm contrast server-side.
- [ ] **5.3 — Tài khoản test khác vai.** Report pentest §7 chưa test được
      IDOR/RBAC 7 tier vì thiếu tài khoản. Seed 3 vai + hướng dẫn đăng nhập từng vai.
- [ ] **5.4 — Nới các enum cứng còn lại** (`evidence_kind`, `export_format`,
      `daily_task_kind`) theo đúng cách đã làm với `exercise_kind`.

## Đợt 6 — Hardening còn nợ từ report

- [ ] **6.1** strip HTML comment khi build · obfuscate email trong HTML.
- [ ] **6.2** Bỏ `DEV_AUTH_BYPASS` khi chạy bản production — hiện mọi khách vào
      đều là `super_admin` vì bypass là server-side, vô điều kiện.
- [ ] **6.3** Đo lại toàn bộ theo 6 trục của report và ghi số mới vào
      `luannt-tets.md`.

---

## Thứ tự ưu tiên

```
1.1 → 1.2 → 1.3        bịt bánh vẽ, mở khoá db:push
2.1 → 2.2              trả lời dứt điểm "còn lag không"
3.1 → 3.2              hai việc nhỏ, rẻ
4.2                    guard tenant (rẻ, chặn được nhiều)
3.3 → 3.4 → 3.5        rà nốt các luồng
5.2 → 5.3 → 5.4        white-label + test RBAC + nới enum
2.4 → 6.1 → 6.2        hardening
4.1                    RLS — rủi ro cao, làm cuối
5.1                    tầng tổ chức — HỎI TRƯỚC, lệch mindset sản phẩm
```

## Việc phải hỏi, không tự quyết

1. **Tầng tổ chức (5.1)** — trái với "không phải LMS doanh nghiệp" trong mindset.
2. **Push lên GitHub** — hành động ra ngoài máy.
3. **Đổi tông màu tổng thể** nếu có lúc nào cần (đã chốt: brand blue/red).
4. **Bỏ tính năng** nào đó để đổi lấy tốc độ.
