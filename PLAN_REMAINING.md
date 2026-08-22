# Kế hoạch còn lại — chi tiết theo từng luồng

> Chốt 2026-08-22, mốc `580703a`. Nguồn: 7 file rà trong `docs/audits/` (945 dòng
> bằng chứng, mỗi mục kèm `file:line` **và** lệnh đã chạy).
>
> File này thay cho việc mở lại 7 file audit mỗi lần. `PLAN_FIX_ALL.md` là
> lịch sử đợt vừa rồi; file này là **việc phía trước**.

---

## 0. Cách đọc

| Ký hiệu | Nghĩa |
|---|---|
| **ĐỨT** | code có đủ, không UI nào gọi — vá rẻ nhất, giá trị cao nhất |
| **SAI** | chạy được nhưng lệch đặc tả hoặc lệch sự thật |
| **THIẾU** | chưa có code |
| **P0/P1/P2** | P0 = hỏng nghiệp vụ hoặc lộ dữ liệu · P1 = ngõ cụt / sai quyền · P2 = trải nghiệm |

**Luật xếp mẻ:** gom theo **file bị đụng**, không gom theo luồng. Một luồng
trải khắp `actions/ → lib/ → app/ → components/`, nên chạy song song theo luồng
là giẫm chân nhau. Bảng phụ lục §4 giữ góc nhìn theo luồng để không sót.

**Luật đo (kế thừa, đã trả giá):** không viết con số chưa chạy ra · Node 20
(`export PATH=~/.local/node20/bin:$PATH`) · đo perf trên production build · gates
xanh trước khi commit · agent ghi nhiều file thì làm ở worktree riêng.

---

## 1. Đã xong — không làm lại

Đợt A (rà 7/7 luồng) · B (dựng lại từ số 0) · C0 (rò rỉ private) · C1 (10 P0) ·
C3 (hearts F7/F8/F9/F11) · F (CI + e2e mobile).

Gates hiện tại: typecheck ✓ · lint 0 ✓ · **test 399/399** ✓ · guard ×4 ✓ ·
build ✓ · **e2e 12/12** desktop+mobile ✓ · DB trắng dựng lại khớp schema 100%.

---

## 2. Bản đồ thi công — 6 đợt

### ĐỢT 1 — Nối đường đứt (rẻ nhất, giá trị cao nhất)

Tính năng **đã dựng xong nhưng không vào được**. Không viết logic mới, chỉ nối dây.

| # | Việc | File | Bằng chứng |
|---|---|---|---|
| 1.1 | `/w/[slug]/grading` không có lối vào | `src/lib/rbac/admin-nav.ts` (thiếu key `grading`) | `grep "/grading"` trong `*.tsx` = **rỗng** |
| 1.2 | `/w/[slug]/badges` là route mồ côi | cùng file, thiếu key `badges` | không `href` nào trỏ tới; F16 vừa dựng xong |
| 1.3 | Sidebar EDITOR dẫn vào `NEXT_REDIRECT` | `admin-nav.ts:12,13` vs `members/page.tsx:81`, `audit/page.tsx:39` | `PHAN_QUYEN.md:95-97` nói Members/Audit là OWNER. **`tests/unit/admin-nav.test.ts:11,12` đang khoá chặt cái sai — phải sửa test cùng lúc** |
| 1.4 | Bulk CSV chặn email ở client dù server nhận được | `bulk-invite-csv.tsx:63` `UUID_RE` | POST thẳng server: `{"added":0,"invited":1}` — server CHẠY ĐƯỢC |
| 1.5 | Hàng đợi duyệt bằng chứng | `listEvidenceForSkill` đã mở cho EDITOR+ ở đợt trước, còn thiếu màn | `evidence_grades` = 0 dòng |
| 1.6 | `/u/[id]` không nơi nào link tới | `roster-table.tsx` drawer | `grep 'href={`/u/'` = **0** |
| 1.7 | Không có lối vào `/discover` trong app | `app-sidebar.tsx` | chỉ có ở landing + trang 404 |
| 1.8 | `/w/[slug]/certificate` → 404 | thiếu `certificate/page.tsx` | chỉ `/certificate/<uuid>` mới 200 |

**Đo xong:** mỗi route có ít nhất một `href` trỏ tới, bấm được, không rơi vào redirect.

---

### ĐỢT 2 — RBAC tới được UI (P1 nặng nhất còn lại)

**Gốc rễ một chỗ:** có **hai** resolver workspace song song —
`lib/workspace.ts:38-62` (`requireWorkspaceAccess`, ghim cứng ở LEARNER, **không
trả cấp quyền thật**) và `lib/rbac/resolve.ts:38-63`. Trang node dùng cái thứ
nhất nên không biết người xem là ai, và render đủ nút cho mọi người.

| # | Việc | Bằng chứng đã đo |
|---|---|---|
| 2.1 | Gộp `requireWorkspaceAccess` → gọi `resolveWorkspace(slug, LEARNER)` và **trả kèm `ctx.level`** | — |
| 2.2 | `node-toolbar.tsx:234-253` nhận `canEdit`/`canDelete` từ `viewerEff` | cookie learner (level 20) → trang node 200 và **hiện đủ nút Thêm con/Lên/Xuống/Sửa/Xoá**; bấm nhận toast `WORKSPACE_NOT_FOUND_OR_FORBIDDEN` |
| 2.3 | `n/[nodeSlug]/page.tsx:176` empty state đang bảo learner bấm nút họ không được phép | — |
| 2.4 | Viewer gặp **500** thay vì màn từ chối | `curl` vai viewer → 500, HTML nhúng nguyên `WORKSPACE_NOT_FOUND_OR_FORBIDDEN` + đường dẫn tuyệt đối |
| 2.5 | `throw` → `notFound()` ở `workspace.ts:54,59` và `resolve.ts:55,60` | `/w/khong-ton-tai` cũng 500 ⇒ vẫn không phân biệt được, nhưng sai mã trạng thái |
| 2.6 | 8 trang tự query `workspaces` + `requireMinLevel` thay vì `resolveWorkspace` | analytics/audit/badges/certificate/import/members/roster/settings — chỉ 3 trang dùng đúng |

---

### ĐỢT 3 — Thời gian, thứ tự, phép đếm (sai lặng lẽ, khó thấy)

Nhóm này không làm app sập, nhưng làm **mọi con số hiển thị sai**.

| # | Việc | Bằng chứng đã đo |
|---|---|---|
| 3.1 | **Hai định nghĩa "hôm nay"** — planner + "XP today" cắt theo **UTC**, streak cắt theo **VN** ⇒ 00:00–07:00 giờ VN planner vẫn là kế hoạch hôm qua | `planner-dates.ts:1-16` vs `streak.ts:22-28` vs `layout.tsx:28-30`; psql: `16:19 UTC` = `23:19 VN` |
| 3.2 | Gom về `todayVN()` dùng chung; cân nhắc đưa tz vào `user_planner_settings` | — |
| 3.3 | **F13** streak không reset hằng ngày, topbar stale giữa các ngày | dựng lại: `last_active_date=2026-08-01`, hôm nay 21/8, topbar vẫn khoe **Streak 7** |
| 3.4 | **B3.7** "Sắp tới" `ORDER BY path_str` mà `path_str` là chuỗi UUID ⇒ thứ tự ~ngẫu nhiên; rail không lọc `maxTaskMinutes` | render ra 5 node "Tuần ~480p" |
| 3.5 | **A3b** `full-tree.ts:45,73-80` `orderBy` chỉ theo `orderIndex`, giả định "con sau cha" — sai | render "48 mục" trong khi đệ quy cho **159**; "Giai đoạn 1" hiện 15 trong khi thật 46 |
| 3.6 | ⚠️ Sửa 3.5 phải **nâng `EXPAND_ALL_LIMIT` cùng lúc** | total đúng 166 ≥ 60 ⇒ cây tự thu gọn ⇒ A3 "thấy tất cả level" mất luôn |
| 3.7 | `full-tree` chưa có **một** unit test nào | `tests/unit/` không có file nào cho nó |
| 3.8 | **C5.4** analytics bỏ sót `level_source='both'` ⇒ phân bố **0/0/0** khi có 1 learner; `orderBy count(verified)` cũng sai | psql: `user_skill_progress` có đúng 1 dòng, giá trị `both` |
| 3.9 | 6+ chỗ `toLocaleDateString()` không truyền locale ⇒ render "8/20/2026, 11:47:37 AM"; Server Component còn nguy cơ lệch hydration | `skills-table-client.tsx:340`, `grading-queue.tsx:59`, `audit-row.tsx:47`, `members/page.tsx:39`, `profile/page.tsx:79,203`, `utils.ts:32` |
| 3.10 | `dashboard-rail.tsx:159` dùng `toISOString()` = UTC ⇒ UTC+7 lùi 1 ngày trước 07:00 | — |
| 3.11 | Sentinel `999` lọt ra UI: "Weak skill (unset) — 999d since last touch" | `actions/daily-planner.ts:330` |

---

### ĐỢT 4 — UI/UX + FE (4 mẻ, không đè file)

#### Mẻ 4A — Dọn hệ thiết kế
- **17 dependency cài mà 0 dòng import**: 10 gói Radix (`select`, `dropdown-menu`,
  `popover`, `avatar`, `progress`, `tabs`, `toast`, `label`, `separator`,
  `radio-group`, `scroll-area`), `@dnd-kit` ×3, `@tanstack/react-table`,
  `@tanstack/react-virtual`, `react-hook-form` + `@hookform/resolvers`, `zustand`.
- **9 class CSS chết** trong `globals.css`: `card-brand`, `section-title`,
  `badge-brand-blue/red/gradient`, `nav-item-brand-active`, `brand-dot`,
  `surface-hover`, `section-numbered`.
- `tailwind.config.ts` còn `backgroundImage['accent-gradient']` hardcode
  cyan→tím (lệch brand blue→đỏ) và **0 nơi dùng**.
- `api/og/route.tsx` vẽ bằng coral `#cc785c` — bảng màu đời trước, lệch brand.

#### Mẻ 4B — Font + primitive
- **33 font stack inline kết thúc bằng `sans-serif`/`monospace` trần**, thiếu
  `var(--font-emoji)` ⇒ **emoji ra ô vuông □** đúng ở những chỗ render emoji từ
  DB (roadmap node, share tree, roster, search dialog). `globals.css` đã vá đúng
  từ lâu, nhưng inline style thì chưa.
  → Cách vá DRY: thêm `fontFamily.display` (Outfit) + `fontFamily.code`
  (JetBrains) vào tailwind config, **đóng cả hai bằng `var(--font-emoji)`**, rồi
  thay 33 inline style bằng `className="font-display" / "font-code"`.
- **13 thẻ `<select>` thô** → Radix Select (gói đã cài sẵn, xem 4A).
- Picker loại node không nhất quán: `/new` có emoji, 2 dialog thì không →
  `<NodeTypeSelect>` dùng chung.

#### Mẻ 4C — Vỏ route
- 27 page nhưng chỉ **4 `loading.tsx`**, **2 `error.tsx`**, **0 `global-error.tsx`**.
- Thiếu hẳn cho: `/share/**`, `/discover`, `/practice` (trang nặng nhất luồng),
  `analytics`, `settings`, `roster`, `members`, `audit`, `import`, `badges`,
  2 route cert (lần đo đầu **6,5s**).
- `w/[slug]/error.tsx:37-53` in thẳng `{error.message}` ra màn hình người dùng →
  thay bằng câu cố định, chỉ giữ `digest`.

#### Mẻ 4D — Responsive + a11y + ngôn ngữ
| Vấn đề | Bằng chứng đã đo |
|---|---|
| **Mặt creator chết trên mobile** | `app-sidebar.tsx:87` `hidden md:flex`, BottomTabBar chỉ 4 tab ⇒ dưới 768px **không có đường tới** settings/analytics/roster/members/audit/import |
| `/share` cuộn ngang ở 360px | `scrollWidth 382 > 360`; thủ phạm `share-tree.tsx:203` thụt `ml-3 pl-4` mỗi cấp, cây sâu 4 |
| Stat chip bị cắt ở 360px | `clientWidth 53 / scrollWidth 101`; `grid-cols-3` không breakpoint |
| Thanh trên share phình 80px | `share/[slug]/page.tsx:218` thiếu `flex-wrap` |
| Nút bung/thu cây **24×24** | dưới ngưỡng chạm 44×44, mà đó là điều khiển duy nhất của cây trên mobile |
| Chứng nhận bóp méo ở mobile | 375px viewport → tờ cert thành **375×794** (đúng phải 1123×794); ruy-băng tràn, QR văng khỏi vùng nhìn |
| Skills mobile giấu đúng 2 cột vừa làm | `hidden md:table-cell` giấu Source + Crowns (B6.2/B6.3) |
| Skeleton lệch 1 cột | skeleton 6 cột vs bảng thật 7 → nhảy layout |
| **17 `<label>` không `htmlFor`** | `new/page.tsx`, `node-toolbar.tsx`, `resource-add-dialog.tsx` |
| `<tr onClick>` không bàn phím | `roster-table.tsx:210-215` — bàn phím không mở được drill-down |
| QR không có `role`/`aria-label`, `<svg>` không `<title>` | cert page `:421-425` |
| 🔒 chỉ trang trí | `vertical-roadmap.tsx:201` vẫn là `<Link>` bấm được, aria không nói khoá, **không gate server nào** |
| **Sign-in 100% tiếng Anh** | đích của MỌI CTA, đúng điểm chuyển đổi |
| Settings / Daily / Skills / drawer / onboarding bước 1 còn tiếng Anh | app khai `lang="vi"` |
| **Chuỗi tiếng Anh GHI THẲNG VÀO DB** | `daily-planner.ts:276,278,338-339,358` → `daily_tasks.title='Keep your streak alive'`. Phải đổi sang `titleKey + params`, dịch lúc render |
| `window.confirm` cho 4 hành động phá huỷ | `node-toolbar.tsx:147`, `invite-row-actions.tsx:26`, `member-row-actions.tsx:53`, `delete-workspace-form.tsx:23` — trong khi cùng repo đã có Dialog |
| 1 click là cả cây ra Internet | `visibility-toggle.tsx:27-41` không xác nhận, không undo, không hiện link share, lỗi in mã thô `UPDATE_FAILED` |
| Toast in `String(e)` → hiện nguyên mảng JSON của ZodError | `new/page.tsx:49`, `node-toolbar.tsx:429,545` |
| Toolbar in nguyên văn lỗi Postgres cho người dùng | — |
| Toast badge in **tên icon Lucide** | "Huy hiệu mới: Footprints First Step" |
| Profile vẽ cứng 🏅 cho mọi badge | — |
| `use-gamification.ts` là code chết ⇒ topbar không bao giờ tự refresh | — |
| Mobile có **2 `<h1>`** cùng lúc | topbar `md:hidden` + hero |
| Confetti onboarding thiếu `prefers-reduced-motion` | `onboarding/page.tsx:300-315`; `confetti.tsx` thì có |
| `Sparkles` `absolute top-1` nhưng cha không `relative` | ⇒ chấm nhảy về góc trái thanh nav |
| Class hỏng `bg-primary/10/10`, `border-primary/40/30` (hai dấu `/`) | `invite-member-dialog.tsx:125`, `members/page.tsx:306` → mất nền |
| Empty state in ra literal `/w/[slug]/members` không bấm được | `roster/page.tsx:357` |
| Text lỗi thời sau vá C3.2 | `resources-section.tsx:98` chỉ kể 3/6 loại tài liệu |
| readOnly vẫn mời hành động không tồn tại | "hãy đóng góp link/video/sách", "viết ghi chú đầu tiên" trên trang ẩn danh |
| Dead-end | cert "chưa đủ điều kiện" 0 CTA · `/cert` public khi ws private có **0 link** · `/discover` lọc rỗng không có nút xoá lọc |
| Thiếu `<main>`, không skip-link | `cert/[id]/page.tsx:81` |

#### Hardcode nghiệp vụ trong `src/app` / `src/components` (vi phạm luật repo)
- `vertical-roadmap.tsx:353-357` in cứng chú giải "Cyan · Phase 1 … Pink · Bonus"
  — đo trên workspace 2 node, không phase nào, **vẫn in đủ 5 dòng**.
- `share/[slug]/page.tsx:237-238` nhãn "Giai đoạn/Tuần/Buổi" là từ vựng riêng
  của DevOps 12 tháng → dùng `nodeTypeLabel()`.
- `not-found.tsx:56` hardcode `/share/devops-test` → 404 dẫn sang 404.
- `cert/[id]/page.tsx:23` hardcode `SITE_NAME`.
- Nhiều nơi tự viết `shortId(UUID)` — **4 bản sao** — thay vì `getUsersDisplay`.

---

### ĐỢT 5 — RLS (rủi ro cao, làm sau cùng, có đường lùi)

`0016_rls_policies.sql` (45 bảng, 256 dòng) **vẫn cách ly có chủ đích** trong
`tests/unit/migration-journal.test.ts`.

Đợt B đã dọn xong **hai trong bốn** điều kiện:
- ✅ role `competency_app` không superuser, không BYPASSRLS, tái tạo được từ repo
- ✅ bảng thuộc `postgres` (DDL chạy `DATABASE_URL_DIRECT`) — **chủ bảng đọc
  xuyên mọi policy**, nên đây là điều kiện sống còn, không phải chi tiết vụn

Còn hai:
- ❌ `withWorkspace()` ở `src/lib/db/scoped.ts` hiện là **hàm rỗng 22 dòng** —
  nhận `workspaceId` rồi gọi thẳng `fn(db, workspaceId)`, **không mở transaction,
  không `SET LOCAL app.workspace_id`**.
- ❌ Chưa có test cross-tenant chứng minh bằng role thường.

Thứ tự bắt buộc: viết `withWorkspace` thật → chuyển các đường đọc/ghi qua nó →
test 2 workspace 0 rò rỉ → **rồi mới** gỡ cách ly `0016`. Áp `0016` trước khi
thread GUC = mọi query trả rỗng = app chết.

---

### ĐỢT 6 — Còn nợ theo tính năng

| Mã | Việc | Ghi chú |
|---|---|---|
| C1.3 | `workspaces.description` (migration + onboarding + settings) | **chặn A2 và E1.2** — mô tả lộ trình hiện không bao giờ hiện, kể cả `og:description` |
| C1.2 | Slug sửa được | cần bảng redirect slug cũ, vì `/share/<slug>` đã phát ra ngoài |
| C2.4 | Est. minutes ở form tạo root | `createTreeNode` đã nhận, trang chỉ quên gửi |
| C3.1 | Không xoá được Body/Mô tả/Est | `''→undefined` + zod chưa `.nullable()` |
| C4.1 | Đủ 3 visibility (đang có 2) | `pg_enum` chỉ có `private`, `public-readonly` |
| E2.4c | **Fork mất lessons/exercises** | fork `devops-test`: lessons **0/59**, exercises **0/75**, badges 0/12, levels 0/4; 59 node ôm `meta.lessonSlug` chết. Fork cũng **không có transaction** |
| E1.1 | Filter domain rỗng 100% | cả 2 ws public đều có 2 root ⇒ `rootNodeType:null` ⇒ dropdown chỉ còn "Mọi loại" — là **control chết** |
| B2.2 | Onboarding "fork từ cộng đồng" query nhầm bảng | đọc `framework_templates` (1 dòng) thay vì `workspaces` public (2 dòng) ⇒ không hiện cái nào |
| B3.3 | Dashboard chỉ vẽ 2 tầng | 166 node → 9 pill; `full-tree.ts` đã có sẵn |
| B4.7 | Config "bắt buộc có bằng chứng mới được done" | `grep requireEvidence` = 0 |
| B4.10 | Con xong hết → cha tự done | chỉ có cascade chiều **bỏ**-done (`reopenDoneAncestors`) |
| B4.17 | Thông báo đã chấm dẫn về dashboard | `notification` ghi đủ `resourceType/resourceId`, `navTargetFor` bỏ hết |
| B5.2/5.3/5.5/5.8 | deadline · nút Skip bị giấu trong menu "…" · không tự nhảy task kế · EmptyState chết | |
| B6.3 | Crowns hiện "1/5" thay vì ●●●○○ | màu theo nguồn thì đã đúng |
| B7.3 | OG thiếu %/skill/tên người học | `completionPct` đã có sẵn |
| D2.4 | Chuyển quyền sở hữu | `owner` ngoài `assignableRole`, không action nào ghi `owner_user_id` |
| D2.5 | **Không một dòng code nào gửi mail invite** | auto-join khi đăng nhập thì chạy thật; thiếu `/invite/[token]` + gửi mail. Tối thiểu: nút copy link mời |
| D3.5 | Skills gap matrix của team | hiện chỉ có ma trận cá nhân |
| D3.7 | Export "PDF" thật ra **HTML** | `@react-pdf/renderer` đã cài, `grep src/` chỉ ra 1 dòng **comment** |
| D4.3/4.4 | Skills + activity của member khác | API ghim cứng `user.id`; audit không lọc actor, cứng `limit 100`, không phân trang |
| D4.5/4.6 | Giao task · nhắc nhở | cần bảng `node_assignments`; `remindMember` phải chặn spam |
| G1 | Notification khi đủ ≥80% | kind `milestone.completed` khai rồi, **0 nơi ghi** |
| G5 | "Ngày cấp" ≠ ngày hoàn thành | `user_node_progress.completed_at` đã có, **chưa ai đọc** |
| G7 | Skills đã đạt trên cert | `grep skill` trên trang cert = **0** |
| G11 | Ảnh badge LinkedIn | `/api/og?cert=<code>` → hiện 400 |
| G-arch | Ghi DB trong lúc render, không qua `resolve.ts`, self-service không tự kiểm membership | mọi prefetch đều cấp chứng nhận |
| G-revoke | **Chưa có action `revokeCertificate`** | `revoked_at` hiện không nơi nào ghi (UI thu hồi đã sẵn sàng từ đợt trước) |
| F16 | Nút Xoá badge không xác nhận | |
| D-perf | `findUserIdByEmail` duyệt **tới 20 trang × 200 user MỖI email**; lỗi Supabase → trả `null` ⇒ user đang tồn tại **âm thầm** thành "invite pending" | đúng điều đang xảy ra trên máy này |
| Sec | `/cert/` nên vào `robots.txt` disallow | |
| Sec | Rò rỉ journal/bình luận của thành viên ra trang share | `journal-section.tsx:48-57` đọc thẳng DB không lọc; **chưa dựng lại được** vì bảng đang 0 dòng — cần seed rồi kiểm |

---

## 3. Thứ tự đề xuất, có lý do

```
Đợt 1 (nối đường đứt)      ← rẻ nhất, mở khoá tính năng đã trả tiền xây
Đợt 2 (RBAC tới UI)        ← lỗi người dùng gặp mỗi ngày, gốc chỉ một chỗ
Đợt 3 (thời gian/thứ tự)   ← mọi con số đang sai; sửa trước khi làm đẹp
Đợt 6 phần chặn:
   C1.3 description        ← chặn A2 + E1.2
   E2.4c fork mất dữ liệu  ← mất dữ liệu thật
Đợt 4 (UI/UX, 4 mẻ)        ← làm đẹp trên nền số liệu đã đúng
Đợt 6 phần còn lại
Đợt 5 (RLS)                ← cuối cùng, có đường lùi
```

Ba lý do cho thứ tự này:
1. **Nối đường đứt trước khi thêm màn mới** — luồng đứt làm app "chưa dùng được"
   nhanh hơn là thiếu tính năng.
2. **Sửa số trước khi làm đẹp** — giao diện đẹp hiển thị con số sai thì tệ hơn
   giao diện xấu hiển thị số đúng.
3. **RLS cuối** — rủi ro cao nhất, và đợt B đã dựng sẵn đường lùi.

---

## 4. Bảng đối chiếu theo luồng (để không sót)

| Luồng | Đã vá đợt trước | Còn lại |
|---|---|---|
| **A — Viewer** | A13 rò rỉ private | A2 mô tả · A3b đếm cây sai · A4 nhãn + mobile cắt · A5 resource trên share · A11 dead-end sau đăng nhập · 15 mục UI/UX |
| **B — Learner** | B4.13 · B4.15 · B6.4 · B7.4 | B2.2 · B3.3 · B3.7 · B4.7 · B4.10 · B4.16 · B4.17 · B5.2/3/5/8 · B6.3 · B7.3 · RBAC-UI · i18n · ngày giờ |
| **C — Creator** | C2.2 · C3.2 · C4.2 · C4.5 · C5.1/5.2/5.3 | C1.2 slug · C1.3 mô tả · C2.4 est · C3.1 xoá field · C4.1 visibility · C5.4 `both` · C5.5 action · mobile chết · 14 mục UI/UX |
| **D — Admin** | D2.1 · D3.2/3.3/3.4/3.6 · D4.1/4.2 · D4.7 self-verify | D2.2 · D2.4 · D2.5 mail · D3.5 · D3.7 · D4.3/4.4/4.5/4.6 · 10 mục UI/UX |
| **E — Fork** | E2.3 · E2.4b · E3.1 · E3.3 | E1.1 filter chết · E1.2 mô tả + forkCount · **E2.4c mất lessons/exercises** · không transaction · 10 mục UI/UX |
| **F — Gamification** | F3 · F5 · F7 · F8 · F9 · F10 · F11 · F14 · F16 · F18 | F13 reset streak · F19 lệch múi giờ · badges route mồ côi · toast in tên icon · `use-gamification` code chết |
| **G — Certificate** | G8 · G9 · G10 · G12 mẫu số · QR localhost · thu hồi · in 1 trang | G1 · G2 · G5 · G7 · G11 · `revokeCertificate` · 3 vấn đề kiến trúc · 10 mục UI/UX |

---

## 5. Việc **phải hỏi**, không tự quyết

1. **Tầng tổ chức** — `organizations` + `org_members` + `workspaces.org_id` có
   schema, **0 dòng code dùng**. `PRODUCT_MINDSET.md` ghi rõ "không phải LMS
   doanh nghiệp" ⇒ bật lên là **đổi hướng sản phẩm**.
2. **Gửi mail invite** — cần dịch vụ mail ngoài (Supabase Auth? Resend?). Là
   quyết định hạ tầng + chi phí, không phải quyết định kỹ thuật.
3. **`workspaces.slug` sửa được** — URL công khai đã phát ra ngoài; đổi slug phải
   kèm bảng redirect, nếu không là **hỏng link người khác đã chia sẻ**.
4. **Visibility thứ ba** — "members-only" là gì cho đúng với sản phẩm cá nhân?
5. **White-label** (logo + màu tự do có kiểm contrast) — có làm không, hay 10 màu
   + 20 emoji là đủ cho canvas cá nhân?

---

## 6. Định nghĩa "xong"

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm guard && pnpm build` xanh.
2. DB **trắng** → `drizzle-kit migrate` → `pnpm db:seed` → test xanh.
3. RLS bật, chạy bằng role **không-superuser**, có test cross-tenant chứng minh.
4. 7/7 luồng **không còn mục ĐỨT**; mục SAI/THIẾU còn lại đều là **quyết định sản
   phẩm đã ghi rõ ở §5**, không phải nợ kỹ thuật.
5. e2e phủ cả desktop lẫn mobile, gồm phép đo tràn ngang.
6. Số đo 6 trục mới ghi vào `luannt-tets.md`, **kèm lệnh đã chạy**.
