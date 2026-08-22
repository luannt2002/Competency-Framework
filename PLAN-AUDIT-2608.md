# Kế hoạch xử lý tồn đọng sau đợt audit 22/08/2026

Nguồn: workflow `wf_acd56605-a5b` — 65 agent, 5 trục (FE/BE/DB/phủ-test/trùng-lặp), mỗi phát hiện qua một vòng phản biện đối kháng. 59 phát hiện → **51 sống sót, 8 bị bác**.

Đã xong ở commit `0e02c86` (đã merge `main`, đã push): 2 P0 + 3 P1 + 3 guard mới. Tài liệu này là phần **còn lại**.

## Nguyên tắc áp dụng

1. **Mỗi bản vá phải chứng minh bằng cách gỡ nó ra.** Test xanh không chứng minh gì; test đỏ đúng chỗ mới chứng minh. Đã làm được với cả 3 nhóm ở đợt trước (4/5, 2/5, 3/12 đỏ trên code cũ).
2. **Lỗi "quên gọi" thì dựng guard, không viết test hành vi.** Sự cố share-guard cũ: hàm luôn đúng, bề mặt MỚI quên đi qua. Test hành vi không bao giờ bắt được.
3. **Không ghi miễn trừ để build xanh.** Một dòng miễn trừ là một lỗ hổng được cấp phép ở lại.
4. **Đo hiệu năng trên production build**, không đo trên `next dev` — theo luật đo trong skill `cf-upgrade`.
5. **`next dev` không nạp lại code khi sửa file** (ENOSPC file watchers). Sau mỗi lần sửa code server, phải restart trước khi chạy e2e, nếu không là đang kiểm bản cũ.

## Bảng đợt

| Đợt | Nhóm | Mức thật | Công | Trạng thái |
|---|---|---|---|---|
| **1** | Đ1 — `learn.ts`: kiểm trước, ghi sau + chốt tenant | **P0** (audit gán P2, đánh giá thấp) | Nhỏ | **đang làm** |
| **2** | Đ2 — Open redirect ở auth callback | **P1** | Nhỏ | chờ |
| **3** | Đ3 — Toàn vẹn ghi DB: fork không transaction | P1 | Lớn | chờ |
| **4** | Đ4 — FE: form không có trạng thái chờ | P1 | Vừa | chờ |
| **5** | Đ5 — FE: nút hứa việc không làm | P1 | Nhỏ | chờ |
| **6** | Đ6 — Truy vấn N+1 & thiếu index | P2 | Vừa | chờ |
| **7** | Đ7 — Trùng lặp & code chết (~650 dòng) | P2 | Lớn | chờ |
| **8** | Đ8 — Phủ test còn lại | P1 | Lớn | chờ |

---

## Đợt 1 — `learn.ts`: kiểm trước, ghi sau (ĐANG LÀM)

Audit gán P2 cho hai mục này. **Đánh giá lại: P0.** Lý do: một cái ghi dữ liệu xuyên tenant, một cái cho phép tự phong `mastered` + XP + crown mà không làm gì.

### 1.1 `completeLesson` không kiểm `lessonId` thuộc workspace

`startLesson` (`learn.ts:175-181`) có chốt `eq(lessons.workspaceId, ws.id)` → `LESSON_NOT_FOUND`. `completeLesson` **không có**. Learner ở workspace A gọi được `completeLesson({ workspaceSlug: 'A', lessonId: <bài của workspace B> })` và sinh ra dòng `user_lesson_progress` của A trỏ sang bài của B — dữ liệu rác, thổi badge.

**Sửa:** thêm đúng khối kiểm như `startLesson`.

### 1.2 Chú thích nói "never trust client", code thì tin

```ts
// ===== Server-side score: derive from recorded attempts, never trust client =====
const scorePct = (await computeLessonScore(...)) ?? parsed.scorePct;
```

`computeLessonScore` trả `null` **đúng khi bài học không có bài tập nào** (`xp-award.ts:101`). Đó chính là lúc `??` nhận điểm client. Client gửi `scorePct: 1` → `mastered = scorePct >= 0.999` → thưởng XP + crown, không làm gì cả.

**Sửa:** bài không có bài tập → điểm 0, không `mastered`. Bỏ hẳn `scorePct` khỏi `completeInput` — tham số nào không được tin thì đừng nhận.

### 1.3 `computeLessonScore` đọc `exercises` không có điều kiện workspace

`xp-award.ts:100` — `.where(eq(exercises.lessonId, lessonId))`. Với `lessonId` của tenant khác thì nó đọc bài tập của tenant đó. `guard-tenant-scope` không bắt vì câu lệnh có nhắc `workspaceId` ở đoạn dưới.

**Sửa:** thêm điều kiện workspace vào câu select.

**Chứng minh:** test integration `learn-guards.test.ts` — 3 bài, mỗi bài phải đỏ trên code cũ:
1. `completeLesson` với `lessonId` của workspace khác → ném `LESSON_NOT_FOUND`, **đếm bằng query** rằng không dòng `user_lesson_progress` nào sinh ra.
2. Bài không có bài tập + client gửi `scorePct: 1` → trạng thái `completed` chứ không `mastered`, crown = 1 chứ không 2.
3. Hết tim → `submitExercise` ném `NO_HEARTS` **và** `xp_events` + `user_exercise_attempts` không tăng (đã vá ở đợt trước, thêm test khoá lại).

**Rủi ro:** `tests/integration/lesson-node-link.test.ts` chạm đúng vùng này — chạy lại kỹ. Không đụng `xp-rules.ts` (hằng số bị ghim ở `node-progress-rules.test.ts`, `skill-crowns.test.ts`).

---

## Đợt 2 — "Open redirect" ở auth callback → **DƯƠNG TÍNH GIẢ**

Audit gán `src/app/auth/callback/route.ts` là open redirect. **Đo lại thì không phải.**

`origin` luôn đứng trước và không có dấu `/` cuối, nên mọi `next` đều trở thành ĐƯỜNG DẪN trên chính host đó:

```
next="//evil.com"        → https://app.example.com//evil.com    host=app.example.com
next="///evil.com"       → https://app.example.com///evil.com   host=app.example.com
next="/\evil.com"        → https://app.example.com/\evil.com    host=app.example.com
next="https://evil.com"  → https://app.example.comhttps://...   host=app.example.comhttps  (host không tồn tại)
```

Không payload nào thoát ra ngoài. **Phát hiện này đã sống sót qua vòng phản biện đối kháng mà vẫn sai** — ghi lại làm bằng chứng rằng kể cả mục "đã xác nhận" vẫn phải tự kiểm trước khi sửa.

**Đã làm (gia cố, KHÔNG phải vá lỗ hổng):** an toàn hiện tại dựa vào một bất biến NGẦM — đích được ghép bằng nối chuỗi sau một origin không có gạch cuối. Đổi sang `new URL(next, origin)`, một refactor trông vô hại, là `//evil.com` thoát ngay. Đã tách `safeNextPath()` để ràng buộc thành tường minh, kèm 14 test khoá lại.

---

## Đợt 3 — Toàn vẹn ghi DB

`forkTemplateCore` ghi hơn 10 bảng, docstring nói "in one transaction" nhưng **không có transaction nào**. ~290 round-trip tuần tự. Hỏng giữa chừng để lại workspace vỡ dở, không làm lại được, không xoá được.

**Sửa:** bọc `db.transaction`, gộp insert theo lô. Đo lại số round-trip trước/sau bằng log Postgres (`grep -cE 'ms +execute'`).

---

## Đợt 4 — FE: form không có trạng thái chờ

`ForkButton` gọi server action **ngoài** `startTransition` (truyền callback đồng bộ, promise bị vứt) → nút mở khoá ngay, bấm hai lần tạo hai workspace fork trùng; lỗi thành unhandled rejection nên **không có thông báo nào**. Cùng lỗi ở form onboarding.

**Sửa:** `startTransition(async () => { try { await ... } catch { toast } })` — đúng khuôn mà `rename-workspace-form.tsx` đang dùng.

---

## Đợt 5 — FE: nút hứa việc không làm ✅ XONG

User chọn: **gỡ 3, nối 1 vào bản thật.**

Đo trước khi làm cho ra bức tranh nặng hơn báo cáo audit:

| Thành phần | Trạng thái trước |
|---|---|
| `pref:sound` / `pref:reduced-motion` / `pref:lang` | ghi localStorage, **0 nơi đọc**, không có tính năng phía sau |
| `pref:daily-goal` | ghi localStorage, **0 nơi đọc** |
| `user_planner_settings.dailyGoalXp` | ✅ có trong DB, khoá theo (workspace, user) |
| `updatePlannerSettings(...)` | ✅ action hoàn chỉnh, đã validate (min 10, max 1000) |
| UI gọi action đó | ❌ **không có nơi nào** |
| `/daily` | chỉ **hiện** mục tiêu, không có nút đổi |

Tức mục tiêu XP của **mọi người dùng** kẹt vĩnh viễn ở mặc định 60: có nút bấm thì nút không nối vào đâu, có đường thật thì đường không có nút.

**Đã làm:**
- Gỡ sound / reduced-motion / language khỏi `/settings`, gỡ luôn nút "Clear preferences" (không còn key nào để xoá).
- Dựng `DailyGoalPicker` đặt ở `/w/[slug]/daily` — **không** ở `/settings`, vì bảng khoá theo (workspace, user) mà `/settings` là trang toàn cục nên không có workspace để ghi vào.
- Mốc XP chuyển vào `lib/learn/xp-rules.ts` (`DAILY_GOAL_PRESETS`). Không đặt trong `actions/daily-planner.ts` được: file `'use server'` chỉ được export hàm async.

**Guard bắt lỗi của chính bản vá:** `guard-no-hardcode` chặn 4 con số XP viết thẳng trong component. Không thêm dòng miễn trừ — chuyển sang `xp-rules.ts` là chỗ đúng.

**Chứng minh:** 6 test, gỡ bản vá ra thì **5/6 đỏ** (cả nhánh gỡ lẫn nhánh nối). Kiểm live `/daily`: 4 nút `aria-pressed` render đủ nhãn.

---

## Đợt 6 — Truy vấn & index

- `evaluateBadges` chạy 1-5 truy vấn cho **từng** huy hiệu trong vòng lặp (12 huy hiệu/workspace)
- `awardCrowns` một SELECT + một ghi cho **từng** kỹ năng, tăng crowns bằng đọc-sửa-ghi (mất lượt khi hai tab)
- Trang `/daily` kéo **toàn bộ** lịch sử `xp_events` rồi lọc "hôm nay" bằng JS
- `sitemap.xml` một truy vấn cho **từng** workspace công khai
- `exercises` / `labs` / `modules` **không có index nào** ngoài khoá chính

Luật đo: production build, warm-up trước, đếm `execute` bằng `grep -cE 'ms +execute'`. Số query mỗi route phải là **hằng số**, không tăng theo số node.

---

## Đợt 7 — Trùng lặp & code chết

- ~650 dòng: 7 component không còn ai render (4 biểu đồ + thẻ node)
- Cả một tầng gọi API (`lib/api` + `hooks/queries` + 5 route) là code chết
- `slugify` chép nguyên văn ở 2 file, lệch một ký tự là mục lục gãy
- Truy vấn ma trận kỹ năng chép 3 bản, `ORDER BY` lệch nhau → thứ tự màn hình khác thứ tự file export
- Xác thực workspace còn 2 bản chép tay ngoài `resolveWorkspace()`

Ưu tiên **trùng lặp nghiệp vụ** (sửa một chỗ quên chỗ kia) hơn trùng lặp kỹ thuật.

---

## Đợt 8 — Phủ test còn lại

- `getOrGenerateDailyPlan` 737 dòng: **0 test**, trong khi `planDay` (lỗi hơn) có 6
- Luồng cấp chứng nhận: 3 test chỉ phủ hàm sinh mã ngẫu nhiên, bất biến thật không ai kiểm
- Hai bất biến "không được đụng tới owner" ở `/members` không có test — gỡ nhầm là workspace mất chủ
- `smoke.spec.ts` chỉ kiểm 3/6 route công khai
- `admin-nav.test.ts` tự khẳng định hằng số bằng chính hằng số — không phát hiện được lệch

---

## Ngoài phạm vi đã chốt

User chốt "chỉ fix + tối ưu, chưa bàn public". Ghi lại để không quên:

- Node 18 đang chạy trong khi `package.json` khai `>=20` (Supabase đã cảnh báo deprecated)
- `drizzle/` **không có file migration nào** — schema không versioned
- `ENOSPC: file watchers` giới hạn 128 instance — làm `next dev` mất hot-reload
