# FLOW C — Creator (rà lại 2026-08-21, mốc `a08fe2c` + working tree)

Bước: 16 ĐỦ · 3 THIẾU · 0 ĐỨT · 5 SAI  (24 mục — spec 23 bước được tách nhỏ để mỗi mục có 1 bằng chứng)

## Hạ tầng đã chạy để lấy bằng chứng

- `psql` container `competency-postgres` / db `competency` (port 5434) — enum, CHECK, cột, `audit_log`.
- **prod build** `http://localhost:3210` (`next start`, `NEXT_DIST_DIR=.next-prod`, BUILD_ID mtime `2026-08-21 10:00:55` > mtime mọi file share/) — dùng cho mọi test **ẩn danh** (NODE_ENV=production ⇒ dev-bypass tắt cứng, `src/lib/auth/dev-bypass.ts:23,43`).
- **dev** `http://localhost:3100` + cookie `dev_bypass_user=<uuid>` — dùng cho test theo vai (owner/editor/learner/viewer).
- ⚠️ dev server `:3000` đang HỎNG (stale `.next`: `Cannot find module './vendor-chunks/@tanstack+query-core@5.100.9.js'` → 500/404 cả trên workspace public). Không dùng cổng 3000 để kết luận gì.
- `npx vitest run tests/unit/{analytics-metrics,node-meta,guard-no-hardcode}.test.ts` → **3 files / 35 tests passed**.

---

## C1 — Tạo workspace

**C1.1 Entry "+ Tạo lộ trình mới" + nhập Tên | ĐỦ**
`src/components/layout/app-sidebar.tsx:276` (`/onboarding?force=1`) → `src/app/(app)/onboarding/page.tsx:150-208` (StepTwo, input `name`, maxLength 80) → `src/actions/workspaces.ts:397-424`.
Chạy: `curl -b dev_bypass_user=77b0… :3100/w/devops-test` → 200; chuỗi `/onboarding?force=1` có trong DOM sidebar.
(Đường vào này CHỈ có trên desktop — xem UI/UX #1.)

**C1.2 Slug auto-gen từ tên, **có thể sửa** | SAI**
`src/app/(app)/w/[slug]/settings/page.tsx:117` — “Rename the workspace. The slug is fixed for MVP.”; `src/components/admin/rename-workspace-form.tsx:32` chỉ gửi `name`; `src/actions/workspace-admin.ts:38` `set({ name })` — **không đụng slug**. Lúc tạo, slug bị suy ra từ tên (`src/actions/workspaces.ts:415` `reserveWorkspaceSlug(rawName…)`), creator không nhập được.
Chạy: `psql \d workspaces` → cột `slug text NOT NULL`, unique `workspaces_slug_uq`; không có UI/action nào set slug sau khi tạo (grep toàn `src/actions`).
Vá: thêm field `slug` (zod `/^[a-z0-9-]{3,40}$/`) vào `renameWorkspace` + form settings; đổi slug ⇒ `reserveWorkspaceSlug(newSlug, { excludeWorkspaceId })` và `writeAudit action:'workspace.slug_update'`. Cân nhắc giữ bảng redirect slug cũ → mới vì `/share/<slug>` đã phát ra ngoài.

**C1.3 Trường Mô tả 1-2 câu | THIẾU**
`psql \d workspaces` → 10 cột: `id, owner_user_id, org_id, slug, name, icon, color, framework_template_id, visibility, created_at` — **không có `description`**. `src/lib/db/schema.ts:80-96` khớp. Onboarding StepTwo chỉ có 1 input (`name`).
Hệ quả đã đo: `src/app/share/[slug]/page.tsx:76` phải chữa cháy bằng cách mượn `description` của root node và **chỉ khi cây có đúng 1 root** (`rootRow.length === 1`), nếu không thì OG description rơi về chuỗi generic.
Vá: migration `ALTER TABLE workspaces ADD COLUMN description text` + cột trong `schema.ts` + textarea (max 280) ở onboarding StepTwo và settings General; `writeAudit` gộp vào `workspace.rename` hoặc tách `workspace.describe`.

**C1.4 Create → về /w/[slug] (empty state) | ĐỦ**
`src/actions/workspaces.ts:433-470` (blank) và `:365-388` (fork) redirect sang `/onboarding?step=2`, StepThree kết thúc bằng CTA `href={/w/${resolvedSlug}}` (`src/app/(app)/onboarding/page.tsx:294-297`, `+ NextStepLink :274/:280/:286`). Sai lệch so với spec chỉ là đi qua wizard 3 bước thay vì redirect thẳng — vẫn đáp đúng `/w/<slug>`.

---

## C2 — Xây cây node

**C2.1 Empty state → "Tạo node đầu tiên" → /w/[slug]/new | ĐỦ (code), chưa chạy được**
`src/app/(app)/w/[slug]/page.tsx:199-212` — `rootNodes.length === 0` → `EmptyState` + `<Link href={/w/${ws.slug}/new}>`.
Chưa chạy được vì **không workspace nào trong DB có 0 node**: `psql` đếm `devops-test=166, sample-public-roadmap=2, sample-public-roadmap-2=2, sample-public-roadmap-0000-7n1w=2`.

**C2.2 Type: đủ 11 loại spec (course|phase|week|lesson|lab|project|milestone|exam|reading|video|tool) | ĐỦ — ĐÃ VÁ**
`src/lib/tree/node-meta.ts:14-33` có đủ 11 + 6 loại mở rộng (stage/session/module/theory/task/capstone/custom).
Chạy: `curl -b dev_bypass_user=77b0… :3100/w/devops-test/new` → HTML chứa `Khoá học`, `Đọc tài liệu`, `Video`, `Công cụ` (mỗi cái 1 lần trong `<select>`). `tests/unit/node-meta.test.ts` 3/3 pass.

**C2.3 Title + Description + Body Markdown ở form root | ĐỦ**
`src/app/(app)/w/[slug]/new/page.tsx:92-127`; server `src/actions/tree-nodes.ts:131-139` (zod title 1-200, description ≤2000, bodyMd ≤50000).

**C2.4 Est. minutes ở form tạo root | THIẾU**
`src/app/(app)/w/[slug]/new/page.tsx:74-127` — form chỉ có type/title/description/bodyMd; `createTreeNode` **đã** nhận `estMinutes` (`src/actions/tree-nodes.ts:138`) nhưng trang không gửi (`:37-44`).
Chạy: HTML của `/w/devops-test/new` **không** chứa chuỗi `Thời lượng` (grep 0 hit), trong khi dialog thêm-con thì có.
Vá: copy nguyên block `Thời lượng (phút)` từ `src/components/learn/node-toolbar.tsx:468-480` vào `new/page.tsx` sau ô Body, và truyền `estMinutes: estMinutes === '' ? undefined : Number(estMinutes)` ở `:37`.

**C2.5 Submit → redirect /w/[slug], thấy root vừa tạo | ĐỦ**
`src/app/(app)/w/[slug]/new/page.tsx:45-47` (`router.push` + `router.refresh`); `src/actions/tree-nodes.ts:141-254` insert + `activityLog` + `writeAudit` + `revalidatePath`.
Chạy: `psql` → `audit_log` có `tree_node.create` ×2, `tree_node.delete` ×3, `tree_node.update` ×1.

**C2.6 "Thêm bước con" (parentId = node), lặp nhiều cấp | ĐỦ**
`src/components/learn/node-toolbar.tsx:234-236` (nút "Thêm con") → `:376-486` `AddChildDialog` (type/title/description/bodyMd/estMinutes) → `createTreeNode({ parentId })`. Không giới hạn độ sâu.

---

## C3 — Thêm nội dung vào node

**C3.1 Edit Body Markdown | SAI (không XOÁ được nội dung)**
`src/components/learn/node-toolbar.tsx:535-537` gửi `description: description.trim() || undefined`, `bodyMd: bodyMd.trim() || undefined`, `estMinutes: '' ? undefined`. Server `src/actions/tree-nodes.ts:292-294` chỉ patch khi `!== undefined`. ⇒ creator xoá trắng ô Body/Mô tả rồi Lưu thì **giá trị cũ ở lại DB**, UI vẫn hiện nội dung cũ sau `router.refresh()`. Không có cách nào bỏ `est_minutes` về null.
Bằng chứng: đọc code (đường đi `''.trim() → '' → falsy → undefined → không vào patch`); **chưa chạy được end-to-end** vì server action cần `next/headers`, không gọi được ngoài Next.
Vá: đổi 3 dòng `:535-537` (và `:420-422` cho AddChild) thành gửi thẳng `description`, `bodyMd`, `estMinutes === '' ? null : Number(...)`; nới zod ở `tree-nodes.ts:262-266` thành `.nullable().optional()` và cho phép chuỗi rỗng.

**C3.2 Resource type video/doc/tool/lab/link | ĐỦ — ĐÃ VÁ**
`src/lib/db/schema-resources.ts:24` `RESOURCE_KINDS = ['link','video','doc','book','tool','lab']`; zod `src/actions/node-resources.ts:99`; UI `src/components/learn/resource-add-dialog.tsx:29-38`.
Chạy: `psql pg_constraint` trên `node_resources` → `node_resources_kind_check CHECK (kind = ANY (ARRAY['link','video','doc','book','tool','lab']))`.

**C3.3 Resource URL + Title | ĐỦ**
`src/components/learn/resource-add-dialog.tsx:126-144` (Tiêu đề *, URL *). Spec cho phép “tự fetch **hoặc** tự điền” — nhánh tự điền có. Auto-fetch title từ URL: không tồn tại (grep `fetch(` trong dialog + action = 0 hit) — chấp nhận được theo spec.

**C3.4 Est. minutes trên node | ĐỦ**
`src/components/learn/node-toolbar.tsx:468-480` (thêm con) và `:580-590` (sửa). Giới hạn 0-10000 khớp zod `tree-nodes.ts:265`. (Khiếm khuyết “không xoá về null” đã tính ở C3.1.)

---

## C4 — Publish và share

**C4.1 Settings 3 lựa chọn visibility (private / public read-only / private-member-only) | SAI**
`src/lib/db/schema.ts:28` `pgEnum('workspace_visibility', ['private','public-readonly'])`; UI 2 nút `src/components/admin/visibility-toggle.tsx:46-71`; action zod 2 giá trị `src/actions/workspace-admin.ts:57-60`; page ép 2 nhánh `src/app/(app)/w/[slug]/settings/page.tsx:75`.
Chạy: `psql` `SELECT enumlabel FROM pg_enum … 'workspace_visibility'` → **2 rows: `private`, `public-readonly`**.
Vá: migration `ALTER TYPE workspace_visibility ADD VALUE 'members-only'` (hoặc đổi cột sang `text` theo đúng lối `0013_widen_rigid_enums.sql` đang làm với 3 enum khác) + option thứ 3 trong `visibility-toggle.tsx` + nhánh `members-only` trong gate của `src/app/share/[slug]/page.tsx:138-141` (đúng ra: `private` = chỉ owner; `members-only` = owner + `workspace_members`; hiện `isViewerAllowed` đã gộp cả hai làm một, `:105-119`).

**C4.2 Save → workspace public ngay lập tức | ĐỦ**
`src/actions/workspace-admin.ts:62-88` — `resolveOwnerWorkspace` → update → `writeAudit('workspace.visibility_update')` → `revalidatePath`. `/share/[slug]` đọc `visibility` trực tiếp mỗi request và là route dynamic (gọi `getCurrentUser()` ⇒ cookies).
Chạy (gián tiếp, KHÔNG toggle vì DB đang có agent khác dùng): cùng lúc, `psql` cho `devops-test = public-readonly` / `sample-public-roadmap-0000-7n1w = private`, và prod-3210 ẩn danh trả `200` vs `404` tương ứng ⇒ giá trị cột chính là thứ chặn. `audit_log` có 1 row `workspace.visibility_update`.

**C4.3 /share/[slug] live, không cần login + copy link | ĐỦ**
Chạy: `curl :3210/share/devops-test` (ẩn danh, NODE_ENV=production) → **200**. Nút copy: `src/components/learn/share-link-button.tsx` render trên `src/app/share/[slug]/page.tsx`.

**C4.4 Nút "Fork lộ trình này" | ĐỦ**
`src/components/share/fork-button.tsx:35-60`; action `src/actions/workspaces.ts:485-620` (chặn `visibility !== 'public-readonly'`, `writeAudit('workspace.fork')`).
Chạy: HTML `:3210/share/devops-test` chứa chuỗi `Fork` 8 lần; `audit_log` có `workspace.fork` ×2.

**C4.5 Workspace private KHÔNG lộ qua /share | SAI — P0, vá cũ MỚI CHỈ ĐƯỢC NỬA**
Trang gốc đã vá (`src/app/share/[slug]/page.tsx:57-59` metadata, `:105-119` `isViewerAllowed`, `:135-141` gate) — chạy: `:3210/share/sample-public-roadmap-0000-7n1w` → **404**. ✅
Nhưng **2 đường vòng còn hở**:
1. `src/app/share/[slug]/n/[nodeSlug]/page.tsx:98-109` — chỉ `if (!ws) notFound()` rồi `getNodeBySlug(...)`, **không hề đọc `ws.visibility`**, không gọi `getCurrentUser`.
   Chạy (ẩn danh, prod): `curl :3210/share/sample-public-roadmap-0000-7n1w/n/phase-1-start` → **HTTP 200, 37 498 bytes**, `<title>Phase 1: Start · Sample Public Roadmap (Fork) · Roadmap</title>`, thân trang chứa `Phase 1: Start`. `…/n/sample-course` cũng **200**. Ai đoán/brute-force được node slug là đọc trọn nội dung workspace private.
2. `src/app/api/og/route.tsx:41-52` — nhận `?slug=` rồi query `workspaces` **không kiểm `visibility`**.
   Chạy: `curl :3210/api/og?slug=sample-public-roadmap-0000-7n1w` → **HTTP 200, image/png, 100 136 bytes** (ảnh in tên workspace + đường dẫn).
Git chứng minh vá sót: `src/app/share/[slug]/page.tsx` sửa lần cuối `2026-08-21 09:36`, còn `…/n/[nodeSlug]/page.tsx` đứng yên từ commit `aa1eeac` (`2026-08-20 10:50`) — commit `d2af20a` “vá share lộ private” không đụng tới nó.
Vá: tách gate thành `src/lib/share/guard.ts` (`assertShareable(slug) → { ws }`, gộp `visibility !== 'public-readonly'` + `isViewerAllowed`) rồi gọi ở **cả 3** chỗ: `share/[slug]/page.tsx`, `share/[slug]/n/[nodeSlug]/page.tsx` (cả `generateMetadata` lẫn page), `api/og/route.tsx`. Kèm 1 test e2e ẩn danh assert 404 cho cả 3.

---

## C5 — Theo dõi analytics

Spec ghi đường dẫn `/w/[slug]/audit`; hiện thực nằm ở `/w/[slug]/analytics` (mới, commit `783caaa`) + `/w/[slug]/roster`, còn `/audit` giữ đúng vai audit-log. Chấp nhận, chỉ lệch path.

**C5.1 Ai đang học roadmap này (members) | ĐỦ — ĐÃ VÁ**
`src/app/(app)/w/[slug]/analytics/page.tsx:115-144` + `src/lib/analytics/queries.ts:56-105`; danh sách người ở `/roster`.
Chạy: `curl -b dev_bypass_user=77b0… :3100/w/devops-test/analytics` → render **“5 Learners · 17% Hoàn thành TB · 1 Active 7 ngày · 0 Node stuck”**. RBAC: `admin-nav.ts:15` analytics = EDITOR; learner (level 20) bị đá về dashboard (HTML trả về là trang “Cây học tập”, không có section analytics nào).

**C5.2 Từng thành viên: % completion + last active | ĐỦ — ĐÃ VÁ**
`src/app/(app)/w/[slug]/roster/page.tsx:238-296` (max của `streaks.last_active_date` và `activity_log`), cờ At Risk `:292-297`.
Chạy: HTML `/w/devops-test/roster` chứa `Hoạt động` ×3 và `completion` ×3.

**C5.3 Node nào nhiều người stuck (drop-off) | ĐỦ — ĐÃ VÁ**
`src/app/(app)/w/[slug]/analytics/page.tsx:146-218` + `src/lib/analytics/queries.ts:140-190` (`filter (where …)` SQL, cutoff 7 ngày) + `src/lib/analytics/metrics.ts:43` `STUCK_AFTER_DAYS`.
Chạy: trang render nhánh empty **“Không ai bị kẹt”** với `0 Node stuck` — tức query đã chạy trên progress thật (`hasAnyLearning === true`, `stuckByNode.size > 0`) nhưng DB hiện không có ai kẹt ≥7 ngày. **Bảng có dữ liệu thì chưa được chạy thử** — cần seed 1 progress cũ để nghiệm thu.
Nợ nhỏ: hằng số 7 bị chép 4 nơi — `metrics.ts:43`, `queries.ts:58`, `queries.ts:157`, và text cứng `analytics/page.tsx:151` + `formatIdleDays(7)` `:296`. Đổi ngưỡng là lệch chữ/số.

**C5.4 Skills distribution team | SAI (bỏ sót `level_source = 'both'`)**
`src/lib/analytics/queries.ts:218-220` chỉ đếm `'self_claimed' | 'learned' | 'verified'`. Nhưng enum có **4** giá trị.
Chạy: `psql` → `SELECT enumlabel … 'level_source'` = `self_claimed, learned, both, verified`; `SELECT level_source, count(*) FROM user_skill_progress GROUP BY 1` → **`both | 1`** (đúng 1 row duy nhất trong bảng, và nó là `both`).
Kết quả trên UI (đã chạy): hàng `IAM Deep (trust, conditions, boundaries)` hiện **`Learners 1`** nhưng phân bố **`0 / 0 / 0`** và 3 đoạn stacked-bar đều rộng 0 ⇒ creator nhìn thấy “có 1 người nhưng không ai ở mức nào”. Cũng vì thế `orderBy count(verified) desc` (`queries.ts:236`) sắp xếp sai khi mọi skill đều `both`.
Vá: thêm `both: count(*) filter (where level_source = 'both')` vào select + `SkillDistributionRow`, render đoạn thứ 4 (theo memory hệ màu: `both` đi cùng `learned` — xanh primary), và đổi `total` ở `analytics/page.tsx:250` thành `selfClaimed + learned + both + verified`. Hoặc rẻ hơn: gộp `both` vào `learned` ngay trong filter — nhưng phải sửa cả 2 nơi cùng lúc để bar và số khớp.
Phụ: `analytics/page.tsx:279` in `avgLevelValue.toFixed(1)` = **`33.0`** — đó là `competency_levels.numeric_value` thô (`psql`: XS=0, S=33, M=66, L=100). Creator không có ngữ cảnh thang. Nên map ngược về nhãn gần nhất (`S · Junior · Working`) hoặc thêm hậu tố `/100`.

**C5.5 Action từ insight (3 loại spec) | THIẾU (1/3)**
- “Node X drop-off → cải thiện nội dung”: **có** — link `Xem node` `src/app/(app)/w/[slug]/analytics/page.tsx:199-206`.
- “Skill Y 70% self_claimed, 0% verified → thêm bài kiểm tra”: bảng có hiển thị nhưng **không có nút hành động** nào (không link tới `/grading`, `/skills`, hay tạo exam).
- “Member Z không active 7 ngày → gửi reminder”: **không tồn tại**. Trang tự thừa nhận ở `:294-297` (“Gửi reminder/nhắc nhở chưa thuộc phạm vi của trang này”). Chạy: grep `reminder|nhắc nhở` toàn `src/actions|src/lib|src/components|src/app` → 2 hit, đều **không** phải action (1 ở grader text, 1 là chính câu thú nhận trên).
Vá: (a) cột hành động cho bảng skill → link `/w/<slug>/grading/types?skill=<id>`; (b) dùng `notifications` (đã có `src/actions/notifications.ts`) làm action `sendNudge(workspaceId, userId)` gọi từ cột At Risk của `/roster`, ghi `writeAudit('member.nudge')`.

---

## UI/UX & FE — màn creator

1. **`src/components/layout/app-sidebar.tsx:87` + `:304-322` | Toàn bộ mặt creator/admin CHẾT trên mobile** — sidebar `hidden md:flex`, `BottomTabBar` chỉ có 4 tab `Cây / Hôm nay / Kỹ năng / Profile`; `src/components/layout/topbar.tsx` chỉ có đúng 1 link (`/daily`, `:69`). ⇒ dưới 768px **không có đường nào** tới `/settings` (C4), `/analytics` (C5), `/roster`, `/members`, `/audit`, `/import`, và cả nút “Tạo workspace mới” (`:276`, nằm trong switcher của sidebar → C1 cũng chết). | Vá: thêm tab thứ 5 “Thêm” mở Sheet (Radix) chứa nguyên `adminItems` đã lọc RBAC, hoặc nút hamburger trong Topbar hiển thị `md:hidden`.
2. **`src/app/(app)/w/[slug]/page.tsx:206` | `/w/[slug]/new` là đường cụt một chiều** — grep toàn `src/app` + `src/components`: route này được link từ **đúng 1 chỗ**, là empty state. Cây đã có ≥1 root thì không còn UI nào tạo root thứ hai. | Vá: thêm nút “+ Thêm nhánh gốc” cạnh `RoadmapHero` (`:216`) khi `rbacLevel >= EDITOR`.
3. **`src/app/(app)/w/[slug]/analytics/page.tsx` (không có `loading.tsx`) | Không có skeleton** — trang chạy 4 aggregate song song (`:67-72`) rồi mới trả HTML. Cùng cảnh: `settings/`, `roster/`, `members/`, `audit/`, `import/`, `badges/` — cả `(app)/w/[slug]` chỉ có `loading.tsx` ở `/`, `/daily`, `/n/[nodeSlug]`, `/skills`. | Vá: thêm `loading.tsx` dùng lại skeleton của `src/app/(app)/w/[slug]/loading.tsx`.
4. **`src/app/(app)/w/[slug]/new/page.tsx:76,93,106,117` · `src/components/learn/node-toolbar.tsx:445,457,461,465,469,557,569,573,577,581` · `src/components/learn/resource-add-dialog.tsx:108,126,136,146` | a11y: 17 `<label>` không `htmlFor`, control không `id`** — screen reader đọc input trống, click nhãn không focus. `<select>` loại node cũng không có `aria-label`. | Vá: `id` + `htmlFor` từng cặp (hoặc bọc input trong label).
5. **`src/app/(app)/w/[slug]/new/page.tsx:49` · `node-toolbar.tsx:429,545` | Lỗi validate hiện ra dạng thô** — `toast.error('Lỗi tạo node', { description: String(e) })`; input Title **không** có `maxLength` trong khi zod chặn 200 (`tree-nodes.ts:135`) ⇒ dán tiêu đề dài sẽ ra toast in nguyên mảng JSON issue của Zod. Không có thông báo lỗi cạnh field, chỉ disable nút. | Vá: `maxLength={200}` / `{2000}` khớp zod, thêm bộ đếm ký tự, và map `ZodError` → câu tiếng Việt trước khi toast.
6. **`src/app/(app)/w/[slug]/settings/page.tsx:117,197,198,208,209` + `src/components/admin/visibility-toggle.tsx:57,70,74-77` + `src/components/admin/rename-workspace-form.tsx:33,44,49` | Màn Settings (nơi publish — trái tim C4) **toàn tiếng Anh** trong một app tiếng Việt**: “Rename the workspace. The slug is fixed for MVP.”, “Visibility / Choose who can read this workspace.”, “Only members can access…”, “Workspace name / Save / Saved.”. | Vá: Việt hoá; câu “fixed for MVP” là ghi chú nội bộ, không nên để người dùng đọc.
7. **`src/app/(app)/onboarding/page.tsx:73,77,104,107,124,130,139` | Bước 1 wizard tiếng Anh, bước 2-3 tiếng Việt** — tệ nhất là thẻ blank: tiêu đề “Tạo cây trống” (VN) + mô tả “Build your own competency tree from scratch” (EN) + nút “Start blank” (EN) trong **cùng một card**. Dòng `:139` còn hướng dẫn `pnpm db:seed` cho người dùng cuối. | Vá: Việt hoá toàn bước 1; thay câu seed bằng CTA “Bắt đầu với cây trống”.
8. **`src/app/(app)/w/[slug]/page.tsx:203` | Empty state của creator lộ ngôn ngữ dev** — “…Tạo cây mới hoặc **chạy seed CLI** để import dữ liệu.” Người tạo lộ trình không có CLI. | Vá: đổi thành link tới `/w/<slug>/import`.
9. **`src/components/learn/resources-section.tsx:98` | Text đã lỗi thời sau khi vá C3.2** — “hãy đóng góp link / video / **sách**” chỉ kể 3/6 kind, bỏ `doc`, `tool`, `lab` vừa thêm. | Vá: “link / video / tài liệu / sách / công cụ / lab”.
10. **`src/components/learn/node-toolbar.tsx:451,563` vs `src/app/(app)/w/[slug]/new/page.tsx:86` | Không nhất quán picker loại node** — trang `/new` render `{o.emoji} {o.label}`, còn 2 dialog trong toolbar chỉ render `{o.label}`. Cùng một danh sách, 2 diện mạo. | Vá: dùng chung một `<NodeTypeSelect>`.
11. **`src/components/layout/app-sidebar.tsx:319` | Bug định vị trên tab bar mobile** — `<Sparkles className="… absolute top-1" />` nhưng `<Link>` cha không `relative`; ancestor định vị gần nhất là `<nav className="md:hidden fixed …">` (`:304`) ⇒ chấm sparkle luôn nằm góc trái thanh nav, không bám tab đang active. | Vá: thêm `relative` cho `<Link>`.
12. **`src/components/admin/import-wizard.tsx:73` + `:57-62` | Nút Import bị khoá im lặng** — `disabled={pending || md.trim().length < 50}` không kèm lời giải thích; phần mô tả lại trỏ tên file nội bộ (“giống các file 02_PHASE…05_PHASE”). Không có preview/undo: dán sai là node đẻ thẳng vào cây. | Vá: hiện “cần ít nhất 50 ký tự (hiện N)”, thêm bước preview số phase/tuần trước khi ghi, bỏ tên file nội bộ.
13. **`src/components/admin/visibility-toggle.tsx:27-41` | Chuyển sang Public không có xác nhận** — 1 click là cả cây học tập ra Internet, không dialog, không undo, không hiện link `/share/<slug>` ngay sau đó. Lỗi trả về in mã thô (`:38` `'UPDATE_FAILED'`). | Vá: `AlertDialog` xác nhận + hiện link share kèm nút copy sau khi bật.
14. **`src/app/(app)/w/[slug]/page.tsx` (qua `resolveWorkspace`) | Vai `viewer` (level 10) gặp 500 thay vì trang từ chối** — chạy: `curl -b dev_bypass_user=000000aa-…-0010 :3100/w/devops-test` → **500**, body chứa `NEXT_REDIRECT` rồi `WORKSPACE_NOT_FOUND_OR_FORBIDDEN`; `/w/devops-test/roster` cũng 500; `/analytics` 500 (redirect về dashboard rồi dashboard tự ném). Người được creator mời ở vai viewer sẽ đâm vào màn lỗi. (Nặng hơn ở Flow D, nhưng chặn luôn đường creator mời người xem.) | Vá: `src/app/(app)/w/[slug]/error.tsx` bắt riêng `WORKSPACE_NOT_FOUND_OR_FORBIDDEN` → màn “Bạn chưa có quyền vào workspace này” + link về `/`.
15. **`src/app/(app)/w/[slug]/analytics/page.tsx:279` | “Level TB 33.0”** — đã chạy và thấy đúng chuỗi này; là `numeric_value` thô, người đọc không biết thang. | Vá: hiện nhãn bậc + `/100`.

## Kiến trúc (ngoài checklist bước, nhưng thuộc luồng C)

- **`src/actions/tree-nodes.ts:394-448` `moveTreeNode` không `writeAudit`** — chỉ `activityLog` + `revalidatePath`. Đổi thứ tự/cha của node là mutation cấu trúc. Chạy: `psql SELECT action, count(*) FROM audit_log GROUP BY 1` → 19 loại action, **không có `tree_node.move`**. | Vá: thêm `writeAudit('tree_node.move', before:{parentId,orderIndex}, after:{…})`.
- **`src/actions/workspaces.ts:397-424` `renameOnboardingWorkspace` không `writeAudit`** — đổi cả `name` **và `slug`** (tức URL công khai) mà không để lại dấu vết, trong khi `renameWorkspace` (`workspace-admin.ts:40`) thì có.
- **8 page tự query `workspaces` + `requireMinLevel` thay vì `resolveWorkspace`** — `analytics/`, `audit/`, `badges/`, `certificate/[memberId]/`, `import/`, `members/`, `roster/`, `settings/` (mỗi file lặp lại đúng khối `db.select → if (!ws) redirect('/') → try requireMinLevel catch RBACError redirect`). Chỉ 3 page dùng `resolveWorkspace` (`grading/`, `grading/types/`, `n/[nodeSlug]/practice/`). Luật dự án nói “mọi truy cập workspace qua `src/lib/rbac/resolve.ts`”. | Vá: thêm `resolveWorkspacePage(slug, level)` trả `{ ws }` và redirect sẵn, rồi thay 8 chỗ.

---

ĐÃ VÁ TỪ BẢN RÀ CŨ (2026-08-20):
- **C2.2 loại node** SAI → **ĐỦ**: `reading/video/tool` đã có trong `node-meta.ts:22-24`, chạy thật thấy trong `<select>` của `/w/devops-test/new`.
- **C3.2 resource kind** SAI → **ĐỦ**: `tool`/`lab` vào cả zod, UI và CHECK constraint (`node_resources_kind_check` đã đọc từ `pg_constraint`).
- **C4.2 share lộ private** SAI → **ĐỦ ở trang gốc** (`/share/<private>` = 404 ẩn danh trên prod). ⚠️ nhưng vá sót 2 route → xem C4.5, vẫn P0.
- **C5.1 analytics** SAI → **ĐỦ**: trang `/w/[slug]/analytics` mới, EDITOR-gated, chạy ra số thật.
- **C5.2 stuck/drop-off** THIẾU → **ĐỦ** (logic + UI có; nhánh có-dữ-liệu chưa nghiệm thu vì DB chưa ai kẹt).
- **C5.3 skills distribution** THIẾU → **có trang nhưng SAI** (bỏ sót `both`, xem C5.4).
- Không đổi so với bản cũ: C1 (slug + mô tả), C2.4 (est ở form root), C4.1 (3 visibility), C5.5 (action từ insight).

CÒN LẠI (nặng → nhẹ):
1. **P0 — C4.5**: `/share/[slug]/n/[nodeSlug]` và `/api/og` vẫn phát nội dung workspace private cho khách ẩn danh (đã đo 200 + 37 498 bytes + ảnh PNG 100 136 bytes trên prod build). Gom gate vào 1 helper, gọi ở 3 nơi, thêm test e2e ẩn danh.
2. **P1 — C5.4**: analytics bỏ sót `level_source='both'` ⇒ phân bố hiện `0/0/0` khi có 1 learner; sort theo `verified` cũng sai. Sửa `queries.ts:218-220` + total ở `page.tsx:250`.
3. **P1 — C3.1**: không xoá được Body / Mô tả / Est. minutes của node (client gửi `undefined`). Sửa `node-toolbar.tsx:420-422,535-537` + nới zod `tree-nodes.ts:262-266`.
4. **P1 — UI #1**: mọi màn creator (settings/analytics/roster/import + nút tạo workspace) không truy cập được dưới 768px.
5. **P2 — C4.1**: thiếu lựa chọn visibility thứ 3 (`members-only`); enum DB mới có 2 nhãn.
6. **P2 — C1.2/C1.3**: slug không sửa được sau khi tạo; workspace không có cột `description` (kéo theo OG description phải chữa cháy bằng root node).
7. **P2 — C2.4**: form tạo root thiếu Est. minutes (server đã sẵn sàng nhận).
8. **P2 — C5.5**: thiếu 2/3 action từ insight (nudge member, thêm bài kiểm tra cho skill yếu).
9. **P3 — kiến trúc**: `moveTreeNode` + `renameOnboardingWorkspace` không ghi `audit_log`; 8 page lặp guard thay vì `resolveWorkspace`; hằng số 7-ngày chép 4 nơi.
10. **P3 — UI #2,4,5,6,7,8,9,10,11,12,13,15**: đường cụt `/new`, a11y label, validate thô, tiếng Anh lẫn tiếng Việt ở Settings + onboarding bước 1, text lỗi thời, sparkle lệch, import không preview, publish không xác nhận, “Level TB 33.0”.
11. **Chưa kiểm chứng được**: empty state C2.1 (không workspace nào 0 node), bảng stuck có dữ liệu C5.3 (không ai kẹt ≥7 ngày), thao tác toggle visibility C4.2 (không mutate DB vì có agent khác đang chạy), và end-to-end C3.1 (server action cần `next/headers`).
