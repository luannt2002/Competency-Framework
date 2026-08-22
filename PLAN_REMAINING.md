# Hàng đợi việc — làm ngầm đến khi cạn

> Chốt 2026-08-22, mốc `773c126`. Nguồn: 7 file rà trong `docs/audits/`.
> **Không chia đợt, không mốc duyệt.** Một hàng đợi xếp sẵn, làm từ trên xuống,
> chỉ dừng khi cạn hàng hoặc chạm một trong 5 câu ở §5.

---

## 1. Luật vòng lặp

Mỗi vòng làm đúng một mục trong hàng đợi:

1. **Lấy mục trên cùng chưa xong.**
2. **Vá** — theo kiến trúc `action (zod → resolveWorkspace → domain → writeAudit) → lib → db`.
3. **Chứng minh bằng thứ chạy được**, không bằng typecheck:
   - lỗi tầng SQL → test trong `tests/integration/**` (chạm Postgres thật)
   - lỗi logic thuần → unit test
   - lỗi luồng/route → `curl` hoặc Playwright trên **production build**
   - Không có bằng chứng chạy được thì mục đó **chưa xong**.
4. **Gates phải xanh**: `pnpm typecheck && pnpm lint && pnpm test && pnpm guard`.
5. **Đánh dấu `[x]`** trong file này, kèm bằng chứng một dòng.
6. **Commit** theo cụm mục cùng vùng file. Push khi cụm đó xanh.
7. Quay lại bước 1.

**Không xin phép giữa chừng.** Không hỏi "có làm tiếp không". Chỉ ping báo tiến độ
sau mỗi cụm.

### Luật đã trả giá, không vi phạm

| Luật | Lý do |
|---|---|
| Không viết số chưa chạy ra | mọi "N query", "X ms", "route 200" phải kèm lệnh thật |
| Node 20 | `export PATH=~/.local/node20/bin:$PATH` — hệ thống là 18 |
| Đo perf trên production build | `next dev` compile on-demand, lệch 0,3s → 13s |
| Bật DB trước khi kết luận app chậm | `docker start competency-postgres` |
| Gates xanh trước khi commit | — |
| Không thêm màu tự chế, không hardcode dữ liệu nghiệp vụ | `pnpm guard` đánh trượt |
| Sửa `full-tree` đếm đúng thì **phải nâng `EXPAND_ALL_LIMIT` cùng lúc** | total đúng 166 ≥ 60 ⇒ cây tự thu gọn ⇒ mất tính năng "thấy tất cả level" |
| Áp `0016_rls_policies.sql` **chỉ sau khi** `withWorkspace()` thread GUC thật | áp sớm = mọi query trả rỗng = app chết |

---

## 2. Điều kiện DỪNG

Dừng lại hỏi **chỉ khi** chạm 1 trong 5 câu ở §5, hoặc khi hành động đi ra ngoài
máy ngoài phạm vi đã cho phép (đã cho phép: commit + push `origin main`).

Cạn hàng đợi = xong. Không tự đẻ thêm việc ngoài file này.

---

## 3. HÀNG ĐỢI

### 3.1 — Nối đường đứt (tính năng đã xây xong nhưng không vào được)

- [x] **Q1** ✅ sidebar có mục "Chấm bài"; owner+editor đều thấy `href="/w/devops-test/grading"`, bấm vào 200 — `/w/[slug]/grading` không lối vào — `src/lib/rbac/admin-nav.ts` thiếu key `grading`. Bằng chứng: `grep "/grading"` trong `*.tsx` = **rỗng**. Thêm mục sidebar + badge đếm bài chờ chấm.
- [x] **Q2** ✅ sidebar có mục "Huy hiệu"; editor vào `/badges` → 200 — `/w/[slug]/badges` route mồ côi — cùng file, thiếu key `badges`. F16 vừa dựng xong, creator không có đường vào.
- [x] **Q3** ✅ members/audit về OWNER khớp `requireMinLevel` của chính trang; đo runtime: editor **không còn thấy** members/audit/settings, vẫn thấy roster/analytics/grading/badges. Test viết lại + thêm phép kiểm "không route mồ côi" — Sidebar EDITOR dẫn vào `NEXT_REDIRECT` — `admin-nav.ts:12,13` vs `members/page.tsx:81`, `audit/page.tsx:39`. `PHAN_QUYEN.md:95-97` nói Members/Audit là OWNER. ⚠️ `tests/unit/admin-nav.test.ts:11,12` **đang khoá chặt cái sai** — sửa test cùng lúc.
- [x] **Q4** ✅ tách `parseInviteCsv` ra `src/lib/admin/`, nhận email lẫn UUID, 13 unit test; `shortIdentifier` không cắt email nữa — Bulk CSV chặn email ở client — `bulk-invite-csv.tsx:63` `UUID_RE`. Server chạy được: POST thẳng trả `{"added":0,"invited":1}`.
- [x] **Q5** ✅ hàng đợi duyệt bằng chứng nằm cạnh hàng đợi chấm bài trên `/grading` (không dựng route mới để khỏi đẻ thêm route mồ côi). Đo runtime: gieo 2 dòng — đồ của người khác **hiện**, đồ của chính người duyệt **không hiện** (0/1 đúng như thiết kế), đã dọn sạch DB — Hàng đợi duyệt bằng chứng — `listEvidenceForSkill` đã mở cho EDITOR+, còn thiếu màn.
- [x] **Q6** ✅ link "Mở hồ sơ công khai" trong drawer roster; chuỗi có trong chunk client (drawer render phía client nên không nằm trong HTML SSR) — `/u/[id]` không nơi nào link tới — `grep 'href={`/u/'` = **0**. Thêm "Mở hồ sơ" trong drawer roster.
- [x] **Q7** ✅ sidebar có `href="/discover"`, đo runtime: CÓ — Không có lối vào `/discover` trong app — chỉ có ở landing + trang 404.
- [x] **Q8** ✅ `/w/devops-test/certificate` từ **404** → 200 (redirect sang `/certificate/<user.id>`) — `/w/[slug]/certificate` → 404 — thêm `certificate/page.tsx` redirect sang `/certificate/<user.id>`.

### 3.2 — RBAC tới được UI (gốc rễ một chỗ)

Hai resolver song song: `lib/workspace.ts:38-62` (`requireWorkspaceAccess`, ghim
cứng LEARNER, **không trả cấp quyền thật**) và `lib/rbac/resolve.ts:38-63`.

- [x] **Q9** ✅ `requireWorkspaceAccess` nay là lớp mỏng bọc `resolveWorkspace`, trả kèm `level` + `role`. Một resolver duy nhất, 11 call-site không phải sửa — Gộp `requireWorkspaceAccess` → gọi `resolveWorkspace(slug, LEARNER)`, trả kèm `ctx.level`.
- [x] **Q10** ✅ toolbar nhận `canEdit`/`canDelete`, nút không đủ quyền **không vào DOM**. Đo runtime: OWNER thấy đủ · EDITOR có Sửa nhưng **không có Xoá** (xoá đòi OWNER) · LEARNER chỉ còn nút tiến độ của chính mình — `node-toolbar.tsx:234-253` nhận `canEdit`/`canDelete`. Bằng chứng lỗi: cookie learner (level 20) → trang node 200 và **hiện đủ nút Thêm con/Lên/Xuống/Sửa/Xoá**, bấm mới nhận `WORKSPACE_NOT_FOUND_OR_FORBIDDEN`.
- [x] **Q11** ✅ empty state chỉ mời bấm "Thêm con" khi người xem thật sự có quyền — `n/[nodeSlug]/page.tsx:176` empty state bảo learner bấm nút họ không được phép.
- [x] **Q12** ✅ thêm `requireWorkspacePage` → 404 thay vì 500. Đo: viewer/người lạ/slug-không-tồn-tại đều **500 → 404**, và `WORKSPACE_NOT_FOUND_OR_FORBIDDEN` xuất hiện **0 lần** trong HTML. Error boundary bỏ in `error.message`, chỉ giữ `digest` — Viewer gặp **500** thay vì màn từ chối; HTML nhúng nguyên mã lỗi + đường dẫn tuyệt đối. `throw` → `notFound()` ở `workspace.ts:54,59` và `resolve.ts:55,60`.
- [x] **Q13** ✅ `requireAdminPage(slug, level)` thay 7 bản sao khối gác. Bịt luôn một rò rỉ: người ngoài trước đây bị redirect `/w/<slug>` rồi mới 404 — chặng đầu xác nhận slug tồn tại; nay 404 ngay. Ma trận runtime 7 trang × 4 vai đúng hết — 8 trang tự query `workspaces` + `requireMinLevel` thay vì `resolveWorkspace` (analytics/audit/badges/certificate/import/members/roster/settings — chỉ 3 trang dùng đúng).

### 3.3 — Số liệu đang sai (sửa trước khi làm đẹp)

- [x] **Q14** ✅ tạo `src/lib/day-vn.ts` làm nguồn duy nhất; `planner-dates` + `streak` + ô "XP hôm nay" + analytics + heatmap đều cắt theo giờ VN. 9 unit test, có mốc 16:59Z/17:00Z là ranh giới ngày — **Hai định nghĩa "hôm nay"** — planner + "XP today" cắt **UTC**, streak cắt **VN** ⇒ 00:00–07:00 giờ VN planner vẫn là kế hoạch hôm qua. `planner-dates.ts:1-16` vs `streak.ts:22-28` vs `layout.tsx:28-30`. Gom về `todayVN()`.
- [x] **Q15** ✅ `effectiveStreak()` tính lúc ĐỌC, không cần tiến trình nền. Dựng lại lỗi trên DB thật: chuỗi 7 + hoạt động cuối 01/08 → topbar hiện **0**; đổi hoạt động cuối thành hôm qua → hiện **7**. Đã dọn DB — **F13** streak không reset hằng ngày — dựng lại được: `last_active_date=2026-08-01`, hôm nay 21/8, topbar vẫn khoe **Streak 7**.
- [x] **Q16** ✅ sắp theo `(depth, orderIndex)` thay vì `path_str` (chuỗi UUID → thứ tự ngẫu nhiên), và dùng CHUNG ngưỡng 120 phút với planner. Đo tầng dữ liệu: 0 node >120 phút lọt vào, dài nhất còn lại **9 phút** (trước hiện "Tuần ~480p") — **B3.7** "Sắp tới" `ORDER BY path_str` mà `path_str` là chuỗi UUID ⇒ thứ tự ~ngẫu nhiên; rail không lọc `maxTaskMinutes` ⇒ render 5 node "Tuần ~480p".
- [x] **Q17** ✅ `descendantCount` tính bằng duyệt cây đã dựng thay vì cộng dồn theo thứ tự dòng; query sắp theo `(depth, orderIndex)`. Đo runtime: **166/166 node hiện trên một trang**, nhánh gốc hiện **159** hậu duệ (trước 48), một nhánh hiện **46** (trước 15) — **A3b** `full-tree.ts:45,73-80` `orderBy` chỉ theo `orderIndex`, giả định "con sau cha" ⇒ render "48 mục" trong khi đệ quy cho **159**; "Giai đoạn 1" hiện 15 trong khi thật 46. ⚠️ Nâng `EXPAND_ALL_LIMIT` cùng lúc.
- [x] **Q18** ✅ `tests/unit/full-tree.test.ts` — 6 test cho `countTreeNodes` + `defaultCollapsed`, gồm ràng buộc "ngưỡng phải đủ rộng cho lộ trình 166 mục" để không ai sửa phép đếm mà quên ngưỡng — `full-tree` chưa có **một** unit test nào — viết cùng Q17.
- [x] **Q19** ✅ thêm `both` vào truy vấn, thanh thứ 4 trong UI, và `orderBy` xét cả `both` + tổng. Đo: DB có đúng 1 dòng `both` → analytics hiện `0 / 0 / **1** / 0` thay vì `0/0/0` với bar rộng 0 — **C5.4** analytics bỏ sót `level_source='both'` ⇒ phân bố **0/0/0** dù có 1 learner; `orderBy count(verified)` cũng sai.
- [x] **Q20** ✅ tạo `src/lib/format-date.ts` ghim `vi-VN` + `Asia/Ho_Chi_Minh`, thay 8 chỗ `toLocale*` không truyền locale; `relativeTime` cũ uỷ quyền sang bản VN. 9 unit test, có phép kiểm chống lệch hydration (17:30Z = ngày hôm sau theo giờ VN) — 6+ chỗ `toLocaleDateString()` không truyền locale ⇒ "8/20/2026, 11:47:37 AM"; Server Component còn nguy cơ lệch hydration. Helper chung `Intl('vi-VN', Asia/Ho_Chi_Minh)`.
- [x] **Q21** ✅ `dashboard-rail` hiện ngày theo giờ VN thay vì `toISOString()` — `dashboard-rail.tsx:159` `toISOString()` = UTC ⇒ UTC+7 lùi 1 ngày trước 07:00.
- [x] **Q22** ✅ `999` là giá trị canh cho phép sắp xếp, nay không lọt ra chữ: hiện "chưa từng ôn" / "N ngày chưa ôn" — Sentinel `999` lọt ra UI: "Weak skill (unset) — 999d since last touch" (`daily-planner.ts:330`).

### 3.4 — Mất dữ liệu / chặn tính năng khác

- [x] **Q23** ✅ migration 0020 + `renameWorkspace` nhận mô tả (chuỗi rỗng = XOÁ, không quy về undefined) + form settings có textarea 280 ký tự. Đo runtime: `og:description` từ "Lộ trình học tập — 166 mục" → mô tả thật; hiện cả trên /share lẫn thẻ /discover — **`workspaces.description`** — migration + onboarding StepTwo + settings. **Chặn A2 và E1.2**: mô tả lộ trình hiện **không bao giờ hiện được**, kể cả `og:description`; `share/page.tsx:76` phải chữa cháy bằng cách mượn description của root và chỉ khi cây có đúng 1 root.
- [ ] **Q24** **E2.4c fork mất dữ liệu** — fork `devops-test`: lessons **0/59**, exercises **0/75**, badges 0/12, levels 0/4; 59 node ôm `meta.lessonSlug` chết. Node nguồn có "Practice", node fork thì không.
- [ ] **Q25** Fork **không có transaction** — hỏng giữa chừng để lại workspace nửa vời.

### 3.5 — UI/UX + FE

**Dọn hệ thiết kế**
- [ ] **Q26** Gỡ **17 dependency 0 import**: 10 gói Radix (`select`, `dropdown-menu`, `popover`, `avatar`, `progress`, `tabs`, `toast`, `label`, `separator`, `radio-group`, `scroll-area`), `@dnd-kit` ×3, `@tanstack/react-table`, `@tanstack/react-virtual`, `react-hook-form` + `@hookform/resolvers`, `zustand` — hoặc dùng chúng ở Q28.
- [ ] **Q27** Xoá **9 class CSS chết**: `card-brand`, `section-title`, `badge-brand-blue/red/gradient`, `nav-item-brand-active`, `brand-dot`, `surface-hover`, `section-numbered`. Xoá `backgroundImage['accent-gradient']` (hardcode cyan→tím, lệch brand, 0 nơi dùng). Sửa màu coral `#cc785c` trong `api/og/route.tsx`.

**Font + primitive**
- [ ] **Q28** **33 font stack inline kết thúc bằng `sans-serif`/`monospace` trần**, thiếu `var(--font-emoji)` ⇒ **emoji ra ô vuông □** đúng ở chỗ render emoji từ DB. `globals.css` đã vá đúng từ lâu, inline style thì chưa. Vá DRY: thêm `fontFamily.display` + `fontFamily.code` vào tailwind config, **đóng cả hai bằng `var(--font-emoji)`**, thay 33 inline style bằng class.
- [ ] **Q29** **13 thẻ `<select>` thô** → Radix Select.
- [ ] **Q30** Picker loại node không nhất quán (`/new` có emoji, 2 dialog không) → `<NodeTypeSelect>` dùng chung.

**Vỏ route**
- [ ] **Q31** 27 page nhưng chỉ **4 `loading.tsx`**, **2 `error.tsx`**, **0 `global-error.tsx`**. Thiếu cho `/share/**`, `/discover`, `/practice` (trang nặng nhất luồng), analytics, settings, roster, members, audit, import, badges, 2 route cert (lần đo đầu **6,5s**).
- [ ] **Q32** `w/[slug]/error.tsx:37-53` in thẳng `{error.message}` ra màn hình người dùng → câu cố định, chỉ giữ `digest`.

**Responsive**
- [ ] **Q33** **Mặt creator chết trên mobile** — `app-sidebar.tsx:87` `hidden md:flex`, BottomTabBar chỉ 4 tab ⇒ dưới 768px **không có đường tới** settings/analytics/roster/members/audit/import.
- [ ] **Q34** `/share` cuộn ngang ở 360px — `scrollWidth 382 > 360`; `share-tree.tsx:203` thụt `ml-3 pl-4` mỗi cấp, cây sâu 4.
- [ ] **Q35** Stat chip bị cắt ở 360px (`clientWidth 53 / scrollWidth 101`), `grid-cols-3` không breakpoint; thanh trên share thiếu `flex-wrap` ⇒ phình 80px.
- [ ] **Q36** Nút bung/thu cây **24×24** — dưới ngưỡng chạm 44×44, mà là điều khiển duy nhất của cây trên mobile.
- [ ] **Q37** Chứng nhận bóp méo ở mobile — 375px → tờ cert thành **375×794** (đúng phải 1123×794); ruy-băng tràn, QR văng khỏi vùng nhìn.
- [ ] **Q38** Skills mobile `hidden md:table-cell` giấu đúng 2 cột vừa làm (Source + Crowns); skeleton 6 cột vs bảng thật 7 ⇒ nhảy layout.
- [ ] **Q39** Mobile có **2 `<h1>`** cùng lúc (topbar `md:hidden` + hero).

**A11y**
- [ ] **Q40** **17 `<label>` không `htmlFor`** — `new/page.tsx`, `node-toolbar.tsx`, `resource-add-dialog.tsx`.
- [ ] **Q41** `<tr onClick>` không bàn phím — `roster-table.tsx:210-215`, bàn phím không mở được drill-down.
- [ ] **Q42** QR không `role`/`aria-label`, `<svg>` không `<title>` (cert `:421-425`). Thiếu `<main>` + skip-link ở `cert/[id]/page.tsx:81`.
- [ ] **Q43** 🔒 chỉ trang trí — `vertical-roadmap.tsx:201` vẫn là `<Link>` bấm được, aria không nói khoá, **không gate server nào**.
- [ ] **Q44** Confetti onboarding thiếu `prefers-reduced-motion` (`onboarding/page.tsx:300-315`); `confetti.tsx` thì có.

**Ngôn ngữ**
- [ ] **Q45** **Sign-in 100% tiếng Anh** — đích của MỌI CTA, đúng điểm chuyển đổi.
- [ ] **Q46** Settings / Daily / Skills / drawer / onboarding bước 1 còn tiếng Anh, app khai `lang="vi"`. Settings còn lộ ghi chú nội bộ "fixed for MVP"; onboarding dạy người dùng cuối chạy `pnpm db:seed`.
- [x] **Q47** ✅ 4 chuỗi tiếng Anh ghi thẳng vào `daily_tasks.title/description` đã việt hoá; 3 test chặn hồi quy (danh sách 10 cụm tiếng Anh không được xuất hiện) — **Chuỗi tiếng Anh GHI THẲNG VÀO DB** — `daily-planner.ts:276,278,338-339,358` → `daily_tasks.title='Keep your streak alive'`. Đổi sang `titleKey + params`, dịch lúc render.
- [ ] **Q48** Nhãn lộ phiên bản nội bộ: "Verified evidence (V8)" (`skill-drawer.tsx:435`).

**Lỗi hiển thị**
- [ ] **Q49** Class hỏng `bg-primary/10/10`, `border-primary/40/30` (hai dấu `/`) ⇒ mất nền — `invite-member-dialog.tsx:125`, `members/page.tsx:306`.
- [ ] **Q50** `Sparkles` `absolute top-1` nhưng cha không `relative` ⇒ chấm nhảy về góc trái thanh nav (`app-sidebar.tsx:319`).
- [ ] **Q51** Toast in `String(e)` ⇒ hiện nguyên mảng JSON của ZodError (`new/page.tsx:49`, `node-toolbar.tsx:429,545`); toolbar in nguyên văn lỗi Postgres cho người dùng.
- [ ] **Q52** Toast badge in **tên icon Lucide** ("Huy hiệu mới: Footprints First Step"); profile vẽ cứng 🏅 cho mọi badge.
- [ ] **Q53** `use-gamification.ts` là code chết ⇒ topbar không bao giờ tự refresh.
- [ ] **Q54** Empty state in ra literal `/w/[slug]/members` không bấm được (`roster/page.tsx:357`).
- [ ] **Q55** `resources-section.tsx:98` chỉ kể 3/6 loại tài liệu — text lỗi thời sau vá C3.2.
- [ ] **Q56** readOnly vẫn mời hành động không tồn tại: "hãy đóng góp link/video/sách", "viết ghi chú đầu tiên" trên trang ẩn danh.
- [ ] **Q57** Analytics in "Level TB 33.0" = `numeric_value` thô (XS=0, S=33, M=66, L=100).

**Hành động phá huỷ**
- [ ] **Q58** `window.confirm` cho 4 hành động phá huỷ (`node-toolbar.tsx:147`, `invite-row-actions.tsx:26`, `member-row-actions.tsx:53`, `delete-workspace-form.tsx:23`) trong khi repo đã có Dialog.
- [ ] **Q59** 1 click là cả cây ra Internet — `visibility-toggle.tsx:27-41` không xác nhận, không undo, không hiện link share, lỗi in mã thô `UPDATE_FAILED`.
- [ ] **Q60** Nút Xoá badge không xác nhận.

**Dead-end**
- [ ] **Q61** Cert "chưa đủ điều kiện" 0 CTA · `/cert` public khi ws private có **0 link** · `/discover` lọc rỗng không có nút xoá lọc · CTA trang node share dẫn vào `/w/<slug-của-creator>` (A11).

**Hardcode nghiệp vụ trong `src/app` / `src/components`** (vi phạm luật repo)
- [ ] **Q62** `vertical-roadmap.tsx:353-357` in cứng chú giải "Cyan · Phase 1 … Pink · Bonus" — đo trên workspace 2 node, không phase nào, **vẫn in đủ 5 dòng**.
- [ ] **Q63** `share/[slug]/page.tsx:237-238` nhãn "Giai đoạn/Tuần/Buổi" là từ vựng riêng DevOps → `nodeTypeLabel()`.
- [ ] **Q64** `not-found.tsx:56` hardcode `/share/devops-test` ⇒ 404 dẫn sang 404; `cert/[id]/page.tsx:23` hardcode `SITE_NAME`.
- [ ] **Q65** **4 bản sao** hàm `shortId(UUID)` rải rác thay vì `getUsersDisplay` — `/members`, `/audit`, `/grading`, `roster`.

### 3.6 — Tính năng còn nợ

- [ ] **Q66** **B2.2** onboarding "fork từ cộng đồng" query nhầm bảng — đọc `framework_templates` (1 dòng) thay vì `workspaces` public (2 dòng) ⇒ không hiện cái nào.
- [ ] **Q67** **B3.3** dashboard chỉ vẽ 2 tầng — 166 node → 9 pill; `full-tree.ts` đã có sẵn.
- [ ] **Q68** **B4.10** con xong hết → cha tự done; hiện chỉ có cascade chiều **bỏ**-done.
- [ ] **Q69** **B4.17** thông báo đã chấm dẫn về dashboard — notification ghi đủ `resourceType/resourceId`, `navTargetFor` bỏ hết.
- [ ] **Q70** **B6.3** crowns hiện "1/5" thay vì ●●●○○ (màu theo nguồn đã đúng).
- [ ] **Q71** **B5.3/5.5/5.8** nút Skip bị giấu trong menu "…" · không tự nhảy task kế · EmptyState chết trong `today-focus.tsx:284-301` (page đã gác `tasks.length > 0`).
- [ ] **Q72** **B7.3** OG thiếu %/skill/tên người học — `completionPct` đã có sẵn.
- [ ] **Q73** **C2.4** est. minutes ở form tạo root — `createTreeNode` đã nhận, trang chỉ quên gửi.
- [ ] **Q74** **C3.1** không xoá được Body/Mô tả/Est — `''→undefined` + zod chưa `.nullable()`.
- [ ] **Q75** **E1.1** filter domain rỗng 100% — cả 2 ws public đều có 2 root ⇒ `rootNodeType:null` ⇒ dropdown là **control chết**.
- [ ] **Q76** **D3.5** skills gap matrix của team (hiện chỉ có ma trận cá nhân).
- [ ] **Q77** **D3.7** export "PDF" thật ra **HTML** — `@react-pdf/renderer` đã cài, `grep src/` chỉ ra 1 dòng **comment**. Render PDF thật hoặc đổi nhãn cho đúng.
- [ ] **Q78** **D4.3/D4.4** skills + activity của member khác — API ghim cứng `user.id`; audit không lọc actor, cứng `limit 100`, không phân trang.
- [ ] **Q79** **D4.5/D4.6** giao task (`node_assignments`) · nhắc nhở (`remindMember`, chặn spam 1 lần/người/ngày).
- [ ] **Q80** **D2.4** chuyển quyền sở hữu — `owner` ngoài `assignableRole`, không action nào ghi `owner_user_id`.
- [ ] **Q81** **D-perf** `findUserIdByEmail` duyệt **tới 20 trang × 200 user MỖI email**; lỗi Supabase → trả `null` ⇒ user đang tồn tại **âm thầm** thành "invite pending" (đúng điều đang xảy ra trên máy này). Lọc theo email + tách lỗi khỏi không-tìm-thấy.
- [ ] **Q82** **G1** notification khi đủ ≥80% — kind `milestone.completed` khai rồi, **0 nơi ghi**.
- [ ] **Q83** **G5** "Ngày cấp" ≠ ngày hoàn thành — `user_node_progress.completed_at` đã có, **chưa ai đọc**.
- [ ] **Q84** **G7** skills đã đạt trên cert — `grep skill` trên trang cert = **0**.
- [ ] **Q85** **G11** ảnh badge LinkedIn — `/api/og?cert=<code>` hiện trả 400.
- [ ] **Q86** **`revokeCertificate`** — `revoked_at` hiện **không nơi nào ghi**; UI thu hồi đã sẵn sàng từ đợt trước.
- [ ] **Q87** **G-arch** cert ghi DB trong lúc render (mọi prefetch đều cấp chứng nhận) · không qua `resolve.ts` · nhánh self-service không tự kiểm membership.
- [ ] **Q88** **B4.7** config "bắt buộc có bằng chứng mới được done" — `grep requireEvidence` = 0.
- [ ] **Q89** **B5.2** tín hiệu deadline/timeline — schema không có cột hạn.
- [ ] **Q90** `/cert/` vào `robots.txt` disallow.
- [ ] **Q91** Rò rỉ journal/bình luận của thành viên ra trang share — `journal-section.tsx:48-57` đọc thẳng DB không lọc tác giả. **Chưa dựng lại được** vì bảng đang 0 dòng ⇒ seed rồi kiểm; nếu rò rỉ thật thì đây là P0.

### 3.7 — RLS (cuối cùng, có đường lùi)

`0016_rls_policies.sql` (45 bảng, 256 dòng) đang **cách ly có chủ đích** trong
`tests/unit/migration-journal.test.ts`. Hai điều kiện đã xong ở đợt trước: role
`competency_app` không superuser/không BYPASSRLS và tái tạo được từ repo; bảng
thuộc `postgres` — **chủ bảng đọc xuyên mọi policy** nên đây là điều kiện sống còn.

- [ ] **Q92** Viết `withWorkspace()` thật — hiện là **hàm rỗng 22 dòng** ở `src/lib/db/scoped.ts`: nhận `workspaceId` rồi gọi thẳng `fn(db, workspaceId)`, **không mở transaction, không `SET LOCAL app.workspace_id`**.
- [ ] **Q93** Chuyển các đường đọc/ghi workspace-scoped qua `withWorkspace`.
- [ ] **Q94** Test cross-tenant bằng role thường: cùng một query, hai workspace, **0 rò rỉ**.
- [ ] **Q95** Gỡ cách ly `0016` khỏi `QUARANTINE`, chạy migrate, đo lại.
- [ ] **Q96** Đo lại 6 trục, ghi số mới vào `luannt-tets.md` **kèm lệnh đã chạy**.

---

## 4. Sổ tiến độ

| Ngày | Cụm | Kết quả |
|---|---|---|
| 2026-08-22 | — | Hàng đợi lập: **96 mục**. Bắt đầu từ Q1. |
| 2026-08-22 | Q22, Q23, Q47 | **24 mục xong.** Mô tả lộ trình lần đầu hiện được. Test 444 → **447**. |
| 2026-08-22 | Q16–Q19 | **21 mục xong.** Cây share hiện đủ 166/166 node; phép đếm hết sai. Test 438 → **444**. |
| 2026-08-22 | Q14, Q15, Q21 | **17 mục xong.** Chỉ còn MỘT định nghĩa "hôm nay". Test 423 → **438**. |
| 2026-08-22 | Q9–Q13 | **14 mục xong.** Gộp hai resolver song song — gốc rễ của việc learner thấy nút Sửa/Xoá. Ma trận quyền 7 trang × 4 vai đo runtime, đúng hết. |
| 2026-08-22 | Q5, Q20 | **9 mục xong.** Test 413 → **423**. Hàng đợi duyệt bằng chứng chạy thật; ngày giờ hết render kiểu Mỹ. |
| 2026-08-22 | Q1–Q4, Q6–Q8 | **7 mục xong.** Test 400 → **413**. Đo runtime theo vai: editor không còn thấy link vào trang OWNER, và 4 trang EDITOR đều vào được thật. |

---

## 5. Năm câu phải hỏi — điểm dừng duy nhất

1. **Tầng tổ chức** — `organizations` + `org_members` + `workspaces.org_id` có schema, **0 dòng code dùng**. `PRODUCT_MINDSET.md` ghi rõ "không phải LMS doanh nghiệp" ⇒ bật lên là **đổi hướng sản phẩm**.
2. **Gửi mail invite (D2.5)** — cần dịch vụ mail ngoài. Quyết định hạ tầng + chi phí. *(Không chặn hàng đợi: làm nút copy link mời trước.)*
3. **Slug sửa được (C1.2)** — URL công khai đã phát ra ngoài; đổi slug phải kèm bảng redirect, nếu không là **hỏng link người khác đã chia sẻ**.
4. **Visibility thứ ba (C4.1)** — "members-only" nghĩa là gì cho đúng sản phẩm cá nhân?
5. **White-label** — logo + màu tự do có kiểm contrast, hay 10 màu + 20 emoji là đủ?

---

## 6. Cạn hàng đợi khi

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm guard && pnpm build` xanh.
2. DB **trắng** → `drizzle-kit migrate` → `pnpm db:seed` → test xanh.
3. RLS bật, chạy bằng role **không-superuser**, có test cross-tenant chứng minh.
4. 7/7 luồng **không còn mục ĐỨT**; SAI/THIẾU còn lại đều là một trong 5 câu ở §5.
5. e2e phủ desktop lẫn mobile, gồm phép đo tràn ngang.
6. Số đo 6 trục ghi vào `luannt-tets.md` kèm lệnh đã chạy.
