# FLOW G — Certificate (rà lại 2026-08-21)

Mốc: `a08fe2c` + working tree (chưa commit).
Đặc tả: `USER_FLOWS.md:503-526`.
Bản rà cũ (2026-08-20): 5 ĐỦ · 5 THIẾU · 0 ĐỨT · 2 SAI.

**Bước: 5 ĐỦ · 3 THIẾU · 0 ĐỨT · 4 SAI**

## Hạ tầng đã chạy để lấy bằng chứng

| Việc | Cách chạy |
|---|---|
| DB | `docker exec competency-postgres psql -U postgres -d competency` |
| App | dev server Node 20, `NEXT_DIST_DIR=.next-auditg` cổng 3105 (+ cổng 3100 của phiên khác), cookie `dev_bypass_user=77b020ab-…dde7` |
| Dữ liệu thử | seed 140/164 node `done` cho owner `devops-test` → chạy flow → **đã xoá sạch** (`certificates` 0 dòng, `user_node_progress` khôi phục về 1 dòng seed gốc) |
| In/PDF | Playwright 1.59.1 + Chromium 1217 → `page.pdf({preferCSSPageSize:true})`, đo `/MediaBox` + `pdftotext` từng trang |
| QR | giải mã bằng cách sinh lại deterministic với chính `qrcode@1.5.4` rồi so byte + đối chứng mã sai |

---

## Checklist G1→G12

```
<mã bước> | <trạng thái> | <file:line> | <bằng chứng đã chạy> | <đề xuất vá>
```

---

**G1 · Notification "Bạn đủ điều kiện nhận Certificate" khi ≥80%** | **THIẾU** | `application/src/lib/db/schema-social.ts:112` (kind `'milestone.completed'` khai báo) · `application/src/actions/tree-nodes.ts:468-545` (`toggleNodeDone` — nơi lẽ ra phải bắn) | `grep -rn "milestone.completed" src/` → chỉ 1 hit là dòng khai báo, KHÔNG có `insert(notifications)` nào dùng kind này. Toàn repo chỉ 3 chỗ ghi notification: `follows.ts:94` (`follow.new`), `comments.ts:149` (`comment.reply`), `learn.ts:631` (`attempt.graded`). DB thật: `select kind, count(*) from notifications group by 1` → chỉ `attempt.graded | 20`. | Trong `toggleNodeDone`, sau `awardNodeCompletion` (`tree-nodes.ts:535`): tính lại pct toàn workspace, nếu vừa **vượt ngưỡng** (pct_trước < 80 ≤ pct_sau) thì `insert(notifications)` kind `milestone.completed`, `resourceType:'workspace'`, link `/w/<slug>/certificate/<userId>`. Bọc `try/catch` như `learn.ts:628-644` để lỗi notification không rollback việc mark-done. Chống lặp: kiểm tra đã tồn tại row `certificates` hoặc notification cùng kind+workspace trước khi chèn.

---

**G2 · Route `/w/[slug]/certificate`** | **SAI** (lệch path so hợp đồng) | `application/src/app/(app)/w/[slug]/certificate/[memberId]/page.tsx:44-52` | `curl /w/devops-test/certificate` (có cookie owner) → **HTTP 404**. Chỉ `/w/devops-test/certificate/<uuid>` → 200. Spec `USER_FLOWS.md:508` ghi `→ /w/[slug]/certificate`. Lối vào thật đang có: `w/[slug]/page.tsx:122-130` (hiện khi `overallPct >= 80`) và `members/page.tsx:186,237`. | Thêm `application/src/app/(app)/w/[slug]/certificate/page.tsx` chỉ làm 1 việc: `redirect('/w/'+slug+'/certificate/'+user.id)`. Rẻ, và làm cho link trong notification G1 dùng được path đúng spec.

Ba vấn đề kiến trúc cùng nằm ở file này, không thuộc riêng bước nào (không tính vào tally):
- `certificate/[memberId]/page.tsx:54-104` truy cập workspace bằng `db.select().from(workspaces)` + `requireMinLevel` tự gọi, **không đi qua `application/src/lib/rbac/resolve.ts`** (`resolveWorkspace`) như luật kiến trúc.
- `:78-81` nhánh self-service (`memberId === currentUser.id`) **không kiểm tra membership**. Hiện tại chỉ layout chặn: `curl` với user lạ vào workspace private → 500 `WORKSPACE_NOT_FOUND_OR_FORBIDDEN` ném từ `w/[slug]/layout.tsx:25` → `lib/workspace.ts:59`. Trang tự nó không có phòng tuyến nào. Vá: thêm `await resolveWorkspace(slug, RBAC_LEVELS.LEARNER)` ở đầu page.
- `:139-151` **GHI DB trong lúc render** (`issueCertificate`). Mọi prefetch/crawl trang này đều cấp chứng nhận. Vá: chuyển thành server action `issueMyCertificate()` gọi từ nút bấm, hoặc ít nhất `export const dynamic='force-dynamic'` + chỉ upsert khi có `?issue=1`.

---

**G3 · Tên người học trên cert (thay UUID)** | **ĐỦ** (code đúng — chưa kiểm chứng được đầu ra tên thật) | `application/src/app/(app)/w/[slug]/certificate/[memberId]/page.tsx:168` → `application/src/lib/auth/user-display.ts:59-76`; bản public `user-display.ts:94-105` dùng ở `application/src/app/cert/[id]/page.tsx:73` | Trang render ra `77b0…dde7` chứ **không** phải tên thật. Nguyên nhân đã truy: `.env.local` có `NEXT_PUBLIC_SUPABASE_URL=placeholder.supabase.co`; `curl https://placeholder.supabase.co/auth/v1/health` → exit 6 (không phân giải được host); Playwright bắt được console server `Error: fetch failed` trên cả 2 trang cert. Nghĩa là `getUserDisplay` luôn rơi vào `fallback = shortId(id)` ở `:63,65,69,73`. **Không có Supabase thật thì không thể chứng minh tên thật hiện lên** — chỉ chứng minh được đường dẫn code và fallback không làm vỡ trang. | Không phải bug logic, nhưng 2 điểm nên vá: (1) `user-display.ts:63-75` — nhánh fallback **không** `cache.set`, nên mỗi lần render lại gọi lại Admin API và lại timeout; roster 30 người = 30 round-trip hỏng mỗi render. Cache cả fallback với TTL ngắn (30–60s). (2) log 1 lần bằng `console.warn` kèm lý do thay vì để `fetch failed` trần trong console server.

---

**G4 · Tên lộ trình** | **ĐỦ** | `certificate/[memberId]/page.tsx:248` (`workspaceName={ws.name}`) → render `:397-401` | `pdftotext` trang 1 của PDF in ra: `Đã hoàn thành lộ trình DevOps Mastery 2026 với tỉ lệ 85% (140 / 164 nội dung).` Tên lấy từ `workspaces.name` trong DB. | —

---

**G5 · Ngày hoàn thành** | **SAI** | `application/src/lib/db/certificates.ts:88` (`issuedAt: new Date()`), `certificate/[memberId]/page.tsx:139-151`, render `:410` | Cột `issued_at` **đã được lưu thật** (tiến bộ so bản rà cũ): sau khi mở trang, `select issued_at from certificates` → `2026-08-21 16:19:27.56+00`, mở lại lần 2 giá trị **không đổi** (`certificates.ts:58-75` giữ nguyên `issuedAt` + `uniqueCode`). NHƯNG đó là **thời điểm MỞ TRANG lần đầu**, không phải ngày hoàn thành. Tôi seed 140 node `done` lúc 16:1x rồi mở trang ngay nên hai mốc trùng nhau — không có nghĩa là code đúng: học viên đạt 80% từ tháng 3 mà tháng 8 mới bấm xem thì cert vẫn ghi tháng 8. Nhãn trên tờ cert cũng là `"Ngày cấp"` (`:410`) chứ không phải "Ngày hoàn thành" như spec `USER_FLOWS.md:513`. | Cột `user_node_progress.completed_at` đã có sẵn (đã `\d user_node_progress` xác nhận) và hiện **không nơi nào đọc**. Vá: trong `certificate/[memberId]/page.tsx:117-130` lấy thêm `max(completed_at)` của các node `done` trong `descendantIds`; truyền vào `issueCertificate` như `completedAt`; thêm cột `completed_at` vào bảng `certificates` (migration mới); tờ cert in **2 dòng**: "Ngày hoàn thành" (= max completed_at) và "Ngày cấp" (= issued_at).

---

**G6 · % hoàn thành + gate ≥80%** | **ĐỦ** | `certificate/[memberId]/page.tsx:108-134` (đếm), `:141` (gate cấp), `:222` (gate render) | Chạy 2 chiều: (a) 140/164 = 85% → render tờ cert + nút in + QR, và tạo đúng 1 dòng `certificates(pct=85, done_count=140, total_nodes=164)`; (b) xoá hết progress → cùng URL trả về thẻ `"Chưa đủ điều kiện"`, `0%`, `(0 / 164 nodes done)`, **không** có nút in, **không** có QR, và `select count(*) from certificates` = **0** (không cấp nhầm). | — (nhưng đọc mục G12 về mẫu số 164 vs 166).

---

**G7 · Danh sách skills đã đạt trên cert** | **THIẾU** | `certificate/[memberId]/page.tsx` — `grep -n "skill"` trên cả file → **0 hit** | Tờ cert in ra (`pdftotext` trang 1) chỉ có: tiêu đề, tên người, tên lộ trình + %, ngày cấp, QR + mã, "Workspace owner". Không có dòng skill nào. Spec `USER_FLOWS.md:515` yêu cầu "Danh sách skills đã đạt". | Bảng `user_skill_progress` đã có sẵn (`application/src/lib/db/schema.ts:169-190`: `workspaceId, userId, skillId, levelCode, levelSource, crowns`) cùng `skills:132` và `competency_levels:150`. Vá: trong page, join `user_skill_progress × skills × competency_levels` lọc `workspaceId + userId` và `levelCode` ≥ ngưỡng (hoặc `crowns > 0`), lấy tối đa ~8 skill, render thành hàng chip dưới dòng "%" trên tờ A4 (còn khoảng trống ở `:401-411`), và thêm cùng danh sách vào `/cert/[id]` để nhà tuyển dụng đọc được.

---

**G8 · QR code verify** | **ĐỦ** (có lệch spec, xem ghi chú) | `certificate/[memberId]/page.tsx:153-165` (sinh SVG server-side), `:413-449` (chèn vào tờ A4) · `qrcode@1.5.4` có trong `package.json:66` và `node_modules` | **Đã giải mã thật, không đoán**: trích SVG nhúng trong HTML render ra, rồi sinh lại bằng chính `qrcode` với đúng option (`type:'svg', margin:0, errorCorrectionLevel:'M', color.dark:'#3a2a1c'`) cho chuỗi `http://localhost:3000/cert/2B7D1QKEEA` → **so byte: IDENTICAL = true**. Đối chứng với mã sai (`/cert/XXXXXXXXXX`) → `false`. Vậy QR **thực sự** mã hoá đúng URL xác thực. | Ghi chú lệch spec: `USER_FLOWS.md:516` ghi QR trỏ về `/share/[slug]`; code trỏ về `/cert/<code>` rồi mới bắc cầu sang `/share` — thiết kế này **tốt hơn** spec (không lộ workspace private), nên giữ, nhưng nên sửa lại 1 dòng trong `USER_FLOWS.md` cho khớp hợp đồng. **Vá thật sự cần làm — mức nặng**: `:155` `const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'`. QR được **in ra giấy**, không sửa lại được. Nếu prod thiếu env này thì mọi tờ chứng nhận vĩnh viễn trỏ về localhost. Vá: bỏ fallback, `throw` (hoặc ẩn QR + hiện cảnh báo cho owner) khi thiếu `NEXT_PUBLIC_APP_URL`.

---

**G9 · Export PDF đẹp (A4 landscape)** | **SAI** (khổ giấy đã đúng, nhưng in ra **2 trang**, trang 2 trắng) | `certificate/[memberId]/page.tsx:177-195` (CSS in), `:179` (`@page { size: A4 landscape; margin: 0 }`), `:288-297` (tờ 297mm × 210mm) | Đo bằng Playwright/Chromium: <br>· `@page` **có** được parse (quét đệ quy `document.styleSheets` → `@page { size: a4 landscape; margin: 0px; }`, nằm lồng trong `@media print` của `<style>` trong body — hợp lệ). <br>· `page.pdf({preferCSSPageSize:true})` → `/MediaBox [0 0 841.91998 594.95996]` = **841.92×594.96pt = 297×210mm = A4 landscape ✓** (bản rà cũ nói portrait — đã vá xong). <br>· **NHƯNG số trang = 2**. `pdftotext -f 1 -l 1` cho ra đủ nội dung cert; `pdftotext -f 2 -l 2` cho ra **1 byte** → trang 2 hoàn toàn trắng. <br>· Truy nguyên nhân bằng số: ở `media: print`, `document.body.scrollHeight = 956px`, trong khi 1 trang A4 landscape = `210mm ≈ 794px`. Dư 162px → tràn sang trang 2. <br>· Đối chứng: trang tối giản `<style>@page{size:A4 landscape;margin:0}html,body{margin:0}</style><div style="width:297mm;height:210mm">` → **1 trang**. Thử cả 296mm và 209mm → vẫn 1 trang. Vậy lỗi **không** phải làm tròn mm, mà là chiều cao document còn dư. <br>· Gốc rễ: `:182` dùng `body * { visibility: hidden !important }` — `visibility:hidden` **giữ nguyên hộp layout**, nên vỏ app (`min-h-dvh` ở `:172`, `py-10` ở `:221`, `flex min-h-dvh` của `w/[slug]/layout.tsx:63`) vẫn chiếm chỗ. | Trong khối `@media print` thêm: `html, body { width: 297mm !important; height: 210mm !important; margin: 0 !important; overflow: hidden !important; }` và cho wrapper `:221` `padding: 0 !important`. Kiểm lại bằng đúng lệnh Playwright ở trên: phải ra **1 trang**. Dọn kèm: class `print-host` (`:172`) không có luật CSS nào tương ứng — hoặc dùng, hoặc xoá.

---

**G10 · Share link online `/cert/[unique-id]`** | **ĐỦ** | `application/src/app/cert/[id]/page.tsx:36-79`; noindex `:31-34`; revoke→404 `:61`; link `/share` có điều kiện `:78,136-144` · `application/src/lib/db/schema-certificates.ts` · `application/drizzle/migrations/0012_certificates.sql` · `application/src/lib/db/certificates.ts:21-28` | Bảng có thật trong DB đang chạy: `\d certificates` → 9 cột, 2 unique index (`certificates_unique_code_uq`, `certificates_workspace_subject_uq`), FK `workspace_id → workspaces(id) ON DELETE CASCADE`. <br>Chạy 4 nhánh: <br>· mã thật `/cert/2B7D1QKEEA` → **200**, hiện đúng `2B7D1QKEEA`, `85% (140 / 164 nội dung)`, `21/08/2026`. <br>· mã bịa `/cert/ZZZZZZZZZZ` → **404**. <br>· `update certificates set revoked_at=now()` → cùng URL → **404**; set lại `null` → **200**. <br>· `<meta name="robots" content="noindex, nofollow">` **có** trong HTML trả về. <br>· workspace `public-readonly` → có nút "Xem lộ trình công khai" (`href=/share/devops-test`); đổi sang `private` → nút **biến mất** (grep = 0), rồi khôi phục lại `public-readonly`. <br>Sinh mã: `bytes[i] % 32` với 256 là bội số của 32 → **không lệch phân phối**; 10 ký tự × 5 bit = 50 bit đúng như comment. Test `tests/unit/cert-code.test.ts` phủ độ dài/bảng chữ/5000 mẫu không trùng. | Ghi chú, không chặn: `application/src/app/robots.ts:20-28` cho phép crawl `/` và **không** disallow `/cert/` — trang tự noindex nên không bị index, nhưng nên thêm `/cert/` vào `disallow` để crawler khỏi kéo mã bí mật vào log/referrer. Và: migration `0016_rls_policies.sql` (chưa commit) bật RLS cho `certificates` nhưng **chưa chạy vào DB** — `select relrowsecurity from pg_class where relname='certificates'` → `f`, `pg_policies` → 0 dòng.

---

**G11 · Badge image paste lên LinkedIn/Twitter** | **THIẾU** | không có file nào; `application/src/app/api/og/route.tsx:38-46` chỉ nhận `slug`/`node` | `grep -rn -i "linkedin\|badge-image\|opengraph-image" src/` → chỉ 2 hit là comment trong `api/og/route.tsx` nói về `/share/[slug]`. `curl "/api/og?cert=2B7D1QKEEA"` → **400 "Missing slug"**. Không có endpoint nào sinh ảnh chứng nhận. | Tái dùng đúng hạ tầng đã có: mở rộng `api/og/route.tsx` nhận `?cert=<code>` → tra `certificates` theo `unique_code` (bỏ qua khi `revoked_at` không null) → `ImageResponse` 1200×630 gồm tên người, tên lộ trình, %, ngày cấp, mã. Rồi trên `/cert/[id]` thêm `openGraph.images` trỏ tới nó + nút "Tải ảnh badge". Lưu ý giữ nguyên `robots: noindex` của trang.

---

**G12 · Employer click link → thấy progress thực tế, không fake được** | **SAI** (dữ liệu thật nhưng **hai con số mâu thuẫn**) | `application/src/app/cert/[id]/page.tsx:118-123` (85%) vs `application/src/app/share/[slug]/page.tsx:144-160` (84%) vs `application/src/app/(app)/w/[slug]/page.tsx:62-65,87` | Cùng một người, cùng một lúc, đo thật: <br>· `/cert/2B7D1QKEEA` → **"85% (140 / 164 nội dung)"** <br>· `/share/devops-test` (đúng cái link mà chính trang cert mời employer bấm sang) → **"84%"** <br>Nguyên nhân là **hai mẫu số khác nhau**: cert đếm `path_str IS NOT NULL AND path_str <> ''` = **164** node hậu duệ (`certificate/[memberId]/page.tsx:112-114`); share và dashboard đếm `count()` toàn bộ `roadmap_tree_nodes` = **166** (DB: `desc_nodes=164, total=166`). 140/164 = 85%, 140/166 = 84%. <br>Hệ quả 2 (đã kiểm): cổng vào ở `w/[slug]/page.tsx:122` dùng mẫu số **166**, còn trang cert phán quyết bằng **164** → có dải % mà nút "Chứng nhận của tôi" không hiện nhưng trang cert lại nói đủ điều kiện. <br>Hệ quả 3 (đã kiểm): khi `revoked_at` khác null, `/cert/<code>` trả 404 nhưng trang owner `/w/…/certificate/<id>` **vẫn render đủ tờ cert + QR**, mã `2B7D1QKEEA` vẫn xuất hiện 3 lần trong HTML, **không có bất kỳ dấu hiệu "đã thu hồi"** → owner in ra tờ giấy có QR dẫn tới 404. | (1) Đưa phép đếm về **một chỗ**: thêm hàm dùng chung (ví dụ `application/src/lib/tree/completion.ts`, đang có sẵn `completionPct`) trả `{done, total}` theo đúng một định nghĩa mẫu số, rồi cả `cert`, `share`, dashboard, roster đều gọi nó. Nếu chốt mẫu số là "node hậu duệ" thì sửa cả `share/[slug]/page.tsx:146-148` và `w/[slug]/page.tsx:62-65`. (2) Trang cert đọc thêm `revokedAt` từ `issueCertificate` và khi khác null thì ẩn QR + nút in, hiện băng đỏ "Chứng nhận đã bị thu hồi". (3) Cột `revoked_at` hiện **không có nơi nào ghi** (`grep revokedAt src/` chỉ ra 2 dòng đọc ở `cert/[id]/page.tsx:53,61`) — cần 1 server action `revokeCertificate` cho OWNER, nếu không thu hồi chỉ làm được bằng SQL tay.

---

## UI/UX & FE

- `application/src/app/(app)/w/[slug]/certificate/[memberId]/page.tsx:288-297` + `:221` | **Vỡ layout ở mobile/tablet.** Tờ cert đặt `width:297mm` nhưng là flex item với `flex-shrink:1` mặc định. Đo thật: viewport 375px → hộp co còn **375×794** (đúng tỉ lệ phải là 1123×794), viewport 768px → **528×794**. Trang **không** bị cuộn ngang (`scrollWidth == clientWidth == 375`) nhưng nội dung bên trong vẫn dùng đơn vị mm cố định nên bị bóp: ruy-băng "CHỨNG NHẬN HOÀN THÀNH" xuống 2 dòng tràn khỏi viên pill, QR bị đẩy khỏi vùng nhìn (ảnh chụp đã lưu). | Bọc tờ cert trong `<div class="overflow-x-auto">` và cho tờ `flex-shrink:0`, **hoặc** ở màn hẹp scale bằng `transform: scale(var(--k))` với `transform-origin: top left` giữ nguyên tỉ lệ 297:210. Đừng để nó co tự do.
- `application/src/app/(app)/w/[slug]/certificate/[memberId]/page.tsx:421-425` | **a11y: QR không có nhãn.** Đo trong DOM: `div.cert-qr` chỉ có `class` + `style`, **không** `role`, **không** `aria-label`; `<svg>` chèn qua `dangerouslySetInnerHTML` chỉ có `xmlns/viewBox/shape-rendering`, **không có `<title>`**. Screen reader không đọc được gì; chỉ còn chữ "Quét để xác thực" bên dưới. | Thêm `role="img"` + `aria-label={"QR xác thực chứng nhận, mã " + certCode}` cho `div.cert-qr` (hoặc `aria-hidden` cho SVG và để text cạnh đó gánh nghĩa).
- `application/src/app/(app)/w/[slug]/certificate/[memberId]/page.tsx:222-245` | **Dead-end ở trạng thái chưa đủ điều kiện.** Thẻ "Chưa đủ điều kiện" (đã render thật, HTTP 200) không có một link/CTA nào: không "Về lộ trình", không "Xem còn thiếu bước nào". Người dùng chỉ còn sidebar. | Thêm nút `→ /w/<slug>` và `→ /w/<slug>/daily`, kèm câu "còn N mục nữa" (đã có sẵn `doneCount`/`total` ngay trên).
- `application/src/app/cert/[id]/page.tsx:80-85,136-144` | **Dead-end ở trang public khi workspace private.** Đã đo: đổi `devops-test` sang `private` → `/cert/<code>` vẫn 200 nhưng `grep href` ra **0 link** trên toàn trang. Employer xem xong không đi đâu được, cũng không có đường về trang chủ sản phẩm. | Luôn có 1 link trung tính cuối trang (logo/"Competency Framework" → `/`), độc lập với `isPublic`.
- `application/src/app/cert/[id]/page.tsx:81` | **Thiếu landmark.** Trang public dùng `<div>` gốc, không có `<main>`; không có skip-link (khác `w/[slug]/layout.tsx:70-75` vốn có). | Đổi `<div>` ngoài cùng thành `<main>`.
- Lẫn Việt/Anh trên đúng luồng G | `certificate/[memberId]/page.tsx:214` `"Print / Save as PDF"` · `:234` `"({doneCount} / {total} nodes done)"` (đã thấy render thật: `(0 / 164 nodes done)`) · `:465` `"Workspace owner"` in thẳng lên tờ chứng nhận tiếng Việt · `members/page.tsx:189-190,235,240` `aria-label="View certificate"`, `title="Open certificate (PDF)"`, header bảng `User/Role/Invited at/Joined at/Actions`, `Invited:`/`Joined:` | Chuẩn hoá sang tiếng Việt: "In / Lưu PDF", "(0 / 164 mục đã xong)", "Chủ lộ trình", "Xem chứng nhận".
- `application/src/app/(app)/w/[slug]/members/page.tsx:216-221` | Cột "User" vẫn hiển thị `shortId(m.userId)` — bản vá G3 (`getUserDisplay`) **chưa được áp** cho chính trang là lối vào chứng nhận. | Dùng `getUsersDisplay(ids)` (`user-display.ts:107-116`) như trang roster.
- `application/src/app/cert/[id]/page.tsx:23` | `const SITE_NAME = 'Competency Framework'` hardcode trong `src/app` — đúng loại "dữ liệu nghiệp vụ trong src/app" mà luật cấm; hiện lên cả `<title>` lẫn body. | Đưa về `src/lib/config` hoặc env.
- `application/src/app/not-found.tsx:56` | 404 toàn cục hardcode `href="/share/devops-test"` ("Xem demo") — slug của workspace thật nằm trong component. Đây cũng là trang mà employer rơi vào khi mã cert sai/bị thu hồi, và nội dung lại nói "Lộ trình bạn tìm không tồn tại", sai ngữ cảnh chứng nhận. | Bỏ slug hardcode; và cho `/cert` một `not-found.tsx` riêng nói đúng chuyện: "Không tìm thấy chứng nhận, hoặc chứng nhận đã bị thu hồi."
- Loading/error state | `find src/app -name loading.tsx` → có cho `daily`, `skills`, `n/[nodeSlug]`, `w/[slug]` nhưng **không** có cho `certificate/[memberId]` lẫn `/cert/[id]`. Trang cert phải chờ 4 query + sinh QR + 1 lần gọi Supabase (lần đo đầu: **6.5s**, phần lớn là timeout Supabase) mà không có skeleton. | Thêm `loading.tsx` cho cả hai route.
- Không kiểm chứng được | Chưa mở hộp thoại in thật của trình duyệt (chỉ dựng lại bằng Chromium headless + `page.pdf`), nên không khẳng định được người dùng thấy gì trong print preview của Firefox/Safari. Cũng chưa kiểm được QR quét bằng camera điện thoại thật — chỉ chứng minh được nội dung mã hoá đúng URL (mục G8).

---

## ĐÃ VÁ TỪ BẢN RÀ CŨ

| Bước | 2026-08-20 | Hôm nay | Bằng chứng |
|---|---|---|---|
| G3 tên người học | SAI (in UUID) | **ĐỦ** (code) | có `getUserDisplay`/`getPublicUserDisplay`; đầu ra tên thật chưa chứng minh được vì Supabase là `placeholder.supabase.co` |
| G8 QR verify | THIẾU | **ĐỦ** | `qrcode@1.5.4` cài thật; SVG nhúng so byte trùng khớp URL `/cert/2B7D1QKEEA` |
| G10 share link `/cert/[id]` | THIẾU | **ĐỦ** | bảng `certificates` có trong DB; 200 / 404-mã-sai / 404-revoked / noindex đều đã chạy |
| G9 khổ giấy | SAI (portrait 210×297) | vẫn SAI **nhưng khác nguyên nhân** | khổ giấy nay **đúng** A4 landscape (`MediaBox 841.92×594.96pt`); lỗi còn lại là in ra 2 trang, trang 2 trắng |
| G5 ngày | ĐỦ* (không lưu) | **SAI** (chấm lại) | `issued_at` nay lưu thật và bất biến, nhưng vẫn là ngày MỞ TRANG chứ không phải ngày hoàn thành |
| G12 verify | ĐỦ* (chưa nối) | **SAI** (chấm lại) | nay đã nối được QR→`/cert`→`/share`, nhưng lộ ra lệch số 85% vs 84% |
| G2 route | ĐỦ | **SAI** (chấm lại) | `/w/<slug>/certificate` (đúng path spec) trả 404 |

Chưa nhúc nhích: **G1** (notification ≥80%), **G7** (skills trên cert), **G11** (badge image) — đúng như phần "còn nợ" đã tự khai.

---

## CÒN LẠI (xếp theo mức nặng)

**P0 — hỏng thứ đưa cho người ngoài**
1. `G8` — `NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'` (`certificate/[memberId]/page.tsx:155`). QR in lên giấy không sửa lại được; thiếu env ở prod = mọi tờ chứng nhận trỏ localhost vĩnh viễn.
2. `G12` — hai mẫu số 164 vs 166 → cert nói 85%, trang `/share` mà chính cert mời bấm sang nói 84%. Đây là mâu thuẫn số liệu ngay trong luồng "không thể fake".
3. `G9` — PDF ra 2 trang (trang 2 trắng), đo được: document cao 956px / trang cao 794px.
4. Chứng nhận đã thu hồi vẫn in được: `/cert/<code>` 404 nhưng trang owner vẫn render tờ cert + QR, không báo gì.

**P1 — thiếu chức năng đã hứa trong hợp đồng**
5. `G1` notification khi đạt ≥80% — kind `milestone.completed` khai báo rồi mà không ai bắn.
6. `G7` skills đã đạt trên cert — `user_skill_progress` có sẵn, chưa join.
7. `G5` ngày hoàn thành thật (`user_node_progress.completed_at` chưa ai đọc).
8. Kiến trúc: trang cert ghi DB trong lúc render, không qua `lib/rbac/resolve.ts`, nhánh self-service không tự kiểm membership (hiện chỉ layout chặn).
9. Chưa có action `revokeCertificate` — `revoked_at` không có nơi nào ghi.

**P2 — hoàn thiện**
10. `G11` badge image LinkedIn (mở rộng `api/og/route.tsx` là đủ).
11. `G2` thêm route `/w/[slug]/certificate` (redirect) cho khớp spec.
12. Mobile/tablet bóp méo tờ cert; thiếu `loading.tsx`; dead-end 2 chỗ; QR không có nhãn a11y; thiếu `<main>` ở trang public.
13. Lẫn Việt/Anh trên tờ cert và trang members.
14. Hardcode trong `src/app`: `SITE_NAME` (`cert/[id]/page.tsx:23`), `/share/devops-test` (`not-found.tsx:56`).
15. Thêm `/cert/` vào `disallow` của `robots.ts`; migration `0016_rls_policies.sql` chưa chạy vào DB (`relrowsecurity=f`, 0 policy).
