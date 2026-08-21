# FLOW B — Learner (rà lại 2026-08-21)

> Mốc: `a08fe2c` + **working tree chưa commit** (19 file M, 22 file/thư mục ??).
> Đặc tả: `USER_FLOWS.md` dòng 43–199 (Flow B) + Flow F cho hearts/XP/streak.
> Cách đo: dev server riêng `NEXT_DIST_DIR=.next-audit PORT=3311` (Node 20) — server 3000
> của user đang hỏng `.next` (`Cannot find module './vendor-chunks/@tanstack+query-core@5.100.9.js'`,
> mọi route `/w/*` trả **500**), server 3210 là bản prod không có dev-bypass (307 → sign-in).
> DB: `docker exec competency-postgres psql -U postgres -d competency`.
> Gate lúc rà: `pnpm typecheck && pnpm lint && pnpm test && pnpm guard` → **exit 0, 357/357 test, 32 file, 4 guard sạch**.
>
> **Cảnh báo dữ liệu:** lúc 16:17 hôm nay có tiến trình khác ghi 140 dòng
> `user_node_progress` cho user `77b020ab…` (không phải tôi — tôi chạy bằng
> dev-bypass `00000000-…-0001`). Mọi số dưới đây đo trên user dev-bypass.
> Phân rã của tôi ra **52 bước** (FLOW_STATUS.md đếm 34) vì tôi tách riêng
> trình chạy bài học + các nhánh rẽ của "Đánh dấu xong".

```
FLOW B — Learner (rà lại 2026-08-21)
Bước: 33 ĐỦ · 6 THIẾU · 3 ĐỨT · 10 SAI
```

---

## B1 — Đăng ký

| Mã | Trạng thái | file:line | Bằng chứng đã chạy | Đề xuất vá |
|---|---|---|---|---|
| B1.1 | **SAI** | `src/app/(auth)/sign-in/page.tsx:34-50, 81-133` | `GET /sign-in → 200`. Toàn màn tiếng Anh: "Welcome back" (:81), "Send magic link" (:116), "Check your email" (:88), "Back" (:74), "New here? Just sign in…" (:133) — trong khi `<html lang="vi">`. Không gửi được mail thật: `.env.local` có `NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co` → **luồng gửi/nhận magic link chưa kiểm chứng được** | Dịch toàn bộ copy sang tiếng Việt đúng đặc tả ("Kiểm tra hộp thư"). Không sửa logic |
| B1.2 | **ĐỦ** | `src/app/auth/callback/route.ts:18-31` | Đọc code: `exchangeCodeForSession` → redirect `next ?? '/onboarding'`; thất bại → `/sign-in?error=auth_failed` (`:34`). **Chưa chạy được** vì Supabase là placeholder | — |
| B1.3 | **ĐỦ** | `src/app/(auth)/sign-in/page.tsx:52-61` | `signInWithOAuth({provider:'google', redirectTo:/auth/callback})`. **Chưa chạy được** (placeholder) | — |
| B1.4 | **ĐỦ** | `callback/route.ts:16` · `src/app/(app)/onboarding/page.tsx:48-53` | `GET /onboarding` (user dev đã có workspace) → **307**; `GET /onboarding?force=1` → **200** | — |

## B2 — Onboarding

| Mã | Trạng thái | file:line | Bằng chứng đã chạy | Đề xuất vá |
|---|---|---|---|---|
| B2.1 | **ĐỦ** | `onboarding/page.tsx:61-147` | Render 200, thấy đúng 2 lựa chọn: thẻ template + thẻ "Tạo cây trống" | — |
| B2.2 | **SAI** | `onboarding/page.tsx:62-66, 80-112` | Query là `framework_templates WHERE is_published` — **không phải roadmap public của cộng đồng**. DB: `framework_templates` = **1 dòng** ("DevOps Mastery"); `workspaces` visibility `public-readonly` = **2** (`devops-test`, `sample-public-roadmap`) — **không cái nào xuất hiện**. Thẻ ghi "Forked 0 times" | Đổi nguồn dữ liệu sang `workspaces WHERE visibility='public-readonly'` xếp theo số fork thật (`activity_log kind='framework_forked'` — `/discover` đã làm), hoặc gộp 2 nguồn; thêm link "Xem thêm ở /discover" |
| B2.3 | **ĐỦ** | `src/actions/workspaces.ts:433-476` | `createBlankWorkspace` tạo ws + hearts 5/5 + streak 0 + activity_log rồi redirect `?step=2` | — |
| B2.4 | **ĐỦ** | `onboarding/page.tsx:151-209` · `workspaces.ts:397-426` | Form có `Tên workspace` + preview slug; `renameOnboardingWorkspace` đổi tên + `reserveWorkspaceSlug(excludeWorkspaceId)` rồi redirect `?step=3` | — |
| B2.5 | **ĐỦ** | `onboarding/page.tsx:242-298` | Confetti (`.confetti-dot`, :244-256) + nút "Bắt đầu học" → `/w/{slug}` (:293-297) | — |

## B3 — Dashboard ngày học

| Mã | Trạng thái | file:line | Bằng chứng đã chạy | Đề xuất vá |
|---|---|---|---|---|
| B3.1 | **ĐỦ** | `src/app/(app)/w/[slug]/page.tsx:46-87, 168-173` | Render thật `/w/devops-test`: `Tiến độ 0% (0/166)` · `XP 145` · `Streak 1 ngày` · `Hearts 5/5`. Đối chiếu DB: `sum(xp_events.amount)` = 10+5+10+10+10+20+25+10+20+25 = **145** ✔; `streaks.current_streak=1` ✔; `hearts 5/5` ✔; `count(roadmap_tree_nodes)` ws = **166** ✔ | — |
| B3.2 | **ĐỦ** | `page.tsx:141-154` · `src/lib/tree/queries.ts:319-356` | Probe: `INSERT user_node_progress(status='doing')` cho node `iam-identity-center-mfa-XS-w1-s0-l0` → render lại thấy **"Tiếp tục từ chỗ bạn dừng / IAM Identity Center & MFA"**; xoá probe → quay về fallback "Bắt đầu học". Vòng đọc CÒN SỐNG | — |
| B3.3 | **SAI** | `page.tsx:91-102` · `queries.ts:161-210` | Đặc tả: "Cây roadmap **toàn bộ**". Thực tế `getTreeSections` chỉ lấy 2 tầng (main + subs). Render thật: 166 node nhưng dashboard hiện 9 pill; muốn xuống sâu phải click từng cấp. Trùng lỗi A3 của Flow A | Dùng `src/lib/tree/full-tree.ts` (đã có, đang dùng cho /share) để render cây đầy đủ có thể gập/mở, hoặc thêm nút "Xem toàn cây" |
| B3.4 | **ĐỦ** | `queries.ts:293-307` · `src/components/learn/vertical-roadmap.tsx:196-244` + `RoadmapLegend showStatus` | Render thật có legend `○ chưa học · ◑ đang học · ● đã xong`; khi probe 'doing' thì trang node cha hiện `◑ đang học` đúng chỗ. `aria-label` = `"{title} — {STATUS_LABEL}"` (:214-216) | — |
| B3.5 | **ĐỦ** | `page.tsx:176-197` | Render thật: "Tới Daily Planner", "Ghi chú hôm nay", "Skills Matrix" (3 link) | — |
| B3.6 | **ĐỦ** | `src/components/learn/dashboard-rail.tsx:33-42, 143-166` | Render thật panel "Hoạt động gần đây" với 6 dòng từ `activity_log` (DB có 38 dòng). *Chất lượng kém — xem mục UI/UX* | — |
| B3.7 | **SAI** | `dashboard-rail.tsx:43, 69-140` · `src/lib/learn/node-progress.ts:176` | Panel "Sắp tới" + "Kỹ năng 1/42 skill đã tự đánh giá · 1 crowns" có thật. NHƯNG `ORDER BY path_str ASC` mà `path_str` là **chuỗi UUID** (đo DB: `3ed739de-…`, `5c553bea-…`) → thứ tự "bước tiếp theo" gần như ngẫu nhiên. Render thật cho ra 5 node **"Tuần" ~480p** của cây thứ hai, trong khi bài học thật không bao giờ nổi lên. Rail cũng **không áp `maxTaskMinutes`** như planner (`daily-planner.ts:121` = 120) nên đề xuất việc 480 phút làm "bước kế" | Sắp xếp theo thứ tự duyệt cây thật (đệ quy `order_index` theo từng cấp, hoặc thêm cột `sort_key` materialize lúc ghi node), và lọc `estMinutes <= maxTaskMinutes` chung với planner |

## B4 — Học một node (gồm trình chạy bài học)

| Mã | Trạng thái | file:line | Bằng chứng đã chạy | Đề xuất vá |
|---|---|---|---|---|
| B4.1 | **ĐỦ** | `src/app/(app)/w/[slug]/n/[nodeSlug]/page.tsx:92-149` | Render thật: breadcrumb 5 cấp, "Bài học · ~7 phút · Lá (không có con)", khối "Nội dung chi tiết" render Markdown + TOC | — |
| B4.2 | **ĐỦ** | `src/components/learn/resources-section.tsx:35-47` | Đủ 6 kind gồm `video` / `doc` / `tool` / `lab` như đặc tả. **DB `node_resources` = 0 dòng** nên panel luôn rỗng ("Chưa có tài liệu"). Vị trí render lệch đặc tả — xem UI/UX | Seed/nhập tài liệu thật; đưa panel lên ngay dưới body |
| B4.3 | **ĐỦ** | `node/page.tsx:161-182` · `src/actions/tree-nodes.ts:525-531` · `src/lib/tree/cascade.ts:41` | Render thật: "Lộ trình bên trong (N)" + "x/y đã xong"; gate `incompleteDescendants` chặn done khi còn con | — |
| B4.4 | **ĐỦ** | `src/components/learn/node-toolbar.tsx:175-204` · `tree-nodes.ts:587-635` | Nút "Bắt đầu học"/"Đang học" (`aria-pressed`) gọi `setNodeStatus`; probe DB chứng minh phía đọc chạy (B3.2/B3.4) | — |
| B4.5 | **ĐỦ** | `node-toolbar.tsx:205-218, 285-374` · `tree-nodes.ts:641-696` | Dialog "Bằng chứng cho …", validate URL client + `z.string().url()` server, ghi `user_node_progress.evidence_urls`; node page hiện khối "Bằng chứng đã gắn (n)" (`node/page.tsx:115-135`). **DB hiện 0 dòng có evidence** (dữ liệu cũ FLOW_STATUS nhắc đã bị xoá) | — |
| B4.6 | **ĐỦ** | `tree-nodes.ts:525-531` · `node-toolbar.tsx:129-134` | Ném `INCOMPLETE_CHILDREN:{n}:Còn n/m mục con chưa xong — hoàn thành chúng trước.`, UI bắt đúng mã và hoàn tác optimistic | — |
| B4.7 | **THIẾU** | `tree-nodes.ts:524-541` | Đặc tả: *"ELSE IF không có evidence → Prompt 'Thêm link bằng chứng' (optional hoặc required — **config của creator**)"*. `grep -rn "requireEvidence\|require_evidence\|evidenceRequired\|evidence_required" src/ drizzle/` → **0 kết quả**. `toggleNodeDone` không hề đọc evidence | Thêm cột `workspaces.require_evidence_to_done boolean default false` (+ migration + ô chọn ở `/w/[slug]/settings`); trong `toggleNodeDone` nếu bật mà `evidence_urls` rỗng thì ném `EVIDENCE_REQUIRED`; UI mở thẳng `EvidenceDialog` thay vì toast |
| B4.8 | **ĐỦ** | `node-toolbar.tsx:92-140` · `src/components/learn/confetti.tsx:42-82` | Confetti (tôn trọng `disableForReducedMotion`) + toast `+{xp} XP · 🔥 streak {n}` + toast từng badge | — |
| B4.9 | **ĐỦ** | `queries.ts:293-307` · `node/page.tsx:166-170` · `vertical-roadmap.tsx:232-234` | `doneChildren/childrenCount` hiển thị trên pill và header node; render thật `0/4 · 0%`, `0/12` | — |
| B4.10 | **THIẾU** | `src/lib/tree/cascade.ts` (chỉ có `reopenDoneAncestors:68`) | Đặc tả: *"Nếu tất cả sibling done → parent cũng done"*. Chỉ có cascade **chiều ngược** (bỏ done thì mở khoá cha). Không có hàm nào tự đánh dấu cha xong | Thêm `completeAncestorsIfAllDone(ws,user,pathStr)` chạy sau `upsertNodeStatus('done')` trong `toggleNodeDone`, đi ngược `path_str`, mỗi cấp kiểm `incompleteDescendants` rồi `awardNodeCompletion` (XP theo depth) — dùng lại `insertXpOnce` nên an toàn với replay |
| B4.11 | **ĐỦ** | `src/lib/learn/node-progress.ts:227-229` | `awardNodeCompletion` gọi `awardStreakTick` rồi `evaluateBadges`; DB có `xp_events reason='badge_earned' 25` | — |
| B4.12 | **ĐỦ** | `node/page.tsx:200-208` · `quick-note-composer.tsx:71,82` · `journal-section.tsx` | Render thật: "Note nhanh" (anchor `#quick-note` khớp quick action B3.5) + "Bài viết / Journal" + "Đăng bài mới" | — |
| B4.13 | **SAI** | `src/app/(app)/w/[slug]/n/[nodeSlug]/practice/page.tsx:91` · `src/actions/learn.ts:132-164` | `startLesson` được gọi **trong lúc render một GET** và tăng `attempts` **vô điều kiện** (`learn.ts:146`). Đo thật: `user_lesson_progress.attempts` **71 → 73 sau đúng 2 lần `curl` trang practice**, trong khi `user_exercise_attempts` chỉ có **24 dòng**. Cột `attempts` giờ đếm *lượt xem trang*, không phải lượt làm bài. (Phần đã vá vẫn đúng: `status` giữ `completed`, không bị hạ cấp — đo được.) Prefetch **không** kích hoạt (thử `RSC:1 + Next-Router-Prefetch:1` → attempts không đổi) | Tách đôi: `loadLessonRun()` thuần đọc cho page render; giữ `startLesson()` là server action thật, chỉ gọi từ `LessonRunner` khi người học **bắt đầu** (hoặc gộp việc bump `attempts` vào `submitExercise` lần đầu của mỗi lượt). Bổ sung test: 2 lần render page ⇒ `attempts` không đổi |
| B4.14 | **ĐỦ** | `learn.ts:224-373` | Render thật `/…/practice` → 200: "6/6 câu đã nộp · 2 đúng · 1 chờ chấm", hearts 5, verdict "Chính xác" + giải thích. XP một lần/bài (`countPriorAttempts`/`hasCorrectAttempt`), hearts trừ bằng 1 upsert atomic `GREATEST(current-1,0)` (:315-332), `pending_review` không trừ tim/không XP (:262) | — |
| B4.15 | **ĐỨT** | `learn.ts:394-558` (không đụng `user_node_progress`) | **Vòng lặp học đứt ở đúng khớp nối chính.** `grep -rn "upsertNodeStatus" src/` → chỉ `actions/tree-nodes.ts` gọi. Đo DB: lesson `iam-identity-center` = `completed`, `best_score 0.333`, **nhưng `user_node_progress` của node `iam-identity-center-mfa-XS-w1-s0-l0` = 0 dòng** → cây vẫn `○`, dashboard vẫn `0% (0/166)`. Làm xong bài tập không làm nhúc nhích tiến độ; người học phải quay lại bấm tay "Đánh dấu xong" | Trong `completeLesson`, sau khi ghi `user_lesson_progress`, tra node qua `roadmap_tree_nodes.meta->>'lessonSlug' = lessons.slug` (query đã có sẵn ở `src/lib/learn/task-links.ts:57`) rồi gọi `upsertNodeStatus('done')` + `awardNodeCompletion` + cascade B4.10. Đặt ngưỡng đỗ (ví dụ `scorePct >= 0.8`) làm cấu hình, không hardcode. Ngược lại `startLesson` nên set node `doing` |
| B4.16 | **ĐỨT** | `src/app/(app)/w/[slug]/grading/page.tsx:32` · `src/lib/rbac/admin-nav.ts:11-17` | Trang hàng đợi chấm **chạy tốt**: `GET /w/devops-test/grading` → 200, hiển thị 1 bài `pending_review` (DB: `user_exercise_attempts status='pending_review'` = 1), form rubric 2 tiêu chí trọng số 2/1. NHƯNG **không nav nào trỏ tới**: `ADMIN_NAV_MIN_LEVELS` không có key `grading`, và `grep -rn "/grading" src/ --include=*.tsx` (trừ chính thư mục đó) = **rỗng**. Sidebar render thật chỉ có Members / Audit log / Roster / Analytics / Settings | Thêm `grading: RBAC_LEVELS.EDITOR` vào `ADMIN_NAV_MIN_LEVELS` + mục sidebar kèm badge số bài chờ (`countPendingAttempts` đã có ở `lib/exercises/grading.ts`). Thêm `grading/types` dưới đó |
| B4.17 | **SAI** | `src/components/layout/notifications-bell.tsx:50-55` · `learn.ts:631-641` | Thông báo "Bài của bạn đã được chấm" ghi đủ `resourceType='exercise'` + `resourceId` (DB: 20 dòng `attempt.graded`), nhưng `navTargetFor` **bỏ hết**, luôn `return /w/{slug}` → bấm vào rơi về dashboard, không thấy điểm | `navTargetFor` xử lý `resourceType='exercise'`: tra node chạy lesson chứa exercise đó rồi trỏ `/w/{slug}/n/{nodeSlug}/practice` (logic đã có ở `task-links.ts:120-135`); fallback mới về `/w/{slug}` |

## B5 — Daily Planner

| Mã | Trạng thái | file:line | Bằng chứng đã chạy | Đề xuất vá |
|---|---|---|---|---|
| B5.1 | **ĐỦ** | `src/lib/learn/daily-planner.ts:130-223` · `src/actions/daily-planner.ts:68-142` | `GET /w/devops-test/daily` → 200, sinh **4 task** (min 3 / max 5). DB `daily_tasks` ngày 2026-08-21: `streak_keeper`(3p), 2×`lesson` ref `node`(6p,4p), `weak_skill_review` ref `skill`(6p) — tổng 19p khớp UI | — |
| B5.2 | **THIẾU** | `daily-planner.ts:130-223` | Đặc tả liệt kê 4 tín hiệu; có 3 (`streakAtRisk` :154, `unfinishedNodes` :161, `weakSkills` :173). **"Tiến độ so với timeline (nếu có deadline)" không tồn tại** — `grep deadline` trong `src/` = 0 kết quả, schema không có cột hạn | Thêm `workspaces.target_end_date` (hoặc `user_planner_settings.target_end_date`), tính "nhịp cần đạt = node còn lại / ngày còn lại" và đẩy thành 1 tín hiệu ưu tiên trong `planDay` (giữ `planDay` thuần, truyền qua `UserContext`) |
| B5.3 | **SAI** | `src/components/daily/today-focus.tsx:234-278` | Đặc tả: mỗi dòng có `[✓ Done] [Skip]`. Thực tế **Skip bị giấu** trong menu `…` (`aria-label="Task actions"`, :246) cùng "Move to tomorrow". Toàn bộ nhãn tiếng Anh (:59-63, :265, :273). Render thật chỉ thấy "Làm bài"/"Xem kỹ năng" + số phút | Đưa "Bỏ qua" thành nút cấp 1 cạnh checkbox; dịch nhãn |
| B5.4 | **ĐỦ** | `src/actions/daily-planner.ts:436-488` | `markTaskDone` → `insertXpOnce(reason='daily_task_complete', refId=task.id)` (replay trả 0) + `awardStreakTick`. DB có `xp_events reason='daily_task_complete' 10` và `daily_streak 5` | — |
| B5.5 | **THIẾU** | `today-focus.tsx:113-126` | Đặc tả: *"Chuyển sang task tiếp theo"* sau khi tick. Code chỉ `router.refresh()` — không cuộn/focus sang dòng kế | Sau khi refresh, `focus()` vào checkbox của task `todo` đầu tiên (`useRef` theo id) |
| B5.6 | **ĐỦ** | `daily-planner.ts:506-559` · `src/components/learn/daily-quick-add.tsx` | "+ Thêm task" render thật ở header; `addCustomTask` ghi `refKind='custom'`, `kind='stretch'`, mô tả "Task bạn tự thêm" | — |
| B5.7 | **ĐỦ** | `src/lib/learn/task-links.ts:143-192` | Render thật: task ref `node` có exercise → link **"Làm bài"** (`/n/{slug}/practice`); task ref `skill` → **"Xem kỹ năng"**; `lab`/`custom` để trơ, không dẫn sai (:186-188) | — |
| B5.8 | **ĐỨT** | `today-focus.tsx:284-301` vs `daily/page.tsx:135-156` | Empty state **đúng** (tiếng Việt, có 2 CTA) nằm ở page; nhưng `TodayFocus` chỉ được render khi `tasks.length > 0` (`page.tsx:135`), trong khi bên trong nó còn `EmptyState` thứ hai — tiếng Anh "Nothing planned yet" + nút "Generate plan" chỉ gọi `router.refresh()` — **không đường nào chạm tới**. Code chết, và sẽ đánh lừa người đọc sau | Xoá `EmptyState` + nhánh `tasks.length === 0` (:69-71) trong `today-focus.tsx` |
| B5.9 | **THIẾU** | `daily-planner.ts:562-591` · `src/actions/learn.ts:327` | Flow F: *"Skip task trong daily planner: -0.5 heart"*, *"Mỗi ngày không học: -1 heart"*, *"0 hearts: cần nghỉ 1 ngày"*, *"Ôn bài cũ: +1 heart"*. `grep` cho thấy **chỗ duy nhất tim giảm** là `learn.ts:327` (trả lời sai). `markTaskSkipped` không đụng tim; không có decay theo ngày; `submitExercise` **không chặn khi hearts = 0** | Quyết định lại game design trước (FLOW_STATUS đã đánh dấu F8/F9/F11 là "cân nhắc lại"). Nếu giữ: cột `hearts.current` đổi sang `numeric(3,1)`, decay lazy giống `applyHeartRefills`, và chặn `submitExercise` khi `current <= 0` |

## B6 — Skills Matrix

| Mã | Trạng thái | file:line | Bằng chứng đã chạy | Đề xuất vá |
|---|---|---|---|---|
| B6.1 | **ĐỦ** | `src/app/(app)/w/[slug]/skills/page.tsx:26-69` · `skills-table-client.tsx:283-291` | `GET /w/devops-test/skills` → 200; bảng có `Skill · Category · Level · Target · Source · Crowns · Updated`; render thật 1 dòng có dữ liệu: "IAM Deep… | aws | S · Junior · Working | — | Self + learned | 1/5" | — |
| B6.2 | **ĐỦ** | `skills-table-client.tsx:289, 333` | Cột **Source** có thật và hiện "Self + learned" đúng với DB (`user_skill_progress.level_source='both'`). Khẳng định vá của FLOW_STATUS **còn đúng** | — |
| B6.3 | **SAI** | `src/components/skills/crown-count.tsx:34-42` | Đặc tả vẽ `●●●○○`. Thực tế 1 icon vương miện + chữ `1/5`. Màu theo nguồn thì đúng (`crownToneClass:18-22`: verified→vàng, learned/both→primary, self→muted) | Render 5 chấm (`Array.from({length:5})`), tô `crowns` chấm đầu bằng `crownToneClass`, giữ `title` hiện tại làm nhãn a11y |
| B6.4 | **SAI** | `src/actions/assessments.ts:59-67` (và `:75-85`) | **`levelSource: 'self_claimed'` được ép VÔ ĐIỀU KIỆN mỗi lần update.** Kết hợp `skill-drawer.tsx:200-241` **tự lưu sau 700 ms** khi đổi bất cứ thứ gì (level / note / "why" / target / evidence) ⇒ chỉ cần mở drawer sửa một chữ là `both`/`learned`/`verified` bị **ghi đè thành `self_claimed`**: mất crown vàng, mất dấu vết đã được duyệt, mâu thuẫn thẳng với B6.5/B6.6. DB hiện có đúng 1 dòng `level_source='both'` đang chờ bị hạ cấp. Cùng loại lỗi với bug `startLesson` hạ cấp đã từng vá | Tính `nextSource` từ giá trị cũ y như `src/actions/evidence.ts:128-150` đang làm: `verified` giữ nguyên; `learned` + tự đánh giá → `both`; `both` giữ `both`; `null` → `self_claimed`. Tách thành hàm thuần `nextLevelSource(prev, event)` trong `src/lib/skills/` + unit test 4 nhánh |
| B6.5 | **ĐỦ** | `src/lib/gamification/crowns.ts:64-100` | Hoàn thành lesson → `crowns = min(5, +1/+2)` và `level_source` = `learned` (hoặc `both` nếu trước đó tự đánh giá). DB chứng minh: 1 dòng `both`, `crowns = 1`, sinh ra từ `xp_events reason='lesson_complete'` ngày 08-20 | — |
| B6.6 | **ĐỦ** | `src/actions/evidence.ts:117-150` · `crown-count.tsx:19` | Duyệt bằng chứng → `level_source='verified'` (giữ `both` đúng thứ tự ưu tiên) và crown chuyển `text-yellow-500`. *Bị B6.4 phá ngay sau đó* | — |

## B7 — Share tiến độ

| Mã | Trạng thái | file:line | Bằng chứng đã chạy | Đề xuất vá |
|---|---|---|---|---|
| B7.1 | **ĐỦ** | `src/app/share/[slug]/page.tsx` | `GET /share/devops-test` → **200** (public). `GET /share/sample-public-roadmap-0000-7n1w` (private): chủ sở hữu → 200, người ngoài (cookie `dev_bypass_user=000000aa-…-0010`) → **404**. Bản vá C4.2 còn đúng | — |
| B7.2 | **ĐỦ** | `src/app/api/og/route.tsx` | `GET /api/og?slug=devops-test` → **200 `image/png`**, 1200×630 | — |
| B7.3 | **THIẾU** | `api/og/route.tsx:59-113` | Đặc tả: OG phải có *% tiến độ · số skill đã đạt · avatar + tên người học*. Thực tế chỉ render tên workspace + `totalNodes/totalSections/totalWeeks`; `grep "pct\|avatar\|skill"` trong file = **0 kết quả nghiệp vụ** | Đưa vào 3 số đã có sẵn hàm: `completionPct` (`lib/tree/completion.ts:9`), `count(user_skill_progress WHERE level_code IS NOT NULL)`, tên thật từ `lib/auth/user-display.ts` (đã dùng cho roster/cert) |
| B7.4 | **SAI** | `api/og/route.tsx:49-57, 112` | **Rò rỉ workspace private.** Route tra `workspaces WHERE slug=?` **không kiểm `visibility`** rồi vẽ `title = ws.name`. Đo thật: `/share/sample-public-roadmap-0000-7n1w` → **404** với người ngoài, nhưng `/api/og?slug=sample-public-roadmap-0000-7n1w` → **200 `image/png` 100 136 byte** cả khi **không gửi cookie nào**. Bản vá C4.2 bịt `/share` mà bỏ sót `/api/og` | Áp đúng gate của `/share`: `visibility !== 'public-readonly'` → 404 (hoặc trả PNG trung tính không chứa tên). Thêm test route giống test đã có cho `/share` |

---

## UI/UX & FE

| file:line | Vấn đề | Đề xuất |
|---|---|---|
| `src/components/learn/node-toolbar.tsx:234-253` | **RBAC không tới UI.** Nút *Thêm con · Lên · Xuống · Sửa · Xoá* hiện cho **mọi** người xem. Đo thật với cookie `dev_bypass_user=000000aa-…-0020` (role `learner`, level 20): trang node trả 200 và **có đủ 5 nút**, trong khi server đòi EDITOR(60)/OWNER(80) (`tree-nodes.ts:143,270,328,397`). Bấm vào chỉ nhận toast `Lỗi xoá: Error: WORKSPACE_NOT_FOUND_OR_FORBIDDEN` — vừa ngõ cụt vừa sai nghĩa | `node/page.tsx:55` đã có `viewerEff`; truyền `canEdit = level>=EDITOR`, `canDelete = level>=OWNER` vào `NodeToolbar` và ẩn nút. Đổi thông điệp lỗi sang tiếng Việt ("Bạn không có quyền …") |
| `src/app/(app)/w/[slug]/n/[nodeSlug]/page.tsx:176` | Empty state bảo người học *"Click 'Thêm con' ở trên để bắt đầu"* — đúng nút họ không được phép bấm | Đổi copy theo quyền: learner thấy "Mục này là bài lá — làm bài tập hoặc đánh dấu xong" |
| `src/components/daily/today-focus.tsx:59-63, 118-152, 184-196, 258-274, 290-297` | Toàn màn Daily tiếng Anh trong app `lang="vi"`: `Lesson · Lab · Weak skill · Streak keeper · Stretch · skipped · moved to tomorrow · Skip today · Move to tomorrow · Task completed · Could not complete · Skip failed · Carried over to tomorrow · Mark as done · Task actions · Nothing planned yet · Generate plan` | Rút nhãn ra `src/lib/learn/activity-labels.ts` (đã có tiền lệ) và dịch hết |
| `src/app/(app)/w/[slug]/daily/page.tsx:59, 64, 68, 81, 88-89, 95-96, 106, 122, 128` | Cùng vấn đề ở khung trang: `Today · ~19m planned · 4 tasks · XP today · goal 60 XP · Tasks done · 4 remaining · Time planned · estimated · Daily goal · Daily goal reached — anything more is bonus!` | Dịch; đơn vị `m` → `phút` |
| `src/lib/learn/daily-planner.ts:276, 278, 338-339, 358` | Chuỗi nghiệp vụ tiếng Anh **ghi thẳng vào DB**: `daily_tasks.title = 'Keep your streak alive'`, `'Quick replay: …'`, `'Review: {skill}'`, `'Weak skill ({lvl}) — {n}d since last touch'`, `'Stretch: peek next level for …'` — đã nằm trong 5 dòng `daily_tasks` hiện có, không sửa được bằng cách đổi UI | Đưa sang khoá + tham số (`titleKey`/`params`) rồi dịch lúc render, hoặc tối thiểu dịch tại nguồn |
| `src/actions/daily-planner.ts:330` | Sentinel `999` lọt ra người dùng: render thật hiện **"Weak skill (unset) — 999d since last touch"** | Khi chưa từng chạm, hiện "chưa từng ôn" thay vì một con số bịa |
| `src/app/(app)/w/[slug]/skills/page.tsx:106-108, 118-145` | Skills Matrix tiếng Anh: `Skills Matrix · 42 skills · click a row to self-assess · Total skills · in this workspace · Self-assessed · 41 pending · Crowns earned · across all skills · Levels in rubric · competency tiers` | Dịch |
| `src/components/skills/skills-table-client.tsx:288-291, 330-339` | `hidden md:table-cell` giấu **Target · Source · Crowns · Updated** trên mobile ⇒ trên điện thoại người học **không thấy được Source lẫn Crowns** — đúng hai thứ B6.2/B6.3 vừa làm | Trên mobile gộp Source + Crowns vào dòng phụ dưới tên skill (như rail "Sắp tới" đang làm) thay vì ẩn hẳn |
| `src/components/skills/skills-table-skeleton.tsx:51-56` | Skeleton có **6 cột**, bảng thật có **7** (thiếu `Source`) ⇒ nhảy layout khi dữ liệu về | Đồng bộ cột; tốt hơn: tách mảng `COLUMNS` dùng chung cho cả hai |
| `src/components/skills/skill-drawer.tsx:435` | Nhãn người dùng lộ số phiên bản nội bộ: **"Verified evidence (V8)"** | Đổi thành "Bằng chứng đã duyệt" |
| `src/components/skills/skill-drawer.tsx:319, 347, 356, 380, 385, 452, 460` | Drawer tiếng Anh: `Your current level · Clear level · Target level · Why this level? · Brief justification… · Loading evidence… · No verified evidence yet…` | Dịch |
| `src/components/skills/skills-table-client.tsx:340` · `src/components/exercises/grading-queue.tsx:59` · `src/components/admin/audit-row.tsx:47` · `src/app/(app)/w/[slug]/members/page.tsx:39` · `src/app/(app)/profile/page.tsx:79,203` · `src/lib/utils.ts:32` | `toLocaleDateString()` / `toLocaleString()` **không truyền locale** ⇒ render thật ra định dạng Mỹ: `8/20/2026` ở Skills, `8/20/2026, 11:47:37 AM` ở trang chấm. Ở Server Component còn có nguy cơ lệch hydration giữa locale server và client | Một helper chung `formatDate(d)` dùng `Intl.DateTimeFormat('vi-VN', {timeZone:'Asia/Ho_Chi_Minh'})` |
| `src/lib/utils.ts:26-32` | Helper thời gian tương đối trả tiếng Anh: `just now · 5m ago · 3h ago · 2d ago` | Dịch |
| `src/components/learn/vertical-roadmap.tsx:201, 210-225` | 🔒 chỉ là **trang trí**: `isLocked` vẫn render `<Link href>` bấm được, `aria-label` không nói "khoá", và icon khoá **thay chỗ** emoji loại node nên người dùng bàn phím/đọc màn hình không biết gì. Với workspace mới (`firstUndoneIdx = 0`) mọi mục từ #4 trở đi đều hiện khoá — render thật của `/w/devops-test` ở 0% có 🔒 ở cả hai section dù **không có cơ chế khoá nào ở server** | Hoặc bỏ hẳn (đặc tả B3 chỉ có ○/◑/●), hoặc làm khoá thật: `aria-disabled`, không cho click, tooltip nêu điều kiện mở |
| `src/components/learn/dashboard-rail.tsx:153` | "Hoạt động gần đây" chỉ in **nhãn loại**; render thật là 6 dòng y hệt nhau `• attempt graded 08-20` — vô dụng | Thêm chủ ngữ từ `activity_log.payload` (tên node / tên bài) |
| `src/components/learn/dashboard-rail.tsx:159` | Ngày dùng `createdAt.toISOString().slice(5,10)` = **giờ UTC**; với người dùng UTC+7 mọi hoạt động trước 07:00 sẽ hiện lùi 1 ngày | Format theo `Asia/Ho_Chi_Minh` như streak |
| `src/lib/learn/planner-dates.ts:1-16` vs `src/lib/gamification/streak.ts:22-28` vs `src/app/(app)/w/[slug]/layout.tsx:28-30` | **Hai định nghĩa "hôm nay" song song.** Streak dùng `Asia/Ho_Chi_Minh` (comment ở `streak.ts:10` còn ghi rõ *"Using server/UTC would reset the streak at 07:00 local time"*), còn planner và "XP today" ở topbar dùng **UTC** ⇒ từ 00:00–07:00 giờ VN, Daily Planner vẫn là kế hoạch hôm qua trong khi streak đã sang ngày mới | Dùng chung `todayVN()` cho planner + topbar (hoặc đưa múi giờ vào `user_planner_settings` như Flow F yêu cầu "theo múi giờ account") |
| `src/app/(app)/w/[slug]/n/[nodeSlug]/practice/` | **Không có `loading.tsx`** dù đây là trang nặng nhất luồng (RBAC + node + lesson + `startLesson` + 3 query). Các trang khác đều có (`w/[slug]/loading.tsx`, `daily/loading.tsx`, `skills/loading.tsx`, `n/[nodeSlug]/loading.tsx`) | Thêm skeleton runner |
| `src/app/(app)/w/[slug]/n/[nodeSlug]/page.tsx:194-214` | Thứ tự khối lệch đặc tả B4: đặc tả đặt **Resources panel ngay dưới body**, code đặt sau `SiblingNav`, và vì streaming của Server Component, HTML thô đẩy "Thư viện tài liệu" xuống **dưới cả Journal và Bình luận** (kiểm bằng text render) | Đưa `<ResourcesSection>` lên ngay sau khối "Nội dung chi tiết" |
| `src/components/learn/node-toolbar.tsx:147` | Xoá node dùng `window.confirm()` — hộp thoại hệ điều hành, không theo design system, không dịch được theo app, không a11y đồng bộ với `Dialog` đang dùng ở 3 chỗ khác cùng file | Dùng `Dialog` như `EvidenceDialog` |
| `src/app/(app)/onboarding/page.tsx:74-77, 98, 122-126, 139-144` | Trộn Anh/Việt **trong cùng một thẻ**: tiêu đề "Welcome to Competency Framework" + "Pick a framework to fork…" cạnh "Tạo cây trống" / "Build your own competency tree from scratch"; empty state hướng dẫn `pnpm db:seed` — lệnh dev lộ cho người dùng cuối | Dịch; đổi empty state thành hành động người dùng làm được |
| `src/app/(app)/onboarding/page.tsx:300-315` | Confetti bước 3 là CSS animation **không có `@media (prefers-reduced-motion: reduce)`**, khác chuẩn của `confetti.tsx:52,66,79` (`disableForReducedMotion: true`) | Bọc keyframes trong media query |
| `src/app/(auth)/sign-in/page.tsx:81-133` | Cửa vào sản phẩm 100% tiếng Anh trong app `lang="vi"` | Dịch |
| `src/components/layout/notifications-bell.tsx:50-55` | Mọi thông báo về cùng `/w/{slug}`, bỏ `resourceType`/`resourceId` — xem B4.17 | — |
| `src/app/(app)/w/[slug]/page.tsx:170` · `daily/page.tsx:82` | `sub="all-time"`, `sub="goal 60 XP"` — chú thích tiếng Anh xen giữa nhãn tiếng Việt ("Tiến độ", "Streak", "Hearts", "còn lại") | Thống nhất một ngôn ngữ |
| `src/app/(app)/w/[slug]/page.tsx` (topbar `md:hidden` h1) + hero h1 | Trên mobile có **2 `<h1>`** cùng lúc (tên workspace ở topbar + tiêu đề hero), đo trên HTML render | Hạ topbar xuống `<p>`/`<h2>`, giữ 1 h1/trang |
| `src/lib/workspace.ts:38-62` vs `src/lib/rbac/resolve.ts:38-63` | **Hai resolver workspace song song** (cùng query, cùng `requireMinLevel`, khác kiểu trả về). Yêu cầu kiến trúc là mọi truy cập đi qua `rbac/resolve.ts`. Hệ quả thật: `requireWorkspaceAccess` **cứng ở LEARNER**, nên page không bao giờ biết cấp quyền thật — đúng nguyên nhân gốc của lỗi toolbar ở dòng đầu bảng này | Cho `requireWorkspaceAccess` gọi `resolveWorkspace(slug, LEARNER)` rồi bổ sung `icon`/`color`, và trả kèm `ctx.level` để page gate UI |

---

## KHẲNG ĐỊNH CŨ SAI

Đối chiếu `application/docs/dev/FLOW_STATUS.md` (2026-08-20, mốc `d9c76ac`):

1. **"B — Learner · 34 bước · đã vá 15/15"** — 15 mục đó *phần lớn* còn đúng (tôi probe lại B3.2, B3.4, B6.2 và cả ba vẫn chạy). Nhưng bảng lấy **dòng dữ liệu trong DB** làm bằng chứng ("`user_node_progress` có `doing`", "DB có 2 dòng evidence") — hôm nay đo lại: user dev-bypass có **0 dòng `user_node_progress`** trong workspace `devops-test` và **0 dòng evidence**. Bằng chứng kiểu "DB có dòng X" **hết hạn ngay khi reset DB**; muốn giữ phải là test hoặc probe chạy lại được.
2. **Bảng bug: "`startLesson` ghi `'in_progress'` vô điều kiện … Ngủ yên vì chưa ai gọi"** — phần hạ cấp `status` đã vá thật (đo được: mở lại bài `completed` vẫn giữ `completed`). Nhưng **cùng hàm đó vẫn `attempts = attempts + 1` vô điều kiện**, và giờ **đã có người gọi** — gọi ngay trong render GET của `/practice` (`practice/page.tsx:91`). Đo: **71 → 73 sau đúng 2 lần `curl`**. Bug chưa chết, chỉ đổi cột.
3. **"B6.2 cột Source ✅ … DB có `both` → hiển thị 'Self + learned'"** — cột hiển thị đúng (xác minh live). Nhưng chỉ vá **phía đọc**: `assessments.ts:65` vẫn ép `level_source='self_claimed'` mỗi lần lưu, mà drawer **tự lưu sau 700 ms**, nên giá trị `both`/`verified` bị xoá ngay lần người học chỉnh ghi chú. Vá cột mà không vá nguồn ghi.
4. **"B5.1 … trỏ `roadmap_tree_nodes`, ưu tiên `doing`, bỏ node >120 phút"** — đúng cho *planner*. Nhưng B3.7 nói "dùng chung `listUnfinishedLeafNodes` với planner": hàm dùng chung **không** có bộ lọc 120 phút (nó nằm ở `planDay`), nên rail "Sắp tới" render thật ra **5 node "Tuần" ~480 phút**. Và thứ tự là `ORDER BY path_str` — chuỗi UUID, tức gần như ngẫu nhiên.
5. **Flow C: "C4.2 `/share/<slug>` trả full content cho workspace private — giờ 404 với người ngoài"** — đúng cho `/share` (đo: 404). Nhưng **`/api/og?slug=<private>` vẫn 200** và vẽ tên workspace private cho bất kỳ ai, **không cần cookie**. Lỗ chưa bịt hết.
6. **"RBAC 7 tier 11/11, gồm leo quyền chéo workspace"** — vẫn đúng ở **tầng action**. Nhưng **tầng UI không dùng RBAC**: đo live với role `learner`, trang node vẫn render đủ nút *Thêm con / Lên / Xuống / Sửa / Xoá*. "11/11 xanh" không có nghĩa là giao diện đúng quyền.
7. **"Hạ tầng đã xong … trình chạy bài học"** — trình chạy chạy tốt, nhưng **không nối vào cây**: `completeLesson` không ghi `user_node_progress`. Đo: lesson `iam-identity-center` = `completed` mà node tương ứng **0 dòng progress**, dashboard vẫn `0% (0/166)`. Đây là chỗ đứt nặng nhất của Flow B và chưa từng được ghi nhận.
8. **Phụ:** FLOW_STATUS ghi "Dev 3000 vẫn Node 18" — hôm nay server 3000 **trả 500 cho mọi route `/w/*`** (thiếu vendor chunk trong `.next`). Ai tin "route 200" từ máy đó sẽ đo sai.

---

## CÒN LẠI (xếp theo mức nặng)

**P0 — hỏng nghiệp vụ / lộ dữ liệu**
1. `B4.15` **Vòng lặp học đứt**: làm xong bài tập không đánh dấu node xong → tiến độ và cây đứng yên. Đây là trục chính của Flow B.
2. `B6.4` **Tự đánh giá xoá `verified`/`learned`/`both`** (auto-save 700 ms nên xảy ra vô tình), phá luôn B6.5/B6.6 và +30 XP đã trả.
3. `B7.4` **`/api/og` rò rỉ workspace private** (tên + cấu trúc) cho khách vô danh.
4. `B4.13` **`startLesson` ghi DB trong render GET**: `attempts` đếm lượt xem trang (73 vs 24 lượt làm thật) — hỏng số liệu và là ghi không idempotent trong GET.

**P1 — ngõ cụt / sai quyền / sai thứ tự**
5. **RBAC không tới UI**: learner thấy Thêm con/Sửa/Xoá, bấm vào nhận `WORKSPACE_NOT_FOUND_OR_FORBIDDEN`.
6. `B4.16` Hàng đợi chấm **không có lối vào** (không nav nào trỏ `/w/[slug]/grading`).
7. `B3.7` Thứ tự "bước tiếp theo" theo `path_str` (UUID) + rail không lọc `maxTaskMinutes`.
8. **Hai định nghĩa "hôm nay"** (planner UTC vs streak UTC+7) — plan lệch 7 tiếng mỗi ngày.
9. `B4.10` Không tự hoàn thành node cha khi mọi con đã xong; `B4.7` không có config "evidence bắt buộc".
10. `B4.17` Thông báo "đã chấm" dẫn về dashboard thay vì bài đã chấm.
11. `B3.3` Dashboard chỉ vẽ 2 tầng cây (đặc tả: toàn bộ).

**P2 — trải nghiệm / nhất quán**
12. **i18n**: Daily Planner, Skills Matrix, Skill drawer, sign-in, một phần onboarding còn tiếng Anh; chuỗi tiếng Anh còn **ghi vào DB** qua `daily_tasks.title`.
13. Ngày giờ định dạng Mỹ ở 6+ chỗ; sentinel `999d` lọt ra UI.
14. `B6.3` Crowns hiện `1/5` thay vì `●●●○○`; `B7.3` OG thiếu %/skill/tên người học.
15. Mobile: Skills giấu cột `Source`/`Crowns`; skeleton lệch 1 cột.
16. 🔒 trang trí trên cây (bấm được, không có gate server, hiện tràn lan ở workspace 0%).
17. `B5.9` hearts decay/skip/replay + chặn ở 0 tim; `B5.5` không tự nhảy task kế; `B5.3` nút Skip bị giấu.
18. `B5.8` `EmptyState` chết trong `today-focus.tsx`; `B2.2` onboarding không dẫn tới roadmap cộng đồng.
19. Thiếu `loading.tsx` cho `/practice`; thứ tự khối trên trang node lệch đặc tả; `window.confirm` khi xoá.
20. **Kiến trúc**: gộp `requireWorkspaceAccess` vào `rbac/resolve.ts` và trả kèm `level` để page gate được UI (gốc của mục 5).
