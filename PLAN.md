ogic quan trọng?"17. "Từng review code đồng nghiệp và phát hiện bug nghiêm trọng chưa? Bạn feedback thế nào để không gây khó chịu?"## 📌 Câu hỏi tình huống (behavioral + technical kết hợp)18. "Nếu được giao 1 API cũ chạy chậm dần theo thời gian, không ai biết vì sao — bạn tiếp cận vấn đề theo thứ tự nào?"19. "Bạn ước lượng efort cho 1 task như th ếnào? Có lần nào ước lượng sai nhiều không, vì sao?"---**Gợi ù cch ùdộng b ộnày:** với ứng viên thực sự có kinh nghiệm, câu trả lời sẽ có **chi tiết cụ thể** (tên tool, con số, tình huống thật) thay vì trả lời theo sách vở. Nếu ứng viên trả lời câu 9, 11, 4 mà mơ hồ, chung chung → khả năng cao là chưa thực chiến nhiều dù CV ghi 3-4 năm kinh nghiệm.Bạn cần mình soạn thêm **đáp án mẫu / rubric chấm điểm** cho từng câu để phỏng vấn cho khách quan hơn không?
đọc thên thửu duddocj thêm thử đi bhes đọc# Kế hoạch nâng cấp — làm ngầm, không hỏi lại

> Chốt ngày 2026-08-20. Mốc gần nhất: commit `d9c76ac`.
> Trạng thái chi tiết từng luồng: `application/docs/dev/FLOW_STATUS.md`.
>
> **Đợt 1 và 2 đã xong.** 252 test xanh · lint 0 · guard ×3 sạch · RBAC 11/11 ·
> build production từ FAIL → xanh · mọi route 28–110ms.
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
| ~~Không `pnpm db:push`~~ — **đã gỡ mìn ở 1.3** | `schema.ts` từng khai `exerciseKindEnum` nên push sẽ ép `kind` về enum và phá migration 0006. Giờ schema TS khớp DB, push an toàn trở lại |
| **Gates phải xanh trước khi commit** | `pnpm typecheck && pnpm lint && pnpm test && pnpm guard` |
| **Không thêm class vào `globals.css`** | 41 class là đủ; hệ màu vừa mất công quy về một mối |

---

## Đợt 1 — Bịt lỗ hổng "động cơ không có bàn đạp"

Hệ dạng bài đã mở (10 loại, `kind` là text, chấm trả `status` + `score`, có hàng
đợi chấm tay) **nhưng không màn nào cho người học làm bài**: 0 component gọi
`startLesson`/`submitExercise`, 0 route `/lesson` hay `/exercise`. Bảng
`exercises` có 72 dòng mà chưa route nào đọc. Đây là chỗ duy nhất đang là bánh vẽ.

- [x] **1.1 — Trình chạy bài học.** Route dưới node: chọn dạng render theo
      `exercise_types.renderer`, có renderer chung ăn theo schema cho dạng tenant
      tự định nghĩa. Tự luận hiện ô soạn thảo + trạng thái "đang chờ chấm" thay vì
      đúng/sai. Nối `startLesson` → `submitExercise` → hiển thị `GradeResult`.
- [x] **1.2 — Vòng đời tự luận khép kín.** Nộp → `pending_review` → người chấm thấy
      trong hàng đợi → chấm → thông báo về người học → điểm hiện trong tiến độ.
      Chạy thật một vòng, không chỉ test đơn vị.
- [x] **1.3 — Gộp `schema-exercises.ts` vào `schema.ts`**, xoá `exerciseKindEnum`,
      gỡ bản khai trùng. Sau bước này `db:push` mới an toàn trở lại.
- [x] **1.4 — `NOTIFICATION_KINDS` thêm `attempt.graded`** cho khớp DB.
- [x] **1.5 — Nới ba cửa còn khoá tập dạng bài**: `types/index.ts` (`ExerciseKind`
      union đóng → mở), và `framework/payload-schema.ts` — chỗ này quan trọng hơn:
      `exerciseSeed.kind` còn ghim 6 giá trị cũ nên **importer không seed nổi**
      essay/rubric/dạng của tenant. Hệ mở mà cửa vào vẫn khoá.

## Đợt 2 — Hiệu năng, đo trên bản build

`next build` từng **thất bại** vì `/sign-in` gọi `useSearchParams()` không bọc
Suspense → **app chưa từng deploy được**, chỉ chạy nổi bằng `next dev`. Đã vá,
build xanh. Đo thật (trung vị 5 lần, cùng DB): prod nhanh hơn dev **3–11×**,
mọi route **28–110ms**; query/render là hằng số, không tăng theo số node.

- [x] **2.1 — Build xanh**, ghi lại kích thước bundle từng route.
- [x] **2.2 — Đo lại latency + số query** trên bản production, so với dev
      (dev: `/` 3 query 0.56s · `/w/<slug>` 21 query 1.87s · DB chiếm 1–13%).
- [x] **2.3 — Xử lý route nào lệch hẳn.** `/w/<slug>` 21 query là nhiều nhất;
      xác minh nó là hằng số chứ không tăng theo số node (đã kiểm sơ bộ: hằng số).
- [x] **2.4 — Node 18 → 20.** ✅ 2026-08-20: cài Node 20.19.5 user-local ở
      `~/.local/node20` (không đụng hệ thống). Typecheck/lint/252 test/build
      production đều xanh trên Node 20. Bản prod 3210 đang chạy Node 20.
      Còn: dev server 3000 vẫn Node 18 (tiện thì restart bằng
      `PATH=~/.local/node20/bin:$PATH pnpm dev`).

## Đợt 3 — Vá nốt các luồng còn lại

Flow B (Learner) đã rà đủ 34 bước: 19 đủ · 6 thiếu · 3 đứt · 6 sai → **vá 15/15**
(B5.7 xong ở đợt trình chạy bài; chỉ còn B6.2). Flow A, C, D, E, G **chưa rà bước
nào**; Flow F mới nối XP/streak, còn hearts/badge/crown.

- [x] **3.1 — B5.7** deep-link task → node trong `today-focus.tsx` (dữ liệu đã sẵn).
- [x] **3.2 — B6.2** ✅ cột **Source** đã hiển thị (page + API + type + bảng).
      Kiểm chứng trên DB thật: `level_source=both` → "Self + learned".
- [x] **3.3 — Rà Flow C** ✅ 2026-08-20: 15 ĐỦ · 3 THIẾU · 0 ĐỨT · 5 SAI —
      chi tiết `docs/audits/FLOW_C_AUDIT.md`. Đã vá luôn bug nặng nhất
      (C4.2: `/share/<slug>` lộ lộ trình private → giờ 404 với người ngoài,
      public vẫn 200, metadata không lộ). Còn 4 SAI + 3 THIẾU chưa vá
      (slug không sửa được, thiếu trường Mô tả, type thiếu reading/video/tool,
      resource thiếu tool/lab, visibility 2 thay vì 3, analytics C5).
- [x] **3.4 — Rà Flow D** ✅ 2026-08-20: 6 ĐỦ · 10 THIẾU · 1 ĐỨT · 6 SAI —
      chi tiết `docs/audits/FLOW_D_AUDIT.md`. Chưa vá (đáng chú ý: invite
      bắt paste UUID thay vì email; roster hiện shortId thay vì tên;
      `verifyEvidence` đầy đủ logic mà không UI nào gọi; export là của
      người xuất chứ không phải từng member).
- [ ] **3.5 — Rà Flow E/F/G** (fork, gamification, chứng chỉ).

## Đợt 4 — Cô lập tenant, phần còn thiếu

Slug đã siết unique toàn cục (migration 0010). Còn hai lỗ.

- [ ] **4.1 — RLS.** 0/47 bảng bật, 0 policy. Lưu ý: app nối DB bằng user
      `postgres` (superuser) nên **RLS sẽ bị bỏ qua** — bật không thôi là diễn.
      Phải kèm: tạo role không-superuser, cấp quyền, chuyển `DATABASE_URL`,
      set GUC theo từng transaction. Rủi ro cao → làm sau cùng, có đường lùi.
- [x] **4.2 — Guard bắt query thiếu `workspaceId`.** ✅ 2026-08-20:
      `scripts/guard-tenant-scope.ts`, tự suy ra bảng scoped từ schema
      (hiện 43 bảng), đã vào chuỗi `pnpm guard`. Lần chạy đầu bắt 48 câu
      query trong 19 file → xử xong: **34 chỗ thêm điều kiện tenant thật**
      (defense-in-depth, không đổi hành vi), 14 chỗ line-allow có lý do
      (profile/inbox xuyên workspace theo userId, điều kiện trong biến,
      insert có workspaceId trong values).
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
- [x] **5.3 — Tài khoản test khác vai.** Report pentest §7 chưa test được
      IDOR/RBAC 7 tier vì thiếu tài khoản. Seed 3 vai + hướng dẫn đăng nhập từng vai.
- [ ] **5.4 — Nới các enum cứng còn lại** (`evidence_kind`, `export_format`,
      `daily_task_kind`) theo đúng cách đã làm với `exercise_kind`.

## Đợt 6 — Hardening còn nợ từ report

- [ ] **6.1** strip HTML comment khi build · obfuscate email trong HTML.
- [x] **6.2** ✅ kiểm chứng bằng phép thử thật 2026-08-20: bản prod (3210) qua
      tunnel công khai, mọi route app trả **307 → sign-in** (bypass tắt),
      `/share/<private>` trả 404, `/share/<public>` 200. Dev-bypass chỉ còn
      hiệu lực trên `next dev` (3000).
- [ ] **6.3** Đo lại toàn bộ theo 6 trục của report và ghi số mới vào
      `luannt-tets.md`.

---

## Đợt 7 — Vá theo kết quả rà 7/7 luồng (2026-08-20)

Bảng điểm rà: A 7/1/0/3 · B vá xong 15/15 · C 15/3/0/5 · D 6/10/1/6 ·
E 11/0/1/4 · F 10/5/0/4 · G 5/5/0/2 (đủ/thiếu/đứt/sai). Chi tiết `docs/audits/`.

### P1 — lỗi thật, rẻ, nặng hậu quả (làm ngay)

- [x] **7.1 E2.4b** ✅ fork copy `node_resources` (batch 200, idMap remap, activity log đếm resource).
- [x] **7.2 D4.7 + F5** ✅ nút Verify/Reject trong skill-drawer (EDITOR+), +30 XP `skill_verified` qua insertXpOnce (dedupe theo skill).
- [x] **7.3 G9** ✅ certificate A4 landscape 297×210mm.
- [x] **7.4 F10** ✅ refill thật: `src/lib/gamification/hearts.ts` — UPDATE atomic + gọi ở hearts API, topbar layout, submitExercise. 7 test mới.
- [x] **7.5 C2.2 + C3.2** ✅ node type reading/video/tool; resource kind tool/lab + migration 0011 (CHECK) + UI dialog + section.

### P2 — dùng được với người thật

- [x] **7.6 tên người dùng** ✅ không cần bảng mới: `src/lib/auth/user-display.ts` — Supabase Admin API getUserById, cache 5'. Roster + certificate + drawer hiện tên/email thay UUID.
- [x] **7.7 D2.1/D2.2** ✅ invite nhận email HOẶC UUID — findUserIdByEmail (Admin listUsers, cache). CSV bulk cũng resolve email. Giới hạn: người được mời phải đã đăng nhập ít nhất 1 lần (invite-token cho người chưa có tài khoản → mục P3 mới).
- [x] **7.8 F14** ✅ badge streak-3 'First Streak' + streak-100 'Century Learner' — seed + migration 0011 backfill (3 workspace × 2).
- [x] **7.9 F18** ✅ CrownCount: vàng (verified) / xanh primary (learned/both) / xám (self_claimed) — bảng + drawer.
- [x] **7.10 E3.3** ✅ nút Lên/Xuống trên node-toolbar gọi moveTreeNode.

### P3 — spec đầy đủ (làm sau, mỗi cái một mẻ)

- [x] **7.11 A4** ✅ badge "X% người hoàn thành" (trung bình các learner có tiến độ, helper thuần + 6 test) + A6 thanh "Người tạo đã hoàn thành Z%" (ẩn khi owner chưa có tiến độ).
- [x] **7.12 E1.1/E1.2** ✅ sort Mới nhất/Phổ biến nhất/Nhiều node nhất + filter theo loại root node; card có mô tả (line-clamp-2) + số fork thật (đếm distinct user từ activity_log workspace_forked). Chưa có cột forked_from — dùng activity_log, nếu sau này cần chính xác thì thêm cột.
- [x] **7.13 E2.3** ✅ ForkButton dialog đặt tên (default "X (Fork)", zod 1-80 ký tự), chưa login vẫn redirect sign-in.
- [x] **7.14 D3.3/D3.4** ✅ cột "Hoạt động" (hôm nay/X ngày trước, max của streaks.last_active_date và activity_log) + cờ At Risk amber (đã bắt đầu + ≥7 ngày + <100%), 6 test.
- [x] **7.15 G8/G10** ✅ bảng certificates (migration 0012) — issue khi xem cert ≥80%, giữ issuedAt/code gốc; route public /cert/<code> (noindex, revoked → 404, link share chỉ khi public); QR in trên sheet A4 (lib qrcode) + code Crockford base32 10 ký tự (5000 sample không trùng).
- [ ] **7.16 F8/F9/F11** hearts decay/skip/replay-earn (cân nhắc lại game design).
- [ ] **7.17 D3.6/D3.7** export theo member; **D4.x** drill-down member.
- [ ] **7.18 C5** analytics creator; **F16** custom badge CRUD; **A3** share full tree.

## Thứ tự ưu tiên

```
7.1 → 7.10            P1/P2 đợt vá 7 luồng (làm theo mẻ song song không đè file)
4.1                   RLS (đã có guard tenant chặn sóng to)
7.11 → 7.18           P3 từng mẻ
5.2 → 5.3 → 5.4       white-label + nới enum
6.1                   hardening còn lại
5.1                   tầng tổ chức — HỎI TRƯỚC
```

## Việc phải hỏi, không tự quyết

1. **Tầng tổ chức (5.1)** — trái với "không phải LMS doanh nghiệp" trong mindset.
2. **Push lên GitHub** — hành động ra ngoài máy.
3. **Đổi tông màu tổng thể** nếu có lúc nào cần (đã chốt: brand blue/red).
4. **Bỏ tính năng** nào đó để đổi lấy tốc độ.
