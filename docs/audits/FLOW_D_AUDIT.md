# FLOW D — Admin (rà lại 2026-08-21)

Mốc: `a08fe2c` + working tree chưa commit (invite-tokens.ts, schema-invites.ts,
invite-row-actions.tsx, admin-nav.ts, 0015_workspace_invites.sql).
Bản rà cũ 2026-08-20 (6 ĐỦ · 10 THIẾU · 1 ĐỨT · 6 SAI) đã lỗi thời — bản này thay thế.

Cách kiểm chứng: dev server Node 20 ở `localhost:3001`, DB thật `competency-postgres:5434`,
gọi server action bằng POST + header `Next-Action: <id>` lấy từ chunk client,
`psql` đọc/ghi trực tiếp. Mọi dữ liệu test đã xoá sạch sau khi đo
(workspace_invites 0 dòng, workspace_members 5 dòng, audit_log 71 dòng — như trước khi rà).
`pnpm test` = 33 file / 362 test PASS (không đụng code, gate vẫn xanh).
Ảnh chụp lúc 23:20–23:35 ngày 21/08 — working tree đang được sửa song song bởi việc khác,
nên số dòng có thể trôi vài dòng; mọi kết luận dưới đây đo trên đúng ảnh chụp này.

Bước: 13 ĐỦ · 6 THIẾU · 1 ĐỨT · 3 SAI

---

## Checklist 23 bước

**D1.1 | ĐỦ** | `application/src/app/(app)/onboarding/page.tsx:81,115` → `application/src/actions/workspaces.ts:365,433`
Bằng chứng: `curl /onboarding` → 307 → `/w/sample-public-roadmap-0000-7n1w` (dev user đã có workspace nên màn tạo không hiện lại); hai `<form action={forkTemplateForOnboarding}>` / `{createBlankWorkspace}` bind đúng action.
Vá: —

**D1.2 | ĐỦ** | `application/src/components/admin/visibility-toggle.tsx:31-40`; `application/src/actions/workspace-admin.ts:62`
Bằng chứng: `psql select visibility from workspaces` → `private` (2 dòng) / `public-readonly` (1 dòng); action map `public → public-readonly` + ghi audit `workspace.visibility_update`.
Vá: —

**D1.3 | ĐỦ** | `application/src/actions/workspace-admin.ts:34`; `application/src/app/(app)/w/[slug]/settings/page.tsx:120`
Bằng chứng: `/w/<slug>/settings` render `RenameWorkspaceForm`; action zod `name 1..80` + audit `workspace.rename` (before/after).
Vá: —

**D2.1 | ĐỦ** | `application/src/actions/workspace-members.ts:44-62,72-126`
Bằng chứng đã chạy: POST server action `inviteWorkspaceMember("sample-public-roadmap-0000-7n1w","Audit-Test@Example.COM","learner")` → HTTP 200; `psql` thấy `workspace_invites` 1 dòng `email=audit-test@example.com` (đã lowercase), `invite_token=T0V1FW104B0SR5DH`, `invited_by=…0001`, và `audit_log` `member.invite` `{"role":"learner","email":"audit-test@example.com","invitePending":true}`. Mời lại lần 2 → `INVITE_ALREADY_PENDING:Email này đã có lời mời đang chờ…`. Persona learner gọi cùng action → `WORKSPACE_NOT_FOUND_OR_FORBIDDEN` (không phân biệt được với không-tìm-thấy ✓).
Vá: — (phần "member NHẬN email" nằm ở D2.5, chưa có)

**D2.2 | ĐỨT** | server đủ: `application/src/actions/workspace-members.ts:278-347` · UI chặn: `application/src/components/admin/bulk-invite-csv.tsx:26,63,90,96`
Bằng chứng đã chạy: POST `bulkInviteMembers(slug,[{userId:"bulk-one@example.com",role:"learner"}])` → `{"added":0,"invited":1,"skipped":0,"errors":[]}` — SERVER XỬ LÝ ĐƯỢC EMAIL. Nhưng `parseCsv` gán `error = 'user_id is not a UUID'` cho mọi dòng email (`:63`), và chỉ `validRows` mới được gửi (`:90,:96`) ⇒ từ giao diện không bao giờ chạm tới nhánh email. Đây đúng dạng ĐỨT: action đủ logic, 0 đường UI dùng được.
Vá: bỏ `UUID_RE` ở `:63`, dùng chung một hàm kiểm định `UUID || EMAIL` (tách ra `src/lib/admin/identifier.ts` để action + UI cùng import, tránh lệch luật); đổi nhãn `:125,:127,:137,:143` từ `user_id,role` → `email_hoặc_user_id,role`; thêm cột preview "Sẽ tạo lời mời chờ" cho dòng email; nhận diện header cả `email`.

**D2.3 | ĐỦ** | `application/src/actions/workspace-members.ts:39`; `application/src/components/admin/invite-member-dialog.tsx:108-116`; `application/src/components/admin/member-row-actions.tsx:16-20`
Bằng chứng đã chạy: invite `role=learner` → OK; `role="workspace_owner"` → zod `invalid_enum_value … Expected 'learner' | 'workspace_contributor' | 'workspace_editor'`.
Vá: —

**D2.4 | THIẾU** | `application/src/actions/workspace-members.ts:39` (owner ngoài `assignableRole`); `grep -rni "transfer.*owner|chuyển quyền" src/` = 0 kết quả
Bằng chứng đã chạy: POST invite với `role=workspace_owner` bị zod chặn; không có bất kỳ action nào ghi `workspaces.owner_user_id` (grep `ownerUserId` trong `src/actions/*.ts` không có update/set).
Vá: thêm `transferOwnership(slug, newOwnerUserId)` ở `workspace-admin.ts` — OWNER-only qua `resolveOwnerWorkspace`, trong 1 transaction: update `workspaces.owner_user_id`, hạ owner cũ thành `workspace_editor` trong `workspace_members`, audit `workspace.transfer_owner` (before/after). UI: mục "Chuyển quyền sở hữu" ở `/members` với xác nhận gõ lại tên workspace. Tài liệu `docs/dev/RBAC_PERMISSIONS.md:29,66` đã hứa có "transfer" — hiện chưa tồn tại.

**D2.5 | SAI** | auto-join ĐÚNG: `application/src/lib/auth/join-pending-invites.ts:33-124` + `application/src/app/auth/callback/route.ts:26` · phần email/link KHÔNG có: `grep -rn "resend|nodemailer|SMTP|inviteUserByEmail|sendMail" src/ package.json` = 1 hit duy nhất và nó là **comment** `invite-member-dialog.tsx:53` ("không gửi email tự động"); `invite_token` được sinh (`workspace-members.ts:106,321`) nhưng **không đọc ở đâu**, không có route `/invite/[token]` (`find src/app -ipath "*invite*" -type d` = rỗng)
Bằng chứng đã chạy: seed 1 dòng `workspace_invites` pending cho `newuser@test.local` → chạy `acceptPendingInvites('…9999','newuser@test.local')` → `workspace_members` +1 (role learner, joined_at đúng), invite `status=accepted`, `accepted_by_user_id=…9999`, `audit_log` `member.invite {"autoJoinedFromInvite":"a5d2…","alreadyMember":false}`. Đã xoá sạch sau khi đo.
Kết luận: "auto-join khi đăng nhập bằng đúng email" CHẠY THẬT; "member nhận email → click link" trong đặc tả KHÔNG tồn tại. `workspace_invites.invite_token` hiện là cột write-only.
Vá: (a) route `/invite/[token]` — đọc token (chỉ `status='pending'`), chưa đăng nhập thì đẩy sang `/sign-in?next=/invite/<token>`, đăng nhập xong thì join + đánh dấu accepted (tái dùng `acceptPendingInvites`); (b) gửi mail thật trong `inviteWorkspaceMember` (Supabase `auth.admin.inviteUserByEmail` hoặc Resend, bọc try/catch để không làm hỏng invite); (c) nếu chưa có SMTP: thêm cột "Link mời" + `CopyButton` vào bảng Pending invites (`members/page.tsx:290-314`) để admin tự chuyển — hiện admin không có gì để gửi.

**D2.6 | ĐỦ** | `application/src/lib/db/schema.ts` (user_node_progress); `application/src/app/(app)/w/[slug]/roster/page.tsx:175-197`
Bằng chứng đã chạy: `psql \d user_node_progress` → `unp_ws_user_node_uq UNIQUE (workspace_id, user_id, node_id)` ⇒ tiến độ tách theo từng người trong từng workspace.
Vá: —

**D3.1 | ĐỦ** | `application/src/app/(app)/w/[slug]/roster/page.tsx:308-362`; `application/src/components/admin/roster-table.tsx:170-275`
Bằng chứng đã chạy: `curl /w/devops-test/roster` → 200, bảng 6 dòng (owner + 5 member), 3 StatChip (Members/Average/Completed), thời gian 0.62s warm.
Vá: —

**D3.2 | ĐỦ (có điều kiện — chưa kiểm chứng được tên thật)** | `application/src/app/(app)/w/[slug]/roster/page.tsx:286`; `application/src/lib/auth/user-display.ts:59-76,107-116`
Bằng chứng đã chạy: HTML roster render `0000…0020` chứ KHÔNG phải tên — vì `.env.local` có `NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co` nên `auth.admin.getUserById` fail → fallback `shortId`. Đường code `getUsersDisplay` có thật và fallback an toàn, nhưng ở môi trường này **không chứng minh được** nó ra tên/email thật.
Vá: không phải lỗi code. Cần một môi trường có Supabase thật để xác nhận. Lưu ý phụ: `/members`, `/audit`, `/grading` vẫn tự viết `shortId` riêng và KHÔNG gọi `getUsersDisplay` (xem UI/UX).

**D3.3 | ĐỦ** | `application/src/app/(app)/w/[slug]/roster/page.tsx:232-270,289-290`; `application/src/lib/admin/roster-format.ts:22`
Bằng chứng đã chạy: HTML roster có `<th>Hoạt động</th>` và các giá trị "Hôm nay" (2), "… ngày trước" (2), "Chưa có" (4); `psql streaks` có `last_active_date=2026-08-20`, nguồn thứ hai là `max(activity_log.created_at)` — lấy max của hai nguồn.
Vá: —

**D3.4 | ĐỦ** | `application/src/app/(app)/w/[slug]/roster/page.tsx:272-282,291-297`; `application/src/components/admin/roster-table.tsx:227-234`
Bằng chứng đã chạy: HTML roster có đúng 1 badge `>at risk<` + tooltip "Nguy cơ bỏ cuộc: đã bắt đầu học nhưng không hoạt động ≥ 7 ngày và hoàn thành < 100%".
Vá: —

**D3.5 | THIẾU** | `application/src/app/(app)/w/[slug]/skills/page.tsx:24-62` (join cứng theo `user.id`); `application/src/lib/analytics/queries.ts:204-248`
Bằng chứng đã chạy: `/analytics` render bảng "Skill distribution" (learners, self/learned/verified, avg level, avg crowns) — KHÔNG có cột `Team avg | Strong n/N | Weak n/N` như đặc tả, và mẫu số là "số người có dòng `user_skill_progress`", không phải sĩ số team, nên không ra được dạng "8/10". Trang `/roster` không có mục skills nào.
Vá: `src/lib/admin/skills-gap.ts` — với mỗi skill: team avg = avg(`competency_levels.numeric_value`) trên TOÀN BỘ member (thiếu dòng progress = 0), strong = `numeric >= target` (hoặc >= ngưỡng workspace), weak = phần còn lại; render section "Skills gap" ngay dưới bảng roster + đưa vào `exportRosterXlsx` thành sheet thứ 2.

**D3.6 | ĐỦ** | `application/src/actions/exports.ts:203-260`; `application/src/components/admin/roster-export-button.tsx:29-46`
Bằng chứng đã chạy: POST server action `exportRosterXlsx("devops-test")` → HTTP 200, `filename=devops-mastery-2026-roster-2026-08-21.xlsx`; giải base64 → zip xlsx hợp lệ 7119 byte, sheet có 7 `<row>`; sharedStrings: `Member, Role, Overall %, DevOps Mastery — Lộ trình 12 tháng (done/total), … %, AWS Deep Dive… (done/total), … %, Last active, At risk` và dữ liệu `77b0…dde7 | Owner | 135/159 | 5/5 | 2026-07-20 | yes`. Đúng "progress chi tiết từng người".
Vá: —

**D3.7 | SAI** | `application/src/actions/exports.ts:263-353`; nút `roster-export-button.tsx:58-65`
Bằng chứng đã chạy: POST `exportRosterReport("devops-test")` → `filename=devops-mastery-2026-roster-report-2026-08-21.html`, 4283 byte, bắt đầu `<!DOCTYPE html>`, chứa "Tip: Use browser File → Print → Save as PDF". Là HTML in tay, KHÔNG phải PDF. `@react-pdf/renderer ^4.0.0` **đã nằm trong `package.json:48`** nhưng `grep -rn "@react-pdf/renderer" src/` chỉ ra 1 dòng **comment** ở `exports.ts:5` — dependency chưa dùng, comment nói sai sự thật.
Vá: render PDF thật bằng `@react-pdf/renderer` (đã có sẵn) trong `exportRosterReport`, trả `application/pdf`; hoặc nếu giữ HTML thì phải đổi nhãn nút và tên action cho đúng (`Overview report (HTML)`) và xoá comment sai ở `exports.ts:5`.

**D4.1 | ĐỦ** | `application/src/components/admin/roster-table.tsx:210-214` (row click) + Sheet `:277-396`
Bằng chứng đã chạy: HTML roster có `onClick` mở Sheet; drawer hiển thị per-phase + danh sách node (D4.2). Ghi chú: đây là **drawer**, không phải trang hồ sơ; `src/app/u/[id]/page.tsx` có tồn tại nhưng `grep 'href={`/u/'` = 0 ⇒ không nơi nào link tới hồ sơ đó.
Vá: (tuỳ chọn) thêm link "Mở hồ sơ" trong drawer sang `/u/[id]`.

**D4.2 | ĐỦ** | `application/src/app/api/workspaces/[slug]/roster/[userId]/nodes/route.ts`; gọi ở `roster-table.tsx:113-138`
Bằng chứng đã chạy: `GET /api/workspaces/devops-test/roster/000000aa-…-0020/nodes` → JSON `phases[0].total=159` + mảng `nodes[]` có `title/nodeType/depth/done`; persona learner → **404**; `userId` không phải member → **404** (không phân biệt được ✓).
Vá: —

**D4.3 | THIẾU** | `application/src/app/(app)/w/[slug]/skills/page.tsx:24-62`; `application/src/app/api/workspaces/[slug]/skills/route.ts:23`
Bằng chứng đã chạy: cả trang lẫn API đều join `userSkillProgress.userId = user.id` (người đang xem); không có tham số `userId` ở bất kỳ đâu.
Vá: `GET /api/workspaces/[slug]/skills?userId=` — EDITOR+, kiểm tra target là member của workspace (tái dùng đúng khối "isMember" ở `roster/[userId]/nodes/route.ts:39-59`), rồi thêm tab "Skills" vào drawer roster.

**D4.4 | THIẾU** | `application/src/app/api/workspaces/[slug]/activity/route.ts:34` (`eq(activityLog.userId, user.id)`); `application/src/app/(app)/w/[slug]/audit/page.tsx:45-53` (không lọc theo actor, cứng `limit 100`)
Bằng chứng đã chạy: API activity chỉ trả 20 dòng của CHÍNH người gọi; trang audit là workspace-wide, không có ô lọc/tìm theo actor, không phân trang.
Vá: `?userId=` cho activity API (EDITOR+, target phải là member) + section "Activity" trong drawer roster; và thêm bộ lọc actor + phân trang cho `/audit`.

**D4.5 | THIẾU** | `grep -rni "assignTask|assignNode|giao thêm task" src/` = 0 kết quả
Bằng chứng đã chạy: không có bảng, action hay UI nào cho việc gán node cho người khác.
Vá: bảng `node_assignments(workspace_id, node_id, assignee_user_id, assigned_by, due_at, status)` + action `assignNode` (EDITOR+, `resolveWorkspace` → domain → `writeAudit('node.assign')`) + nút "Giao thêm task" trong drawer roster + hiển thị ở `/daily` của learner (nếu không hiện phía learner thì lại thành ĐỨT).

**D4.6 | THIẾU** | `application/src/actions/notifications.ts:38,80,96,121` (chỉ list/count/markRead); insert `notifications` chỉ có ở `follows.ts:94`, `comments.ts:149`, `learn.ts:631`; `analytics/page.tsx:294-297` tự thừa nhận "Gửi reminder/nhắc nhở chưa thuộc phạm vi của trang này"
Bằng chứng đã chạy: grep như trên — không có đường ghi notification từ phía admin.
Vá: `remindMember(slug, userId, message?)` — EDITOR+, insert `notifications` kind `admin_reminder`, audit `member.remind`, chặn spam (1 lần/người/ngày, kiểm bằng `created_at`), nút trong drawer roster + ở danh sách "stuck" của `/analytics`.

**D4.7 | SAI (đợt 7 mới vá được một nửa)** | action đúng: `application/src/actions/evidence.ts:277-363` (EDITOR+) · nguồn dữ liệu cho nút sai: `application/src/actions/evidence.ts:233-264` (`eq(evidenceGrades.userId, user.id)`) · nút: `application/src/components/skills/skill-drawer.tsx:479-509`, `canVerify` từ `application/src/app/(app)/w/[slug]/skills/page.tsx:95`
Bằng chứng đã chạy: `grep -rn "verifyEvidence" src/` → đúng 1 chỗ gọi (skill-drawer). Danh sách evidence trong drawer lấy từ `listEvidenceForSkill`, mà hàm này lọc cứng `userId = user.id` ⇒ **mọi dòng evidence hiện ra đều là của chính người đang xem**; nút "Verify/Reject" vì thế chỉ có thể TỰ DUYỆT bằng chứng của mình, không bao giờ chạm tới member khác — đúng như đặc tả D4 "Verify skill của họ" thì vẫn chưa có. Nặng thêm: `verifyEvidence` KHÔNG chặn `grade.userId === user.id` và khi approve thì cộng `+30 XP` cho chủ sở hữu (`evidence.ts:333-342`) ⇒ editor/owner tự duyệt để tự cộng XP. (Chưa chạy được đường này vì `evidence_grades` đang 0 dòng — đây là kết luận đọc code, không phải số đo.)
Vá: (a) chặn self-verify trong `verifyEvidence` (`throw new Error('CANNOT_VERIFY_OWN_EVIDENCE')`) + unit test; (b) làm hàng đợi duyệt giống `/grading`: `listPendingEvidence(wsId)` (EDITOR+, workspace-scoped, kèm tên người nộp) → trang `/w/[slug]/evidence` hoặc tab trong drawer roster; hoặc tối thiểu cho `listEvidenceForSkill(slug, skillId, targetUserId?)` nhận `targetUserId` với guard EDITOR+ và target-là-member.

---

## UI/UX & FE (màn admin)

- `application/src/lib/rbac/admin-nav.ts:12,13` vs `application/src/app/(app)/w/[slug]/members/page.tsx:81` và `application/src/app/(app)/w/[slug]/audit/page.tsx:39` | **DEAD-END nặng nhất**: sidebar cho EDITOR thấy link Members + Audit log (đã chạy: `curl -b dev_bypass_user=<editor> /w/devops-test` trả về `href="/w/devops-test/members"` và `/audit`), nhưng vào là bị `redirect` (body chứa `NEXT_REDIRECT`) vì trang đòi OWNER. Test `tests/unit/admin-nav.test.ts:11,12` còn khoá chặt cái sai này. | Đổi `members` và `audit` trong `ADMIN_NAV_MIN_LEVELS` thành `RBAC_LEVELS.OWNER` (đúng `docs/business/PHAN_QUYEN.md:95-97`) và sửa test tương ứng; hoặc hạ guard trang xuống EDITOR nếu nghiệp vụ muốn thế — nhưng phải chọn một.
- `application/src/components/admin/invite-member-dialog.tsx:89-92` | Mô tả dialog vẫn là văn bản cũ: "MVP: paste the user UUID. **Email lookup is not wired yet**…" trong khi email ĐÃ chạy (đo ở D2.1). Người dùng đọc xong sẽ không dám nhập email. | Viết lại: "Nhập email (chưa có tài khoản vẫn mời được — sẽ tự vào workspace khi đăng nhập) hoặc user UUID."
- `application/src/components/admin/invite-member-dialog.tsx:125` và `application/src/app/(app)/w/[slug]/members/page.tsx:306` | Class Tailwind **sai cú pháp**: `bg-primary/10/10`, `border-primary/40/30` (hai lần `/`) → không sinh ra CSS nào ⇒ khung thông báo "đã tạo lời mời" và badge "chờ chấp nhận" mất nền, chỉ còn chữ. | `bg-primary/10`, `border-primary/30`.
- `application/src/components/admin/invite-member-dialog.tsx:66,120-123` | Lỗi hiện raw cho người dùng: đã đo `INVALID_IDENTIFIER:Nhập email hoặc user UUID.` (lộ tiền tố mã lỗi), `ALREADY_MEMBER`, `INVITE_ALREADY_PENDING:…`, và zod trả nguyên `invalid_enum_value … Expected 'learner' | 'workspace_contributor' …`. Không có `aria-live` nên screen reader không đọc lỗi. | Bảng map mã → câu tiếng Việt (`src/lib/errors/messages.ts`), cắt phần trước dấu `:`; bọc vùng lỗi bằng `role="alert" aria-live="polite"`; validate email ngay tại client trước khi submit.
- `application/src/app/(app)/w/[slug]/members/page.tsx:220-224,139,172` | Cột "User" và StatChip "Owner" vẫn là `shortId(UUID)` — `getUsersDisplay` (đã dùng ở roster) không được gọi ở đây. Admin nhìn bảng member không biết ai là ai. | Import `getUsersDisplay` như `roster/page.tsx:286` và render `displayName` + email nhỏ bên dưới; giữ `CopyButton` UUID.
- `application/src/components/admin/audit-row.tsx:22,53,71` | Trang Audit hiển thị actor bằng `shortId(UUID)` (bản sao thứ 3 của hàm `shortId`). | Dùng `getUsersDisplay` ở `audit/page.tsx` rồi truyền `displayName` xuống.
- `application/src/app/(app)/w/[slug]/members/page.tsx:31-35`, `application/src/components/admin/audit-row.tsx:22`, `application/src/components/admin/bulk-invite-csv.tsx:76` vs `application/src/lib/auth/user-display.ts:33` | 4 bản sao của cùng một hàm `shortId` (DRY). | Xoá 3 bản sao, import từ `@/lib/auth/user-display`.
- `application/src/app/(app)/w/[slug]/members/page.tsx:42-55` + `application/src/lib/admin/roster-format.ts:36` | `roleLabel` không map `super_admin` / `workspace_owner` → bảng member in ra chữ máy `super_admin`; **đã thấy nguyên si trong file Excel xuất ra** (ô Role = `super_admin`). | Bổ sung 2 nhánh; và dùng chung một `roleLabel` (hiện có 2 bản).
- `application/src/app/(app)/w/[slug]/members/page.tsx:277-320` | Bảng "Pending invites" **không có bản mobile** (bảng members có `sm:hidden` cards ở `:161-203`, bảng invite thì không) → dưới 640px phải cuộn ngang `min-w-[560px]`. | Nhân bản khối card `sm:hidden` cho pending invites.
- `application/src/app/(app)/w/[slug]/members/page.tsx:119-121,269,272-275,307` | Việt/Anh lẫn trong **cùng một trang**: "Members / manage who can access this workspace" cạnh "Người này sẽ tự động vào workspace…", "Không có lời mời nào đang chờ.", "chờ chấp nhận". Tương tự ở roster: header EN `per-member progress across top-level phases` + cột VI `Hoạt động` (`roster-table.tsx:179`), và tooltip VI (`:229`). | Chọn một ngôn ngữ cho toàn bộ màn admin (sản phẩm đang nghiêng tiếng Việt) và thống nhất; nếu định đa ngữ thì tách chuỗi ra `src/lib/i18n` trước khi viết thêm màn.
- `application/src/components/admin/roster-table.tsx:210-215` | Hàng bảng chỉ mở drawer bằng `onClick` trên `<tr>`: không `tabIndex`, không `onKeyDown`, không `role="button"` → **bàn phím và screen reader không mở được drill-down** (D4.1/D4.2 coi như không tồn tại với người dùng bàn phím). | Thêm nút thật ở ô đầu (`<button>` bọc tên) hoặc `tabIndex={0}` + `onKeyDown` Enter/Space + `aria-haspopup="dialog"`.
- `application/src/components/admin/roster-table.tsx:217` | `group-hover:bg-secondary/20` trên ô sticky nhưng `<tr>` (`:211-214`) **không có class `group`** → cột trái dính không đổi màu khi hover, lệch với phần còn lại của hàng. | Thêm `group` vào `<tr>`.
- `application/src/components/admin/roster-table.tsx:155` | Placeholder "Filter members by user_id substring…" trong khi bộ lọc `:143-145` đã tìm cả `displayName`. | "Tìm theo tên hoặc user_id…".
- `application/src/components/admin/roster-table.tsx:377-381` | Lỗi tải node breakdown chỉ hiện chữ "Close and reopen the drawer to retry" — không có nút thử lại; `errorUser` cũng chặn luôn lần fetch sau vì cache. | Thêm nút "Thử lại" gọi lại fetch (reset `errorUser`).
- `application/src/app/(app)/w/[slug]/roster/page.tsx:350-359` | Empty state in ra **chuỗi placeholder thô**: `'No members yet — invite someone from /w/[slug]/members.'` — người dùng thấy đúng chữ `[slug]` và không bấm được. `EmptyState` đã hỗ trợ prop `action` (`src/components/ui/empty-state.tsx:30`). | `description="Chưa có thành viên nào."` + `action={<Button asChild><Link href={"/w/"+ws.slug+"/members"}>Mời thành viên</Link></Button>}`.
- `application/src/app/(app)/w/[slug]/roster/page.tsx:322` | `RosterExportButton` nhét ngay dưới `<p>` mô tả trong `<header>`, không có nhãn nhóm; trên mobile 2 nút chiếm hết chiều ngang tiêu đề. | Đưa ra hàng riêng (`justify-between` với header) hoặc gom vào một dropdown "Xuất".
- `application/src/components/admin/roster-export-button.tsx:42` | `toast.error('Roster export failed', { description: String(e) })` → in `Error: WORKSPACE_NOT_FOUND_OR_FORBIDDEN` cho người dùng cuối. | Map mã lỗi sang câu tiếng Việt.
- `application/src/components/admin/roster-export-button.tsx:16-23` | Tải file bằng `data:` URI: file Excel roster đo được 7 KB nên hiện tại ổn, nhưng workspace lớn (vài trăm member × nhiều phase) sẽ chạm giới hạn độ dài URL của trình duyệt. | Đổi sang `Blob` + `URL.createObjectURL` + `revokeObjectURL`.
- `application/src/components/admin/bulk-invite-csv.tsx:140-147` | Tên tính năng là "Bulk import từ CSV" nhưng **không có ô chọn file**, chỉ dán tay; bảng preview `:151` không `min-w`/không bọc `overflow-x-auto` → vỡ trên mobile. | Thêm `<input type="file" accept=".csv">` đọc bằng `FileReader` (vẫn giữ ô dán); bọc bảng preview trong `overflow-x-auto`.
- `application/src/components/admin/invite-row-actions.tsx:26`, `application/src/components/admin/member-row-actions.tsx:53`, `application/src/components/admin/delete-workspace-form.tsx:23` | Dùng `window.confirm` native cho 3 hành động phá huỷ (thu hồi lời mời / xoá member / xoá workspace) — lệch hẳn với `Dialog` Radix của phần còn lại, không style được, một số trình duyệt chặn. | Dùng `Dialog` xác nhận dùng chung; riêng thu hồi lời mời nên có "Hoàn tác" (mời lại) vì thao tác này không có đường lùi trong UI.
- `application/src/components/admin/invite-row-actions.tsx:52` | Lỗi hiện bằng `<span class="text-[10px]">` chen trong ô bảng → chữ 10px, tràn ô, không `aria-live`. | Dùng `toast` như các màn khác.
- `application/src/app/(app)/w/[slug]/members/page.tsx:87-91` | Danh sách member **không phân trang**, `select()` lấy toàn bộ; `/audit` cứng `limit 100` (`audit/page.tsx:51`) mà không có nút xem thêm → mất lịch sử cũ mà người dùng không biết. | Phân trang (hoặc cursor) cho cả hai; ít nhất hiện "đang xem 100/`total` bản ghi".
- `application/src/app/(app)/w/[slug]/loading.tsx` | Skeleton chung của segment là dạng **dashboard** (hero + 4 stat card + zigzag) nhưng lại dùng cho `/members`, `/roster`, `/audit` (các trang này không có `loading.tsx` riêng) → nhấp nháy sang bố cục khác hẳn. | Thêm `loading.tsx` dạng bảng cho `members`/`roster`/`audit`.
- `application/src/lib/auth/user-display.ts:126-153` | `findUserIdByEmail` duyệt tới **20 trang × 200 user** cho MỖI email khi mời (bulk 500 dòng = tối đa 10.000 lượt gọi API), không timeout; và khi Supabase lỗi thì trả `null` ⇒ người dùng ĐANG TỒN TẠI bị âm thầm biến thành "invite pending" (đây chính là điều xảy ra ở môi trường này vì URL là placeholder). | Dùng API lọc theo email (hoặc bảng `profiles` nội bộ) thay cho `listUsers` phân trang; tách "không tìm thấy" khỏi "lỗi/không cấu hình" và báo lỗi rõ thay vì tạo invite sai.
- `application/test-accept.mts` (rác ở thư mục gốc app, chưa commit) | Script debug tay còn sót lại, không nằm trong `tests/`, chạy xong treo tiến trình vì không đóng connection. | Chuyển thành test trong `tests/unit/` hoặc xoá.

---

## ĐÃ VÁ TỪ BẢN RÀ CŨ (FAIL → ĐỦ)

- **D2.1** SAI → ĐỦ: invite nhận email thật, resolve qua Supabase Admin API, không tìm thấy thì tạo invite pending (đã chạy: tạo được dòng invite + audit).
- **D2.5** THIẾU → SAI (tiến bộ, chưa xong): bảng `workspace_invites` + auto-join khi đăng nhập đã CHẠY THẬT; nhưng vẫn không gửi email, không có `/invite/<token>`, token là cột chết.
- **D3.2** SAI → ĐỦ có điều kiện: roster đã gọi `getUsersDisplay` (môi trường này thiếu Supabase thật nên vẫn ra shortId).
- **D3.3** THIẾU → ĐỦ: cột "Hoạt động" (streaks + activity_log, lấy max).
- **D3.4** THIẾU → ĐỦ: cờ "at risk" (đã bắt đầu ∧ ≥7 ngày ∧ <100%).
- **D3.6** SAI → ĐỦ: `exportRosterXlsx` xuất đúng từng member (đã giải nén file .xlsx để kiểm).
- **D4.1** SAI → ĐỦ và **D4.2** THIẾU → ĐỦ: drawer + API `/roster/[userId]/nodes` trả node-level, guard EDITOR+ trả 404 đúng cách.
- Thêm ngoài đặc tả: thu hồi lời mời (`revokeInvite` + `InviteRowActions`), bảng Pending invites, `admin-nav.ts` (nhưng chính nó đẻ ra dead-end mới, xem UI/UX).

## CÒN LẠI (xếp theo mức nặng)

1. **D4.7 — nút Verify chỉ tự duyệt được của chính mình** + `verifyEvidence` không chặn self-verify mà vẫn cộng +30 XP. Vừa là chức năng thiếu vừa là lỗ hổng liêm chính. Vá trước.
2. **Dead-end sidebar Members/Audit cho EDITOR** (`admin-nav.ts:12,13`) — mọi editor bấm vào là bị đá về; test đang khoá cái sai.
3. **D2.2 ĐỨT** — bulk CSV chặn email ở client dù server đã làm được (sửa 1 dòng regex + nhãn).
4. **D2.5** — không có email/`/invite/<token>`; ít nhất phải cho admin copy được link mời.
5. **D4.5 / D4.6** — "Giao thêm task" và "Nhắc nhở" hoàn toàn chưa có (cả bảng lẫn action lẫn UI).
6. **D4.3 / D4.4** — skills matrix và activity log theo từng member (đã có sẵn khuôn guard ở `roster/[userId]/nodes/route.ts` để nhân bản).
7. **D3.5** — Skills gap matrix cấp team (analytics mới có avg, thiếu strong/weak và mẫu số theo sĩ số).
8. **D3.7** — báo cáo vẫn là HTML; `@react-pdf/renderer` đã cài sẵn mà không dùng.
9. **D2.4** — chưa có chuyển quyền sở hữu, dù tài liệu RBAC đã hứa.
10. Nhóm UI/UX: 2 class Tailwind hỏng, mô tả dialog nói sai sự thật, UUID thay tên ở members/audit, hàng bảng không dùng được bằng bàn phím, `window.confirm`, Việt/Anh lẫn, thiếu phân trang, `findUserIdByEmail` O(20 trang)/email.
