# FLOW E — Fork & cộng đồng (rà lại 2026-08-21)

Mốc: `a08fe2c` + working tree (có cả code chưa commit: `share-tree.tsx`, `full-tree.ts`, `badges/`, `invites/`).
Cách rà: đọc code + CHẠY THẬT (psql trên container `competency-postgres`, dev server `next dev -p 3111`,
gọi trực tiếp server action bằng tsx, và Playwright/Chromium bấm nút trên UI thật).
Mọi con số dưới đây đều đo được; dữ liệu test đã dọn sạch, DB trả về đúng trạng thái ban đầu
(3 workspace · 1 fork event · 0 node_resources).

Bước: 11 ĐỦ · 0 THIẾU · 0 ĐỨT · 5 SAI

---

E1.1 | SAI | `application/src/components/discover/discover-grid.tsx:73-97`, `application/src/app/discover/page.tsx:100-117` | Sort CHẠY ĐÚNG: HTML thật của /discover render 3 option `newest/popular/mostNodes` và list sắp theo createdAt desc. Nhưng filter domain RỖNG trên dữ liệu thật: `<option value="all" selected>Mọi loại</option>` là option DUY NHẤT — vì `rootMetaByWs` chỉ set khi workspace có ĐÚNG 1 root, mà cả 2 workspace public thật đều có 2 root (`select count(*) filter (where parent_id is null)` → sample-public-roadmap=2, devops-test=2) nên `rootNodeType` = null cho 100% card (kiểm bằng payload RSC: `"rootNodeType":null` cả 2). | Bỏ điều kiện "đúng 1 root" ở `discover/page.tsx:105-117`: lấy root đầu theo `orderIndex` (hoặc gom `distinct nodeType` của mọi root) làm domain. Đúng tầng hơn: thêm cột `workspaces.domain`/`tags` (schema + action + form settings) thay vì suy từ nodeType.

E1.2 | SAI | `application/src/app/discover/page.tsx:119-135,166-178`, `discover-grid.tsx:181-197` | Đo trên HTML thật: tên ✔, số node ✔ (`devops-test` = 166 mục, đúng bằng `count(*) roadmap_tree_nodes`), số fork ✔ (`forkCount:1` cho sample-public-roadmap, `0` cho devops-test — khớp `activity_log kind='workspace_forked'`). MÔ TẢ SAI: `"description":null` trên CẢ 2 card (cùng nguyên nhân multi-root như E1.1) → khối `{w.description && …}` không bao giờ render. Thêm 1 điểm lệch: đếm `count(distinct user_id)` nên 2 lượt fork của cùng 1 người vẫn hiện "1 fork" (đã thấy tận mắt: 2 row workspace_forked cùng user → card hiện 1). | Sửa cùng chỗ với E1.1; description fallback root-đầu-tiên → node depth 1. Nếu nghiệp vụ muốn "số lượt fork" thì đổi `count(distinct userId)` → `count(*)` ở `discover/page.tsx:126`; nếu muốn "số người fork" thì đổi nhãn card thành "người fork".

E1.3 | ĐỦ | `discover-grid.tsx:198-203`, `application/src/app/share/[slug]/page.tsx:125-141` | `curl /share/sample-public-roadmap` → 200; `curl /share/khong-ton-tai` → 404. Link card trỏ `/share/${w.slug}`. | —

E2.1 | ĐỦ | `share/[slug]/page.tsx:225-230,289-296`, `application/src/components/share/fork-button.tsx:36-59` | HTML thật của /share/sample-public-roadmap chứa 2 nút "Fork roadmap này" (top bar + CTA đáy). Trên workspace do chính viewer sở hữu: 0 nút fork, chỉ "Đây là roadmap của bạn" (đo bằng curl). | —

E2.2 | ĐỦ | `fork-button.tsx:43-52`, `application/src/app/(auth)/sign-in/page.tsx:24-25,38-40`, `application/src/app/auth/callback/route.ts:16,30` | Chưa đăng nhập → link `/sign-in?next=/share/<slug>`; `next` được sanitize (phải bắt đầu `/`, chặn `//`) và callback redirect đúng `origin+next`. | Chưa giữ được Ý ĐỊNH fork: đăng nhập xong quay lại /share và phải bấm lại. Nếu muốn liền mạch: `next=/share/<slug>?fork=1` + auto-mở dialog.

E2.3 | ĐỦ | `fork-button.tsx:61-116`, `application/src/actions/workspaces.ts:499-508` | Chạy thật: mở dialog trên Chromium 360px → input `newName` được autofocus, value mặc định "DevOps Mastery 2026 (Fork)", ESC đóng được. Fork với tên tuỳ ý "AUDIT E FORK TEST" → row DB `name='AUDIT E FORK TEST'`, slug tự sinh `sample-public-roadmap-2`. | Server im lặng fallback về tên auto khi input >80 ký tự/rỗng (`workspaces.ts:502-508`) thay vì báo lỗi — nên trả lỗi để UI hiện được.

E2.4a | ĐỦ | `workspaces.ts:510-575` | Fork thật `devops-test` (166 node): fork có 166 node; 485/485 thành phần trong `path_str` resolve được về id NỘI BỘ fork; 0 thành phần còn trỏ về workspace nguồn; 0 node có `parent_id` mồ côi. Thời gian 165ms. | —

E2.4b | ĐỦ (đã vá) | `workspaces.ts:577-600` | Seed 2 resource vào workspace nguồn rồi fork: fork có ĐÚNG 2 resource, `node_id` remap đúng (res của root → node root bản copy, res của phase → node phase bản copy), `added_by_user_id` reset null, `payload.resourceCount=2` trong activity_log. Trang node của fork render đúng resource đã copy. | —

E2.4c | SAI | `workspaces.ts:540-575` (chỉ copy `roadmapTreeNodes`), `application/src/lib/learn/node-lesson.ts:10-16` | Phần chữ copy đủ (đo: `body_md`, `description`, `est_minutes=42`, `meta={"lessonSlug":"x-audit"}` sang y nguyên). NHƯNG fork `devops-test` cho ra: nodes 166/166, `meta ? 'lessonSlug'` 59/59 — trong khi `lessons` 0/59, `exercises` 0/75, `badges` 0/12, `competency_levels` 0/4. `meta.lessonSlug` trở thành con trỏ chết vì lookup scope theo workspaceId. Đo trên UI: trang node NGUỒN có khối "Practice", trang node BẢN FORK cùng slug KHÔNG có. | Copy thêm `lessons` (+`lesson_skill_map`) và `exercises` theo idMap trong `forkWorkspace` (đặt ngay sau khối resources, cùng kiểu batch), hoặc tối thiểu strip `meta.lessonSlug` khi fork để không để con trỏ chết. Nhân tiện: cả hàm KHÔNG có transaction — lỗi giữa chừng để lại workspace nửa vời; nên bọc `db.transaction`.

E2.4d | ĐỦ | `workspaces.ts:602-609` | Workspace nguồn có 1 row `user_node_progress status='done'`; sau fork: `user_node_progress` của fork = 0, `hearts` 1 row (5/5), `streaks` 1 row (0/0). Fork devops-test: progress 0 dù nguồn có 140 row. | —

E3.0 | ĐỦ | `workspaces.ts:527-538`, `application/src/lib/rbac/resolve.ts:38-60` | Fork ra `visibility='private'`, `owner_user_id` = người fork. Sau khi xoá/thêm node trong fork, workspace nguồn vẫn nguyên 2 node (đo trước/sau). Mọi action đi qua `resolveWorkspace` (RBAC theo workspaceId). | —

E3.1 | SAI (P0, nặng nhất) | `application/src/lib/tree/cascade.ts:18-26` (dùng ở `application/src/actions/tree-nodes.ts:351-356`) | `subtreeCondition` lọc theo `path_str`, mà `path_str` chỉ chứa TỔ TIÊN, không chứa chính node (`tree-nodes.ts:191`) → điều kiện không bao giờ khớp chính nó. Chạy thật: xoá node lá "AUDIT B" → trước 4 node, sau 4 node (action không ném lỗi, activity_log + audit_log vẫn ghi "đã xoá"). Xoá node cha "Sample Course" → 4 node còn 2: 2 con bị xoá, CHÍNH NODE CHA VẪN CÒN. UI (`application/src/components/learn/node-toolbar.tsx:142-159`) hiện toast "Đã xoá" rồi điều hướng đi → người dùng tin là đã xoá. | Thêm chính node vào điều kiện ở `cascade.ts:19-25`: `or(eq(roadmapTreeNodes.id, nodeId), <4 mệnh đề path hiện có>)` (vẫn giữ `eq(workspaceId)`). An toàn cho `descendantIds` vì `cascade.ts:34` đã lọc `id !== nodeId`. Kèm 1 unit/integration test xoá lá + xoá cây con.

E3.2 | ĐỦ | `tree-nodes.ts:177-215`, `node-toolbar.tsx:376-491` | Gọi thật `createTreeNode` 2 lần dưới 1 root: ra `AUDIT A#orderIndex=0`, `AUDIT B#orderIndex=1`, `path_str` = id của cha, depth+1. Trang node render nút "Thêm con". | —

E3.3 | SAI (P0) | `tree-nodes.ts:432-439` | UI đã được nối (`node-toolbar.tsx:163-173,238-245` gọi `moveTreeNode`) — hết ĐỨT. Nhưng action CHẾT 100% khi thực sự phải swap: bấm "Chuyển lên" trên node `working-track-phase-1` bằng Chromium → toast đỏ `Lỗi di chuyển / column "order_index" is of type integer but expression is of type text`; `order_index` của 4 sibling vẫn 0,1,2,3. Nguyên nhân: 2 tham số trong `CASE … THEN ${b.orderIndex}` gửi không kiểu → Postgres suy ra `text` (tái lập nguyên văn lỗi bằng psql với `EXECUTE … USING`). Trường hợp biên (node đầu/cuối) thì `return` sớm ở `:426` nhưng UI vẫn toast XANH "Đã chuyển lên" — báo thành công dối. | `tree-nodes.ts:435-436`: ép kiểu `THEN ${b.orderIndex}::int` / `${a.orderIndex}::int` (hoặc `cast(… as integer)`). Cho `moveTreeNode` trả `{ moved: boolean }` và `node-toolbar.tsx:166-168` chỉ toast xanh khi `moved`, còn lại toast info "Đã ở đầu/cuối danh sách". Thêm test đảo 2 sibling.

E3.4 | ĐỦ | `application/src/actions/node-resources.ts:106-200`, `application/src/components/learn/resource-add-dialog.tsx`, `resource-remove-button.tsx` | Gọi thật `addNodeResource` trên workspace fork → ghi DB OK; `listResources` trả 2 row (1 row copy từ fork + 1 row mới, `added_by_user_id` = người thêm). Trang node render "Thêm tài liệu" + resource. | —

E3.5 | ĐỦ | `application/src/actions/workspace-admin.ts:62-90`, `application/src/components/admin/visibility-toggle.tsx:27-41` | Gọi thật `setWorkspaceVisibility(fork,'public')` → DB `visibility='public-readonly'`; `curl /discover` ngay sau đó có card "AUDIT E FORK TEST" với `forkCount:0`. Chiều ngược lại cũng đúng: fork một workspace private bị chặn `WORKSPACE_NOT_PUBLIC` (`workspaces.ts:497`). | —

---

## NGOÀI 16 BƯỚC — P0 rò rỉ dữ liệu private (cùng họ với lỗi đã vá ở trang cha)

`application/src/app/share/[slug]/n/[nodeSlug]/page.tsx:98-113` (+ `generateMetadata` :41-92) không hề đọc viewer,
không kiểm `visibility` — file này KHÔNG import `getCurrentUser`. Trang cha `share/[slug]/page.tsx:137-141` đã có guard.
Đo thật: set `sample-public-roadmap` → private, viewer không phải owner và không có row `workspace_members` nào:
`/share/sample-public-roadmap` = **404** (đúng) nhưng `/share/sample-public-roadmap/n/phase-1-start` = **200**, trả
`<title>Phase 1: Start · Sample Public Roadmap · Roadmap</title>` + toàn bộ tiêu đề/mô tả node. (Đã restore lại public.)
Vá: bê nguyên guard của trang cha (visibility + owner/member) vào cả `SharePage` node và `generateMetadata` — tốt nhất
tách `assertShareVisible(slug)` dùng chung cho 2 trang.

---

## UI/UX & FE

- `application/src/app/share/[slug]/page.tsx:218-232` | VỠ MOBILE — đo bằng Chromium 360×780: `document.scrollWidth=518` vs `innerWidth=360` (tràn ngang 158px), thủ phạm chính là `div.flex items-center gap-3` chứa chip read-only + Follow + Fork + Share, không có `flex-wrap`. Ở 768/1280 không tràn. | Thêm `flex-wrap gap-y-2` cho cả 2 div (`:210` và `:218`), hoặc gom Follow/Share vào menu "…" ở breakpoint nhỏ.
- `application/src/components/share/fork-button.tsx:69-74` | `startTransition(() => { forkWorkspace(fd); })` — không `await`, không `.catch`, không toast. Fork thất bại (ví dụ chủ vừa chuyển workspace về private, hoặc lỗi DB) → promise rejected không ai bắt, dialog đứng nguyên ở "Đang fork…", người dùng không biết chuyện gì. | `startTransition(async () => { try { await forkWorkspace(fd) } catch (e) { toast.error('Fork thất bại', …) } })` — đúng khuôn đã dùng ở `node-toolbar.tsx`.
- `application/src/app/discover/page.tsx:48` + không có `application/src/app/discover/loading.tsx` / `error.tsx` (cả `share/[slug]` cũng không) | `force-dynamic` + 4-5 query DB mỗi lần vào mà không có skeleton; lỗi DB thì rơi thẳng ra trang lỗi Next (chỉ `(app)/error.tsx` và `(app)/w/[slug]/error.tsx` tồn tại — nhánh public trắng tay). | Thêm `loading.tsx` (skeleton 6 card) + `error.tsx` (nút thử lại + link về trang chủ) cho `/discover` và `/share/[slug]`.
- `application/src/components/learn/node-toolbar.tsx:163-173` | (a) toast XANH "Đã chuyển lên" cả khi server no-op ở biên → báo thành công dối; (b) `:170` in NGUYÊN VĂN lỗi Postgres cho người dùng cuối (`column "order_index" is of type integer…`) — vừa khó hiểu vừa lộ schema. | Trả cờ `moved` từ action; map lỗi sang thông điệp tiếng Việt, chỉ log chi tiết ở server.
- `application/src/app/(app)/w/[slug]/n/[nodeSlug]/page.tsx:96-112` | `NodeToolbar` render vô điều kiện: "Thêm con / Lên / Xuống / Sửa / Xoá" hiện cho MỌI thành viên, trong khi action đòi EDITOR (`tree-nodes.ts:394-396`) và OWNER (`:328`). Trang đã tính sẵn `viewerEff` ở `:55` nhưng chỉ dùng cho `canQuickNote` ở `:56`. → viewer/learner bấm là ăn lỗi (dead-end). Lưu ý phương pháp: local đang bật dev-bypass và `application/src/lib/rbac/server.ts:62-72` cho user bypass = super_admin nên KHÔNG quan sát được 403 này trên trình duyệt; đây là kết luận đọc code, chưa kiểm chứng bằng tài khoản viewer thật. | Truyền `canEdit`/`canDelete` từ `viewerEff.level` xuống `NodeToolbar` và ẩn nút tương ứng.
- `application/src/components/discover/discover-grid.tsx:116-128` | Select "Lọc theo loại lộ trình" là control CHẾT trên dữ liệu thật (chỉ có "Mọi loại" — đã đo). Bày một dropdown không có lựa chọn nào là nhiễu. | Ẩn select khi `domains.length === 0`, và sửa nguồn domain (E1.1).
- `application/src/components/discover/discover-grid.tsx:198-203` | A11y: mọi card có cùng link text "Xem roadmap →"; người dùng screen-reader duyệt danh sách link sẽ nghe N lần giống hệt nhau. | Thêm `aria-label={`Xem roadmap ${w.name}`}`.
- `application/src/components/discover/discover-grid.tsx:178-180` | Card khoe `slug` thô trong chip `<code>` (kiểu dev) trong khi ô mô tả lại trống — thông tin ưu tiên ngược. | Bỏ chip slug (hoặc đưa xuống dòng phụ) sau khi có description thật.
- `application/src/app/(auth)/sign-in/page.tsx:74-133` | Lẫn ngôn ngữ: luồng fork toàn tiếng Việt nhưng trang đăng nhập giữa luồng là tiếng Anh ("Back", "Welcome back", "Sign in to continue your competency journey.", "Send magic link", "Continue with Google", "New here? …"). | Việt hoá toàn trang, giữ nhất quán với /discover và /share.
- `application/src/app/share/[slug]/n/[nodeSlug]/page.tsx:213-225` | Dead-end: CTA đáy đẩy khách vào `/sign-in?next=/w/<slug-CỦA-NGƯỜI-KHÁC>/n/<nodeSlug>` — đăng nhập xong họ vào thẳng workspace của creator (không phải bản của mình). Trang node share cũng KHÔNG có nút Fork nào. | Đổi `next` về `/share/<slug>` và đặt một `ForkButton` ở CTA này, để hành động tiếp theo đúng là "fork về của tôi".
- `application/src/components/layout/app-sidebar.tsx` (không có mục nào trỏ `/discover`) | /discover chỉ được link từ landing (`landing/hero.tsx:64`, `final-cta.tsx:62`, `showcase-section.tsx:28`) và `not-found.tsx:50`. Người đã đăng nhập, đang ở trong workspace, không có lối vào "Khám phá" → E1 gần như không tới được. | Thêm mục "Khám phá" vào sidebar (khu public/global, cạnh Profile/Settings).
- `application/src/app/discover/page.tsx:52-61` | Không phân trang/không LIMIT: `select` toàn bộ workspace public rồi đẩy nguyên mảng xuống client làm filter. Hiện chỉ 2-3 row nên vô hại, nhưng là bom hẹn giờ khi cộng đồng lớn. | Thêm LIMIT + phân trang (hoặc chuyển search/sort lên server) trước khi mở public thật.
- `application/src/app/(app)/w/[slug]/n/[nodeSlug]` | Đo ở 360px và 768px: khối sibling-nav (`a.surface p-4 min-h-14 …`) có mép phải vượt viewport (không làm trang scroll ngang, nên chỉ bị cắt chữ). | Cho khối này `min-w-0` + `truncate` theo cột, hoặc xếp dọc ở `<sm`.
- ĐIỂM ĐẠT (đo thật, giữ nguyên): empty state của /discover có 2 nhánh phân biệt "chưa có gì" vs "không khớp bộ lọc" (`discover-grid.tsx:143-154`); dialog fork autofocus đúng ô tên và đóng bằng ESC; lưới card không tràn ở 360px; các control đều có `aria-label`.

---

## Chất lượng bảo chứng

`application/tests/unit/` có 32 file nhưng KHÔNG file nào chạm `forkWorkspace`, `subtreeCondition`/`deleteTreeNode`,
hay `moveTreeNode` (grep 0 hit). Đó chính là lý do 2 lỗi P0 (E3.1, E3.3) sống sót qua đợt vá 7 dù gates vẫn xanh.
Đề xuất: 3 test tối thiểu — fork copy đủ node/resource + progress rỗng; xoá lá và xoá cây con; đảo chỗ 2 sibling.

---

ĐÃ VÁ TỪ BẢN RÀ CŨ (2026-08-20):
- **E2.4b SAI → ĐỦ**: `forkWorkspace` đã copy `node_resources` (đo 2/2, remap node đúng, hiện trên UI fork).
- **E2.4d / E2.4a**: giữ nguyên ĐỦ, nay có số đo thật (166 node, 485 path part remap sạch, progress 0).
- **E2.3 SAI → ĐỦ**: đã có dialog đặt tên workspace khi fork (tên tuỳ ý ghi đúng vào DB).
- **E3.3 ĐỨT → vẫn SAI**: UI đã nối `moveTreeNode` (hết dead code) nhưng action lỗi kiểu SQL nên chưa bao giờ đổi được thứ tự.
- **E1.1 / E1.2 SAI → vẫn SAI (một phần)**: sort + số fork thật đã chạy đúng; filter domain và mô tả card vẫn rỗng 100% trên dữ liệu thật vì suy từ "workspace phải có đúng 1 root".

CÒN LẠI (xếp theo mức nặng):
1. **P0 — rò rỉ private**: `/share/[slug]/n/[nodeSlug]` trả 200 + nội dung cho workspace private (trang cha đã 404). Vá guard dùng chung.
2. **P0 — E3.1 xoá node không xoá**: `subtreeCondition` không khớp chính node → xoá lá = 0 row, xoá cha = mất con giữ cha, UI vẫn báo "Đã xoá".
3. **P0 — E3.3 đổi thứ tự chết**: lỗi kiểu `order_index` (text vs integer) mỗi lần swap; biên thì toast xanh dối.
4. **P1 — E2.4c fork mất nội dung chạy được**: 0/59 lessons, 0/75 exercises, 59 node ôm `meta.lessonSlug` chết; fork chưa nằm trong transaction.
5. **P1 — NodeToolbar không gate role**: viewer/learner thấy Thêm/Sửa/Xoá/Lên/Xuống.
6. **P2 — E1.1/E1.2**: domain filter rỗng, mô tả card rỗng; ngữ nghĩa "số fork" = số người fork.
7. **P2 — FE**: /share vỡ ngang ở 360px; thiếu loading/error boundary cho nhánh public; fork-button nuốt lỗi; CTA trang node share dẫn nhầm vào workspace creator; không có lối vào /discover trong app; trang sign-in tiếng Anh.
8. **P3**: link "Xem roadmap →" trùng nhau (a11y), chip slug thô, /discover chưa phân trang, thiếu test cho fork/xoá/đảo thứ tự.
