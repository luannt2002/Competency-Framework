# Trạng thái các luồng — đã làm gì, còn làm gì

> Đối chiếu đặc tả `USER_FLOWS.md` (7 luồng A→G, 585 dòng) với code thật.
> Cập nhật: 2026-08-20, mốc `d9c76ac`.
>
> **Luật của tài liệu này: chỉ ghi thứ đã kiểm chứng.** Luồng chưa rà thì ghi
> "chưa rà", không suy đoán từ việc route có tồn tại — route trả 200 không có
> nghĩa là luồng chạy đúng. Flow B là ví dụ: mọi route đều 200 trong khi vòng
> lặp học đứt ở 9 chỗ.

---

## Tổng quan

| Luồng | Đã rà | Trạng thái |
|---|---|---|
| A — Viewer khám phá | **✅ 12 bước** (2026-08-20) | 7 đủ · 1 thiếu · 3 sai — `docs/audits/FLOW_A_AUDIT.md` |
| **B — Learner** | **✅ 34 bước** | 19 đủ · 6 thiếu · 3 đứt · 6 sai → **đã vá 15/15** |
| C — Creator | **✅ 23 bước** (2026-08-20) | 15 đủ · 3 thiếu · 0 đứt · 5 sai; đã vá C4.2 (share lộ private); còn lại `docs/audits/FLOW_C_AUDIT.md` |
| D — Admin | **✅ 23 bước** (2026-08-20) | 6 đủ · 10 thiếu · 1 đứt · 6 sai; chưa vá — `docs/audits/FLOW_D_AUDIT.md` |
| E — Fork & cộng đồng | **✅ 16 bước** (2026-08-20) | 11 đủ · 1 đứt · 4 sai — đã vá E2.4b (fork copy resources) + E3.3 (UI move node) — `FLOW_E_AUDIT.md` |
| F — Gamification | **✅ 19 bước** (2026-08-20) | 10 đủ · 5 thiếu · 4 sai — đã vá F5 (+30XP verify), F10 (refill thật), F14 (badge 3/100), F18 (crown màu) — `FLOW_F_AUDIT.md` |
| G — Certificate | **✅ 12 bước** (2026-08-20) | 5 đủ · 5 thiếu · 2 sai — đã vá G3 (tên thật), G9 (landscape) — `FLOW_G_AUDIT.md` |

**Hạ tầng đã xong, dùng chung cho mọi luồng:** hệ dạng bài mở · trình chạy bài
học · RBAC 7 tier có kiểm chứng · hệ màu thống nhất · build production.

---

## Flow B — Learner (đã rà đủ)

34 bước. Đã vá 15/15 lỗi. Bằng chứng là dữ liệu thật trong DB, không phải test đơn vị.

| Bước | Trước | Sau |
|---|---|---|
| B3.1 stats đầu trang | XP/streak **luôn 0** — không code nào award | `xp_events` có `node_complete 10`, `daily_task_complete 10`, `daily_streak 5` |
| B3.2 "Tiếp tục từ chỗ dừng" | **chết vĩnh viễn** — query `status='doing'`, không ai ghi `'doing'` | `user_node_progress` có `doing` |
| B3.4 trạng thái node | chỉ done / chưa done | ○ todo · ◑ doing · ● done + legend + aria-label |
| B3.5 quick actions | thiếu | 3 link |
| B3.6 hoạt động gần đây | `activity_log` ghi khắp nơi, **0 UI đọc** | `dashboard-rail` |
| B3.7 sắp tới + tóm tắt skill | thiếu | dùng chung `listUnfinishedLeafNodes` với planner |
| B4.4 "Đang học" | thiếu | `setNodeStatus` + nút |
| B4.5 gắn evidence | cột `evidence_urls` có, **không ai ghi** | action + dialog; DB có 2 dòng |
| B4.6 đánh dấu xong | gate con đúng, **không XP/streak/badge** | `awardNodeCompletion` (leaf 10 / lv2 50 / lv1 200 / root 500) |
| B5.1 planner gợi ý | task trỏ `lessons`/`labs` — **hai bảng đó không route nào**, bấm vào là ngõ cụt | trỏ `roadmap_tree_nodes`, ưu tiên `doing`, bỏ node >120 phút |
| B5.4 tick task xong | chỉ đổi status | + XP (replay trả 0) + streak |
| B5.5 thêm task tay | nút `disabled title="coming soon"` | chạy được |
| B5.6 empty state | sai chữ | đúng đặc tả |
| B5.7 deep-link task→node | dòng chữ chết | dẫn vào runner nếu node có bài, không thì vào node; ref không giải được thì **để nguyên chữ** chứ không dẫn sai |
| B6.2 cột Source | thiếu hiển thị (dữ liệu đã đúng) | **CÒN THIẾU** — xem "Việc còn lại" |

---

## Hệ dạng bài — từ đóng sang mở

Trước: `exercise_kind` là enum Postgres đúng 6 giá trị; bộ chấm là `switch` đóng
**chỉ trả `boolean`** nên không biểu diễn được tự luận (không có "chờ chấm"),
không có điểm thành phần, không biết ai chấm.

Sau: `kind` là text → tra `exercise_types` → `engine` + `gradingMode` +
`secretPaths` → `gradeAnswer()` trả `GradeResult { status, score, autoGraded }`.

- **Thêm dạng bài dùng engine sẵn có = 1 dòng DB.** Không sửa code, không migration.
- 10 built-in: 6 dạng cũ **giữ nguyên hành vi** (15 test cũ xanh, không sửa một
  chữ) + `essay` · `rubric` · `numeric_range` · `short_answer`.
- Ba cửa từng khoá, đã nới hết: `payload-schema.ts` (importer trước đây **không
  seed nổi** dạng mới), `types/index.ts`, `NOTIFICATION_KINDS`.

Vòng tự luận đo trên DB: nộp → `pending_review` (không phán đúng sai, XP 0) →
hàng đợi → chấm 80% → `partial`/`0.8` + người chấm + nhận xét → XP `20 =
round(25×0.8)`, chấm lại 4 lần nữa trả **0** → 6 thông báo `attempt.graded`.
Rubric `{t1:1, t2:0.6, t3:0}` trọng số 2/3/1 → `0.6333` tính ở server.

Dạng riêng của tenant (`sre_postmortem`, **không dòng code nào nhắc tên**) render
đúng nhãn và tiêu chí riêng. Quét rò rỉ trên toàn response **kể cả RSC payload**:
`correctId` `correctIds` `correctOrder` `accepts` `passThreshold` `modelAnswerMd`
`graderNotesMd` — vắng mặt hoàn toàn.

---

## Bug đã tìm ra (không phải tính năng, là lỗi thật)

| Bug | Vì sao nguy hiểm |
|---|---|
| `useSearchParams()` ở `/sign-in` không bọc Suspense | **`next build` fail → app chưa từng deploy được**, chỉ chạy nổi bằng `next dev` |
| `FadeInSection` đặt `threshold: 0.5` | tỷ lệ đó là diện tích giao ÷ diện tích phần tử → section cao hơn 2× viewport **không bao giờ đạt**, đứng nguyên `opacity: 0`. Ở 360px landing đúng cỡ đó |
| `startLesson` ghi `'in_progress'` vô điều kiện | **hạ cấp bài đã hoàn thành**. Ngủ yên vì chưa ai gọi; có runner là mỗi lần mở lại bài xong sẽ tụt hạng, mà 3 nơi đọc: `unlock-rules` khoá lại tuần, `badge-evaluator` ngừng đếm, planner hồi sinh bài |
| Drizzle render cột không định danh trong `sql\`\`` | subquery thành `WHERE "lesson_id" = "id"`, Postgres phân giải **cả hai** về bảng trong → đếm luôn ra 0, node hiện "chưa có câu hỏi nào" trong khi có 5 câu |
| `workspaces` chỉ unique `(owner_user_id, slug)` nhưng lookup tra slug đơn lẻ | 2 chủ sở hữu cùng slug → `/w/<slug>` trỏ ngẫu nhiên, người tạo sau **chiếm URL** của người trước |
| Font stack kết thúc bằng `sans-serif` trống | emoji lấy từ DB hiện ô vuông □ |
| `#cc785c` ở thanh loading kèm chú thích `// matches --primary` | `--primary` đã là xanh từ lâu — chú thích sai, màu lệch |

---

## Chất lượng — đo được

| | Trước đợt này | Nay |
|---|---|---|
| test | 93 | **252** (18 file) |
| lint | 52 lỗi | **0** |
| typecheck | — | xanh |
| màu tự chế | **209 chỗ / 49 file** | **0** (có guard chặn ở CI) |
| production build | **FAIL** | xanh |
| latency (prod, trung vị 5) | không đo được | **28–110 ms** mọi route |
| query/render (prod) | — | `/` 9 · `/discover` 3 · route workspace 0 (route cache) — **hằng số** |
| RBAC 7 tier | **chưa từng test** | **11/11**, gồm leo quyền chéo workspace |

---

## Việc còn lại

### Đợt 2026-08-20 (chiều) — đã làm
- **B6.2 cột Source** ✅ — page + API + type + cột bảng; DB có `both` →
  hiển thị "Self + learned".
- **Guard tenant (4.2)** ✅ — `scripts/guard-tenant-scope.ts` tự suy ra 43 bảng
  scoped từ schema, vào chuỗi `pnpm guard`. Lần đầu chạy bắt **48 câu query
  thiếu điều kiện tenant trong 19 file** → 34 chỗ thêm `eq(workspaceId)` thật,
  14 chỗ line-allow có lý do. Guard sạch.
- **Node 20 (2.4)** ✅ — `~/.local/node20`, mọi gate + build prod xanh trên 20.
  Bản prod 3210 chạy Node 20. Dev 3000 vẫn Node 18.
- **Rà Flow C + D (3.3/3.4)** ✅ — kết quả `docs/audits/FLOW_C_AUDIT.md` và
  `FLOW_D_AUDIT.md`. Vá luôn **C4.2: `/share/<slug>` trả full content cho
  workspace private** — giờ 404 với người ngoài (owner/member vẫn xem được),
  public 200, metadata không lộ.
- **6.2 kiểm chứng prod** ✅ — qua tunnel công khai: mọi route app 307 →
  sign-in (dev-bypass tắt ở prod), share private 404 / public 200.

### Gần — rẻ, làm được ngay
- **e2e `smoke.spec.ts` "landing page" đỏ sẵn từ trước** — kỳ vọng `h1` tiếng
  Anh, thực tế là tiếng Việt. Không thuộc thay đổi nào của đợt này.
- **Vá các SAI/THIẾU của Flow C** — slug không sửa được, thiếu Mô tả, type
  thiếu reading/video/tool, resource thiếu tool/lab + auto-fetch title.
- **Vá các SAI/THIẾU của Flow D** — invite bằng email (hiện bắt UUID), roster
  hiện tên thay shortId, nối UI vào `verifyEvidence` (logic sẵn, ĐỨT),
  export theo member.

### Rà nốt các luồng
Flow A, C, D, E, G chưa đối chiếu bước nào. Flow F mới nối XP/streak, còn
hearts/badge/crown. Cách làm đã có: xem `.claude/agents/cf-flow-auditor.md`,
mỗi lần một luồng, phân loại ĐỦ / THIẾU / ĐỨT / SAI rồi vá.

### Cô lập tenant — còn hai lỗ
- **Guard bắt query thiếu `workspaceId`.** Quét AST các truy vấn chạm bảng
  workspace-scoped mà thiếu điều kiện tenant. Rẻ, chặn được phần lớn rủi ro.
- **RLS: 0/47 bảng bật, 0 policy.** Lưu ý quan trọng: app nối DB bằng user
  `postgres` (superuser) nên **RLS sẽ bị bỏ qua** — bật không thôi là diễn.
  Phải kèm: tạo role không-superuser, cấp quyền, đổi `DATABASE_URL`, set GUC
  theo từng transaction. Rủi ro cao → làm cuối, có đường lùi.
- `lesson_skill_map` là bảng nghiệp vụ duy nhất **không có `workspace_id`** —
  cần xác minh nó luôn được join qua bảng đã scoped.

### Tuỳ biến — còn hẹp
- **White-label**: hiện chỉ chọn trong 10 màu + 20 emoji cứng. Chưa có logo,
  tên thương hiệu, màu tự do có kiểm contrast.
- **Enum cứng còn lại**: `evidence_kind` (4), `export_format` (3),
  `daily_task_kind` (5) — nới theo đúng cách đã làm với `exercise_kind`.

### Hardening
- **Tắt `DEV_AUTH_BYPASS` ở bản production.** Hiện bypass là server-side và
  **vô điều kiện** (không đọc cookie), nên mọi khách vào đều là `super_admin`.
  An toàn vì `getDevBypassUser()` trả null khi `NODE_ENV=production`, nhưng cần
  kiểm chứng bằng phép thử thật, không chỉ đọc code.
- Strip HTML comment khi build · obfuscate email trong HTML.

### Phải hỏi trước, không tự quyết
- **Kích hoạt tầng tổ chức** (`organizations` + `org_members` +
  `workspaces.org_id` có schema nhưng **0 dòng code dùng**). Bật nó là bán được
  cho doanh nghiệp — nhưng `PRODUCT_MINDSET.md` viết rõ "không phải LMS doanh
  nghiệp", nên đây là **đổi hướng sản phẩm**.
- **Push lên GitHub** — hành động ra ngoài máy.

---

## Cách tự kiểm lại

```bash
cd application
docker start competency-postgres          # container hay tắt; tắt là mọi route treo 13-15s
pnpm typecheck && pnpm lint && pnpm test && pnpm guard
npx tsx drizzle/scripts/verify-rbac-tiers.ts     # 11/11, exit 1 nếu sai

# đo hiệu năng — PHẢI trên bản build, next dev cho số vô nghĩa
NEXT_DIST_DIR=.next-prod pnpm build
NEXT_DIST_DIR=.next-prod PORT=3210 pnpm start
```

Đếm query: log Postgres extended protocol ra **3 dòng** mỗi query
(`parse`/`bind`/`execute`) — chỉ đếm `execute`, và có **hai** dấu cách trước nó:
`grep -cE 'ms +execute'`. Bật log bằng `ALTER SYSTEM SET
log_min_duration_statement=0;` chạy **riêng một lệnh** (`psql -c "a; b"` gộp
thành transaction, mà `ALTER SYSTEM` không chạy trong transaction).

---

## Đợt 7 — vá theo kết quả rà 7/7 luồng (2026-08-20/21)

Đã vá 12 mục (toàn bộ P1 + P2 trong PLAN Đợt 7): fork copy resources · nút
move node · nút Verify + 30 XP · crown màu theo nguồn · cert A4 landscape ·
heart refill thật (atomic) · badge streak 3/100 · node type reading/video/tool ·
resource kind tool/lab (migration 0011) · tên thật từ Supabase Auth ở
roster/cert (user-display.ts, cache 5') · invite bằng email HOẶC UUID.

Chất lượng: typecheck · lint · **269/269 test** (21 file, +17 test mới) ·
4 guard sạch — tất cả trên Node 20. Build prod mới đã deploy lên 3210.

Ranh giới còn lại (P3 trong PLAN): invite-token cho người chưa có tài khoản ·
% hoàn thành + tiến độ demo trên share · discover filter/sort · đặt tên khi
fork · Last Active/At Risk · QR + /cert/<id> · export theo member · analytics
creator · share full tree.

## Đợt 7 phần 2 — P3 (2026-08-21)

Vá tiếp 5 mục: share có % hoàn thành + tiến độ creator (A4/A6) · discover
sort/filter + mô tả + số fork thật từ activity_log (E1.1/E1.2) · fork đặt được
tên (E2.3) · roster cột Hoạt động + cờ At Risk ≥7 ngày (D3.3/D3.4) · chứng chỉ
có bảng certificates + route public /cert/<code> + QR trên sheet (G8/G10/G12).

Chất lượng: typecheck · lint · **284/284 test** (24 file) · 4 guard sạch (44
bảng scoped). Build prod mới đang chạy 3210 (tunnel cùng URL).

Còn lại trong P3: invite-token cho người chưa có tài khoản · export theo
member + drill-down (D3.6/D3.7/D4.x) · analytics creator (C5) · custom badge
CRUD (F16) · share full tree (A3) · hearts decay/skip/replay (F8/F9/F11 — cân
nhắc lại game design trước khi làm).
