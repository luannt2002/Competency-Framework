# Kế hoạch vá toàn bộ dự án — chốt 2026-08-21

> Mốc: commit `a08fe2c` + working tree **19 file sửa / 24 file mới chưa commit**.
> Mọi con số dưới đây đều đã chạy ra, không suy đoán.
> Kế thừa `PLAN.md` (đợt 1→7) — file này là bản gộp phần **còn lại**, xếp lại
> thứ tự theo rủi ro thật chứ không theo thứ tự đã lỡ đánh số.

---

## 0. Hiện trạng đo được (2026-08-21, Node 20.19.5)

| Trục | Lệnh đã chạy | Kết quả |
|---|---|---|
| typecheck | `pnpm typecheck` | ✅ xanh |
| lint | `pnpm lint` | ✅ 0 lỗi |
| unit test | `pnpm test` | ✅ **357/357**, 32 file |
| build production | `pnpm build` | ✅ xanh, 27 route |
| guard ×4 | `pnpm guard` | ❌ → ✅ (đã vá `dev/switch/page.tsx:74`) |
| RLS | `pg_class.relrowsecurity` | ❌ **0/50 bảng**, `pg_policies` = **0** |
| migration journal | `drizzle/migrations/meta/_journal.json` | ❌ **2 entry / 14 file .sql** |

**Kết luận trạng thái:** app **chạy được và build được**, nhưng **chưa dựng lại
được từ số 0** và **chưa cô lập tenant ở tầng DB**. Đó là hai lỗ thật, không
phải thiếu tính năng.

---

## 1. Hai phát hiện mới, đổi thứ tự ưu tiên

### 1.1 — Migration đã mất đường về (nặng nhất)

- `_journal.json` chỉ ghi **2** migration (`0000`, `0001`) trong khi thư mục có
  **14** file `.sql`. → `drizzle-kit migrate` sẽ **không** chạy 12 file còn lại.
- Đánh số khuyết `0007`, `0008`, `0009`; và có **HAI** file cùng số `0011`
  (`0011_resource_kinds_tool_lab.sql` + `0011_streak_badges.sql`) → thứ tự áp
  dụng không xác định.
- `db:setup` là `drizzle-kit push` (diff thẳng từ `schema.ts`) → **schema.ts là
  nguồn sự thật thật sự**, 14 file SQL chỉ còn là ghi chép cạnh đường.
- Hệ quả đã thấy: **`0016_rls_policies.sql` chưa từng chạy** (DB đo ra 0 policy).

Đây chính là cái bẫy "hai nguồn sự thật" mà `PLAN.md` mục 1.3 đã trả giá một lần.

### 1.2 — CI không chặn được đúng lỗi đã từng làm sập app

`.github/workflows/ci.yml` hiện có: typecheck, lint (**`|| echo` — cho phép
trượt**), guard, unit test. **Không có `pnpm build`. Không có e2e. Không có DB.**
Mà bug nguy hiểm nhất từng gặp lại đúng là *build fail* (`useSearchParams` không
bọc Suspense → app chưa từng deploy được). CI hiện tại sẽ để lọt y hệt lần nữa.

---

## 2. Luật vận hành (giữ nguyên, đã trả giá)

| Luật | Vì sao |
|---|---|
| Không viết số chưa chạy ra | mọi "N query", "X ms", "route 200" phải kèm lệnh thật |
| Bật DB trước khi kết luận app chậm | `docker start competency-postgres` |
| Đo perf trên production build | `next dev` compile on-demand, lệch 0.3s→13s |
| Node 20, không dùng node hệ thống 18 | `export PATH=~/.local/node20/bin:$PATH` |
| Gates xanh trước khi commit | `pnpm typecheck && pnpm lint && pnpm test && pnpm guard` |
| Mỗi agent một phạm vi hẹp, **không đè file nhau** | song song mà chung file = hỏng |
| Agent ghi nhiều file → worktree riêng | tránh giẫm chân giữa các mẻ |

---

## 3. Các đợt — thứ tự có lý do

### ĐỢT A — Chốt hiện trạng 7 luồng ⏳ *(đang chạy)*
7 agent rà lại A→G trên code hiện tại, vì `docs/audits/*` và `FLOW_STATUS.md` là
bản 2026-08-20, đã cũ hơn 4 commit + toàn bộ working tree. Ra bảng
ĐỦ/THIẾU/ĐỨT/SAI **thật**, kèm mục UI/UX riêng cho từng luồng.
→ Kết quả đợt này **quyết định nội dung đợt C**.

### ĐỢT B — Dựng lại được từ số 0 *(làm trước mọi thứ khác)*
Không sửa xong cái này thì mọi đợt sau đều xây trên nền không tái tạo được.

- **B1** Chốt một nguồn sự thật: `schema.ts` + `drizzle-kit push`, hay chuỗi
  migration. **Đề xuất: chuỗi migration**, vì RLS/policy/CHECK không diễn tả
  được bằng push.
- **B2** Đổi số hai file trùng `0011` → `0011`/`0012`, dồn lại liên tục, vá
  `_journal.json` đủ 14 entry.
- **B3** Chạy `drizzle-kit migrate` trên **DB trống mới** → so `pg_dump --schema-only`
  với DB hiện tại. Khác chỗ nào phải giải thích được từng chỗ.
- **B4** Ghi `docs/dev/DB_SETUP.md`: một lệnh dựng từ trắng đến seed.
- **Đo:** DB trống → `drizzle-kit migrate` → `pnpm db:seed` → `pnpm test` xanh.

### ✅ ĐỢT B — XONG 2026-08-21

| Lỗi tìm ra (đo thật) | Vá |
|---|---|
| `_journal.json` **2 entry / 14 file .sql** → `migrate` bỏ qua 12 file | journal dựng lại đủ **16 entry** |
| `drizzle.__drizzle_migrations` **không tồn tại** trong DB dev → `drizzle-kit migrate` chưa từng chạy lần nào | DB dựng mới ghi đủ 16 dòng |
| `node_type_appearance` có trong DB dev mà **không migration nào tạo** (chỉ `push` sinh ra) | `0017_node_type_appearance.sql` |
| **11 tên khoá ngoại lệch** (push sinh tên dài, migration khai tên ngắn) | `0018_align_push_drift.sql`, rename có điều kiện, idempotent hai chiều |
| **5 index mất `DESC` / `NULLS FIRST`** so với schema khai | `0018` dựng lại đúng thứ tự sắp |

**Chứng minh:** DB trắng → `drizzle-kit migrate` (16 migration) → `pnpm db:seed`
→ 50 bảng. `pg_dump --schema-only` hai bên, chuẩn hoá rồi `diff` = **rỗng**.
Bất biến được canh bằng `tests/unit/migration-journal.test.ts` (5 test).
Hướng dẫn: `docs/dev/DB_SETUP.md`.

`0016_rls_policies.sql` **cố tình đứng ngoài chuỗi** — xem đợt E.

---

### ✅ ĐỢT A — XONG 2026-08-21: rà lại 7/7 luồng trên code hiện tại

945 dòng bằng chứng trong `docs/audits/` — mỗi bước kèm `file:line` **và** lệnh
đã chạy (curl ẩn danh / psql / Playwright / giải mã QR so byte).

| Luồng | Bản 20/08 | Bản 21/08 (rà lại) |
|---|---|---|
| A — Viewer | 7 ĐỦ · 1 THIẾU · 0 ĐỨT · 3 SAI | **8 · 0 · 0 · 6** (tách thêm bước A13) |
| B — Learner | "đã vá 15/15" | **33 · 6 · 3 · 10** (phân rã 52 bước) |
| C — Creator | 15 · 3 · 0 · 5 | **16 · 3 · 0 · 5** |
| D — Admin | 6 · 10 · 1 · 6 | **13 · 6 · 1 · 3** |
| E — Fork | 11 · 0 · 1 · 4 | **11 · 0 · 0 · 5** |
| F — Gamification | 10 · 5 · 0 · 4 | **12 · 4 · 0 · 3** |
| G — Certificate | 5 · 5 · 0 · 2 | **5 · 3 · 0 · 4** |

**Bài học rút ra: "gates xanh" không đồng nghĩa "luồng chạy".** 362 unit test xanh
mà `deleteTreeNode`, `moveTreeNode`, `forkWorkspace` **không có một test nào chạm
tới** — đó là lý do ba lỗi P0 sống sót qua cả đợt 7.

Và bằng chứng kiểu "DB có dòng X" thì **hết hạn ngay khi reset DB** — nhiều
khẳng định của `FLOW_STATUS.md` không dựng lại được nữa.

---

### ĐỢT C — Vá ĐỨT/SAI/THIẾU của 7 luồng

#### ✅ C0 — ĐÃ VÁ + KIỂM CHỨNG RUNTIME: rò rỉ workspace private

**Ba agent rà độc lập (A13 · C4.5 · E) cùng dựng lại được, Flow B thấy thêm mặt thứ ba.**
`/share/<slug>` đã 404 đúng, nhưng hai bề mặt anh em thì không:

| Bề mặt | Trước | Sau |
|---|---|---|
| `/share/<private>` | 404 ✅ | 404 |
| `/share/<private>/n/<node>` | **200, 137 992 B, `<title>` lộ tên node + tên lộ trình** | **404** |
| `/api/og?slug=<private>` | **200 image/png 100 136 B, vẽ tên workspace** | **404** |
| `/share/<public>` · `/api/og?slug=<public>` | 200 | **200** (không hỏng) |

Vá: gom về một cửa `src/lib/share/guard.ts`
(`resolveShareableWorkspace` cho trang, `resolvePublicWorkspaceForCache` cho ảnh
OG — ảnh cache ở edge nên **cố ý không phụ thuộc người xem**, nếu không bản dựng
cho owner sẽ được phục vụ lại cho người lạ). Gate rải rác là gate sẽ bị bỏ sót ở
bề mặt tiếp theo.

Kiểm chứng: `next build` + `next start`, curl ẩn danh — số ở bảng trên là đo thật.

#### ✅ C1 — XONG 2026-08-22: đã vá cả 10 P0

Mỗi mục đều kiểm chứng bằng dữ liệu thật, không chỉ typecheck. Ba lỗi tầng SQL
(xoá node, đổi thứ tự, liên kết lesson↔node) được khoá bằng tầng test mới
`tests/integration/**` chạm Postgres thật — mock thì cả ba đều "xanh".

Chứng minh chạy được: `attempts` giữ nguyên 73 sau 3 lần render `/practice`
(trước: 71→73 sau 2 lần curl) · xoá node lá xoá đúng 1 dòng, xoá node cha xoá cả
cây con và chính nó · hoán đổi `order_index` chạy thật.

**Danh sách gốc (đã vá hết):**

| # | Lỗi | Bằng chứng đã chạy |
|---|---|---|
| 1 | **`deleteTreeNode` sai điều kiện subtree** — xoá lá = **0 dòng**; xoá cha = **mất con, giữ cha** (4→2). UI vẫn toast "Đã xoá" | `lib/tree/cascade.ts:18-26` |
| 2 | **`moveTreeNode` chết 100%** — `column "order_index" is of type integer but expression is of type text`. Ở biên còn toast **xanh dối** "Đã chuyển lên" | `tree-nodes.ts:432-439` |
| 3 | **Vòng lặp học ĐỨT** — `completeLesson` không ghi `user_node_progress`; xong bài xong rồi cây vẫn ○, dashboard vẫn 0% | `learn.ts:394-558` |
| 4 | **Tự đánh giá xoá mất `verified`** — `assessments.ts` ép `self_claimed` vô điều kiện + drawer tự lưu sau 700ms ⇒ sửa một chữ ghi chú là mất `both`/`verified` (và +30 XP đã trả) | `assessments.ts:59-67` |
| 5 | **`startLesson` ghi DB trong render GET** — attempts 71→73 sau đúng 2 lần curl; bảng đếm lượt **xem trang** chứ không phải lượt làm bài | `practice/page.tsx:91` |
| 6 | **Verify evidence chỉ tự duyệt cho mình** — `listEvidenceForSkill` lọc `userId = người xem`, và không chặn self-verify mà vẫn cộng +30 XP | `evidence.ts:233-264` |
| 7 | **QR chứng nhận in vĩnh viễn `localhost`** — `NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'`; thiếu env ở prod là mọi tờ giấy hỏng | `certificate/[memberId]/page.tsx:155` |
| 8 | **Hai mẫu số đá nhau** — cert đếm 164, share/dashboard đếm 166 ⇒ cùng người cùng lúc: cert "85%", share "84%" | `completion.ts` chưa dùng chung |
| 9 | **Cert đã thu hồi vẫn in được** — `/cert/<code>` trả 404 nhưng trang owner vẫn render đủ tờ + QR, không dấu hiệu gì | `cert/[id]/page.tsx` |
| 10 | **PDF chứng nhận ra 2 trang** — khổ A4 landscape đã đúng (`/MediaBox 841.9×594.9`), nhưng `visibility:hidden` giữ hộp layout ⇒ `scrollHeight 956px > 794px` | `certificate/[memberId]/page.tsx:182` |

#### C2 — P1 (ngõ cụt, sai quyền, sai thứ tự)

- **RBAC không tới UI**: learner thấy đủ nút Thêm con/Sửa/Xoá, bấm mới nhận
  `WORKSPACE_NOT_FOUND_OR_FORBIDDEN`. Gốc: hai resolver song song
  (`lib/workspace.ts` cứng ở LEARNER, `lib/rbac/resolve.ts`).
- **Hàng đợi chấm `/grading` không có lối vào** — trang chạy tốt, `grep "/grading"` trong `.tsx` = rỗng.
- **`/w/[slug]/badges` là route mồ côi** — tính năng F16 vừa dựng, không `href` nào trỏ tới.
- **Sidebar EDITOR dẫn vào NEXT_REDIRECT** (Members/Audit) — và unit test đang **khoá chặt cái sai**.
- **Bulk CSV chặn email ở client** dù server đã nhận email (D2.2 ĐỨT).
- **Hai định nghĩa "hôm nay"** — planner + "XP today" cắt theo UTC, streak cắt theo VN ⇒ lệch 7 tiếng mỗi ngày.
- **Số đếm cây sai** — share hiện "48 mục" trong khi đệ quy cho 159 (`full-tree.ts` giả định "con sau cha").
- **Fork mất lessons/exercises** (0/59, 0/75) và **không có transaction**.
- **F3 mất XP im lặng** — `completeLesson` tự insert +5 thay vì gọi `awardStreakTick` ⇒ mốc 7/30 ngày mất bonus 50/300.
- **F7 không có gate 0 tim** — hết tim vẫn học bình thường; 3 mặt trả 3 số khác nhau.

#### ✅ C3 — XONG: hearts đủ spec F7/F8/F9/F11 (migration 0019)

`current` → `numeric(3,1)` (F9 nửa tim) · `decayed_through` (F8 tính lười,
idempotent — chạy lại trong ngày không trừ chồng) · `heart_grants` unique index
(F11 chống cấp trùng) · F7 hết tim chặn nộp bài. Kèm 13 unit test cho phép tính
hao và 8 integration test chạm DB.

Ghi chú cũ (giữ lại vì đúng):

Lưu ý từ agent rà F, ghi lại để không mất: hiện `hearts.current` là `integer` nên
F9 (−0.5) cần đổi kiểu; và tim đang là "chiếc xô luôn đầy" nên F11 (+1) không có
tác dụng nếu chưa có F8 làm nó vơi. Ba mục phải làm **cùng một mẻ**, không tách.

#### C4 — Việc còn nợ từ `PLAN.md`

| Mã | Việc | Ghi chú |
|---|---|---|
| 7.16 | F8 decay / F9 skip / F11 replay-earn hearts | **cần quyết định game-design trước** |
| 7.17 | D3.6/D3.7 export theo member · D4.x drill-down | commit `783caaa` tuyên bố xong — đợt A xác minh |
| 7.18 | C5 analytics · F16 custom badge · A3 share full tree | phần lớn nằm ở working tree chưa commit |
| 4.3 | `lesson_skill_map` — bảng nghiệp vụ duy nhất không có `workspace_id` | xác minh luôn join qua bảng đã scoped |
| 5.4 | Nới enum `evidence_kind`/`export_format`/`daily_task_kind` | `0013_widen_rigid_enums.sql` đã viết, **chưa chạy** |

Cách làm: **một agent một luồng**, vá đúng phạm vi luồng đó, chạy gates trước khi trả.

### ĐỢT D — UI/UX + FE *(phần bạn nhấn mạnh — tách 4 mẻ không đè file)*

Đo được, không cảm tính:

| Mẻ | Việc | Bằng chứng đã đo |
|---|---|---|
| **D1 — Dọn hệ thiết kế** | Xoá 9 class CSS chết; xoá `backgroundImage['accent-gradient']` (hardcode cyan→tím, lệch brand blue→đỏ, 0 nơi dùng); gỡ 17 dependency 0 import | `card-brand`, `section-title`, `badge-brand-*`×3, `nav-item-brand-active`, `brand-dot`, `surface-hover`, `section-numbered` = 0 lượt dùng |
| **D2 — Primitive còn thiếu** | Dựng `select`, `dropdown-menu`, `tabs`, `popover`, `label`, `separator` trên Radix **đã cài sẵn**; thay **13 thẻ `<select>` thô** | 10 gói Radix cài mà **0 file import** |
| **D3 — Vỏ route** | Thêm `loading.tsx` / `error.tsx` cho các route còn thiếu + `global-error.tsx` | 27 page nhưng chỉ **4** `loading.tsx`, **2** `error.tsx`, **0** `global-error.tsx` |
| **D4 — Responsive + a11y** | Quét từng màn theo mục "UI/UX & FE" của đợt A: bảng tràn ngang ở mobile, focus ring, aria trên nút icon, trạng thái empty/error, chữ Việt/Anh lẫn | 13 chỗ `overflow-x-auto` — phải xác minh đủ hay không |

**Ràng buộc bắt buộc cho mọi mẻ FE:** không thêm màu tự chế (`guard:no-adhoc-color`
chặn), không hardcode dữ liệu nghiệp vụ vào `src/components`/`src/app`
(`guard:no-hardcode` chặn), giữ hệ `--hue-1..5` làm thang phân loại duy nhất.

*Điểm tốt phải giữ, đừng phá:* hệ màu semantic + guard màu đang **sạch thật**;
33 file đã dùng `useTransition` nên form có trạng thái chờ đầy đủ.

### ĐỢT E — RLS thật (rủi ro cao, làm sau khi đợt B xong)
`0016_rls_policies.sql` đã viết nhưng **chưa chạy, và chạy suông cũng vô nghĩa**:
app nối DB bằng user `postgres` (superuser) → **RLS bị bỏ qua hoàn toàn**.
Phải làm đủ 4 bước, thiếu bước nào là diễn:
1. Tạo role **không-superuser**, cấp quyền tối thiểu.
2. Đổi `DATABASE_URL` sang role đó.
3. Set GUC theo **từng transaction** (`set_config('app.workspace_id', …, true)`).
4. Test chứng minh: cùng một query, hai workspace, **role thường** → 0 rò rỉ.
Có đường lùi: giữ `DATABASE_URL` cũ để rollback.

### ĐỢT F — CI chặn đúng thứ đã từng sập
- Bỏ `|| echo` ở lint (đang cho phép trượt).
- Thêm `pnpm build` — chính là gate đã từng cứu app khỏi "không deploy được".
- Thêm service Postgres + `drizzle-kit migrate` + seed → chạy được e2e.
- Thêm Playwright: hiện chỉ có **2 spec** và **1 project chromium desktop** →
  thêm project mobile viewport để responsive có người gác.
- Vá `smoke.spec.ts` (kỳ vọng `h1` tiếng Anh, thực tế tiếng Việt — đỏ sẵn từ trước).

### ĐỢT G — White-label (5.2) + đo lại 6 trục (6.3)
- Logo + tên thương hiệu + màu tự do **có kiểm contrast server-side**, thay cho
  10 màu / 20 emoji cứng.
- Đo lại 6 trục của `cf-upgrade`, ghi số mới vào `luannt-tets.md`.

---

## 3b. QUYẾT ĐỊNH ĐÃ CHỐT (2026-08-21, user)

| # | Quyết định | Ảnh hưởng |
|---|---|---|
| 1 | **Nguồn sự thật DB = chuỗi migration** | Đợt B dồn số 14 file, vá `_journal.json`, từ nay chỉ `drizzle-kit migrate`. `push` chỉ còn dùng cho lab nháp. Mở đường cho RLS ở đợt E. |
| 2 | **Hearts: làm đủ F8 + F9 + F11 đúng spec** | Không cắt gọt game design. Decay mỗi ngày bỏ học, skip -0.5, ôn bài cũ +1. Đợt C nhận thêm mục này. |
| 3 | **Chạy ngầm hết B→G, ping tiến độ** | Chỉ dừng ở §4. |
| 4 | **Runtime test all** | Mỗi đợt phải chứng minh bằng app CHẠY THẬT (curl/psql/Playwright trên bản production), không chỉ unit test. |

---

## 4. Việc **phải hỏi**, không tự quyết

1. **Tầng tổ chức (5.1)** — `organizations`/`org_members` có schema, **0 dòng
   code dùng**. Nhưng `PRODUCT_MINDSET.md` ghi rõ "không phải LMS doanh nghiệp".
   → Bật lên là đổi hướng sản phẩm.
2. ~~Hearts phạt (F8/F9/F11)~~ — ✅ đã chốt: **làm đủ cả 3 như spec**.
3. **Push lên GitHub** — hành động ra ngoài máy.
4. ~~Nguồn sự thật DB (B1)~~ — ✅ đã chốt: **chuỗi migration**.

---

## 5. Phân agent — mỗi agent một phạm vi, không đè file

| Agent | Phạm vi | Đợt |
|---|---|---|
| `cf-flow-auditor` ×7 | mỗi agent 1 luồng A→G | A ⏳ |
| agent hạ tầng DB | `drizzle/**` + `docs/dev/DB_SETUP.md` | B |
| `cf-flow-auditor` ×N | vá theo luồng, mỗi agent 1 luồng | C |
| `fe-ui-designer` ×4 | D1/D2/D3/D4, khác thư mục nhau | D |
| agent RLS | `drizzle/migrations/0016*` + `src/lib/db/**` | E |
| agent CI | `.github/workflows/**` + `tests/e2e/**` | F |

---

## 6. Định nghĩa "xong" của cả kế hoạch

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm guard && pnpm build` xanh.
2. DB **trống** → migrate → seed → test xanh (dựng lại được từ số 0).
3. RLS bật, chạy bằng role **không-superuser**, có test cross-tenant chứng minh.
4. 7/7 luồng không còn mục ĐỨT; mục SAI/THIẾU còn lại đều là **quyết định sản
   phẩm đã ghi rõ**, không phải nợ kỹ thuật.
5. CI chặn được cả build lẫn e2e, có viewport mobile.
6. Số đo 6 trục mới ghi vào `luannt-tets.md`, kèm lệnh đã chạy.


---

## 7. Trạng thái sau đợt 2026-08-22

**Đã xong:** đợt A (rà 7/7 luồng) · đợt B (dựng lại từ số 0) · đợt C0 (bảo mật) ·
C1 (10 P0) · C3 (hearts) · đợt F (CI + e2e mobile).

**Gates cuối:** typecheck ✓ · lint 0 ✓ · **test 399/399** (37 file, thêm tầng
integration) ✓ · guard ×4 ✓ · build production ✓ · **e2e 12/12** desktop+mobile ✓ ·
DB trắng dựng lại khớp schema 100%.

**Còn lại, theo thứ tự nên làm:**

1. **C2 — nhóm P1**: RBAC không tới UI (learner thấy nút Sửa/Xoá rồi mới bị
   chặn) · `/grading` và `/w/[slug]/badges` không có lối vào · sidebar EDITOR dẫn
   vào NEXT_REDIRECT (và unit test đang khoá chặt cái sai) · bulk CSV chặn email
   ở client · hai định nghĩa "hôm nay" lệch 7 tiếng · số đếm cây sai (48 vs 159) ·
   fork mất lessons/exercises + thiếu transaction.
2. **Đợt D — UI/UX + FE**, 4 mẻ đã mô tả ở §3. Số đo còn nguyên giá trị:
   17 dependency 0 import · 13 thẻ `<select>` thô · 27 page mà chỉ 4 `loading.tsx` /
   2 `error.tsx` / 0 `global-error.tsx` · 9 class CSS chết · **33 font stack inline
   kết thúc bằng `sans-serif` trần** (thiếu `var(--font-emoji)` → emoji tofu, đúng
   lỗi `globals.css` đã vá mà inline style thì chưa) · trang sign-in 100% tiếng Anh
   giữa app tiếng Việt, ngay tại điểm chuyển đổi.
3. **Đợt E — RLS**: `0016_rls_policies.sql` vẫn CÁCH LY có chủ đích. Điều kiện đã
   sẵn sàng một nửa (role `competency_app` không superuser, bảng thuộc `postgres`
   nên policy sẽ có tác dụng thật), nhưng `withWorkspace()` hiện là hàm rỗng —
   chưa chạy `SET LOCAL app.workspace_id`. Áp 0016 trước khi làm việc đó = mọi
   query trả rỗng = app chết. Test `migration-journal` đang canh đúng chỗ này.
4. **Đợt G** — white-label + đo lại 6 trục.
