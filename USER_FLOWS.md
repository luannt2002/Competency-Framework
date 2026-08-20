# User Flows — Toàn bộ luồng chi tiết

---

## Nhân vật

| Nhân vật | Họ là ai | Mục tiêu trong platform |
|---|---|---|
| **Learner** | Cá nhân muốn học bất cứ thứ gì | Theo dõi tiến độ, không lạc đường |
| **Creator** | Giáo viên, mentor, expert | Tạo lộ trình, share, biết ai đang stuck |
| **Admin** | Team lead, HR, giáo viên chủ nhiệm | Giao lộ trình, theo dõi cả nhóm |
| **Viewer** | Người chưa đăng ký, xem public | Khám phá, quyết định có đăng ký không |

---

## Flow A — Viewer khám phá (không cần login)

```
Điểm vào: share link, blog post, LinkedIn share, /discover
         ↓
/share/[workspace-slug]
    Thấy: tên lộ trình + mô tả
          cây node (tất cả level)
          badge: X nodes, Y% người hoàn thành
          danh sách resource của từng node (xem)
          tiến độ của creator (demo)
    Không thấy: tiến độ cá nhân của mình (chưa login)
         ↓
Có thể:
    → Click vào từng node → đọc nội dung, xem resources
    → Cuộn xuống → thấy "Fork roadmap này" CTA
    → Thấy OG image đẹp khi share tiếp
         ↓
Quyết định:
    A. Đủ hấp dẫn → click "Fork" / "Bắt đầu học" → đăng ký
    B. Chưa thuyết phục → thoát (bounce)
```

**Quan trọng:** Viewer phải thấy đủ giá trị mà không cần đăng ký. Đây là front door của platform.

---

## Flow B — Learner mới đăng ký và bắt đầu

### B1. Đăng ký

```
/sign-in
    Option 1: Email magic link
        → Nhập email → "Kiểm tra hộp thư"
        → Click link trong email → redirect vào app
    Option 2: Google OAuth
        → Click "Continue with Google"
        → Google auth flow
        → Redirect /auth/callback → vào app
         ↓
Lần đầu đăng ký → /onboarding
```

### B2. Onboarding (chỉ lần đầu)

```
/onboarding — 3 bước

Bước 1: Chọn cách bắt đầu
    [A] Fork roadmap từ cộng đồng
        → Xem danh sách roadmap public nổi bật
        → Click fork → tạo bản copy riêng
    [B] Tạo workspace trống
        → Bắt đầu từ zero, tự build cây

Bước 2: Đặt tên workspace
    → Nhập tên (ví dụ: "Lộ trình học của tôi")
    → Confirm

Bước 3: Done!
    → Confetti animation
    → "Bắt đầu học ngay" → /w/[slug]
```

### B3. Dashboard ngày học

```
/w/[slug] — trang chính mỗi ngày

Header stats:
    [XX% hoàn thành] [🔥 Streak 7 ngày] [⭐ 2,340 XP] [❤️ 5/5 hearts]

Main content:
    → "Tiếp tục từ chỗ bạn dừng" — node gần nhất đang làm dở
    → Cây roadmap toàn bộ (tree visualization)
        └─ Mỗi node hiện trạng thái: ○ todo | ◑ doing | ● done
    → Quick actions: Ghi chú hôm nay | Tới Daily Planner

Sidebar:
    → Recent activity
    → Upcoming: nodes tiếp theo chưa làm
    → Skills summary: bao nhiêu skill đã có
```

### B4. Học một node

```
Click vào node bất kỳ → /w/[slug]/n/[node-slug]

Trang node hiện:
    ├─ Title + description
    ├─ Body content (Markdown rendered)
    ├─ Resources panel:
    │   ├─ [Video] link video bài giảng
    │   ├─ [Doc] link tài liệu đọc thêm
    │   ├─ [Tool] link tool cần dùng
    │   └─ [Lab] link bài thực hành
    ├─ Children nodes (nếu có — phải làm con trước)
    └─ Action panel:
        ├─ [Đang học] — set status = doing
        ├─ [Gắn evidence] — paste URL bằng chứng
        ├─ [Đánh dấu xong] — mark done (cần evidence)
        └─ [Viết journal] — ghi chú học được gì

Logic khi click "Đánh dấu xong":
    IF có children chưa done:
        → Lỗi: "Hoàn thành X mục con trước"
    ELSE IF không có evidence:
        → Prompt: "Thêm link bằng chứng" (optional hoặc required — config của creator)
    ELSE:
        → Confetti + XP popup
        → Parent node progress cập nhật tự động
        → Nếu tất cả sibling done → parent cũng done
        → Badge check: có earn badge mới không?
```

### B5. Daily Planner

```
/w/[slug]/daily

AI gợi ý 3-5 task cho hôm nay dựa trên:
    ├─ Nodes đang "doing" (ưu tiên hoàn thành dở)
    ├─ Skill yếu nhất trong skills matrix
    ├─ Streak keeper: 1 task nhẹ để không mất streak
    └─ Tiến độ so với timeline (nếu có deadline)

UI:
    [Task 1] Đọc bài "X" (est. 20 phút)   [✓ Done] [Skip]
    [Task 2] Làm bài tập "Y" (est. 45 phút) [✓ Done] [Skip]
    [Task 3] Ôn lại "Z" hôm qua (est. 10 phút) [✓ Done] [Skip]

    + Add custom task

Khi tick done:
    → +XP ngay lập tức
    → Streak cập nhật
    → Chuyển sang task tiếp theo
```

### B6. Skills Matrix

```
/w/[slug]/skills

Hiện bảng:
    Category        | Skill          | Level | Source      | Crowns
    ─────────────────────────────────────────────────────────────
    [Category A]    | [Skill 1]      | M     | learned     | ●●●○○
                    | [Skill 2]      | XS    | self_claimed| ●○○○○
    [Category B]    | [Skill 3]      | —     | —           | ○○○○○

Click vào row → drawer mở:
    ├─ Chọn level: XS / S / M / L
    ├─ Source: self_claimed (tự đánh giá)
    ├─ Gắn evidence URL
    └─ Save → source = 'self_claimed'

Khi hoàn thành lesson liên kết với skill:
    → Level source tự động = 'learned'
    → Crowns++ tự động

Khi được admin/creator verify:
    → Source = 'verified'
    → Crown color thay đổi (gold)
```

### B7. Share tiến độ

```
/share/[slug] (PUBLIC — không cần login)

Người học có thể share link này lên:
    → LinkedIn: "Tôi đang học theo lộ trình này"
    → Blog: embed progress widget
    → Portfolio: link bằng chứng kỹ năng

OG Image tự động (1200x630):
    → Tên lộ trình
    → % tiến độ
    → Số skill đã đạt
    → Avatar + tên người học
```

---

## Flow C — Creator tạo và publish lộ trình

### C1. Tạo workspace mới

```
Dashboard → "+ Tạo lộ trình mới"
    → Nhập:
        Tên: "Lộ trình học [bất kỳ chủ đề gì]"
        Slug: auto-gen từ tên (có thể sửa)
        Mô tả: 1-2 câu giới thiệu
    → Create → redirect /w/[slug] (empty state)
```

### C2. Xây cây node

```
/w/[slug] (empty state)
    → Click "Tạo node đầu tiên" → /w/[slug]/new

Form tạo root node:
    ├─ Type: [course | phase | week | lesson | lab | project | milestone | exam | reading | video | tool]
    ├─ Title: tên node
    ├─ Description: mô tả ngắn
    ├─ Body (Markdown): nội dung đầy đủ
    └─ Est. minutes: thời lượng ước tính

Submit → redirect /w/[slug]
    → Thấy root node vừa tạo

Thêm node con:
    → Click vào root node → node detail page
    → "Thêm bước con" button
    → Form tạo child node (giống trên, parentId = root)
    → Repeat cho đến khi cây đủ

Kết quả cây ví dụ (domain-agnostic):
    [Tên chương trình]
    ├─ [Giai đoạn 1 — Nền tảng]
    │   ├─ [Bước 1.1 — Khái niệm cơ bản]
    │   ├─ [Bước 1.2 — Thực hành đầu tiên]
    │   └─ [Checkpoint 1 — Bài kiểm tra]
    ├─ [Giai đoạn 2 — Nâng cao]
    │   └─ ...
    └─ [Giai đoạn 3 — Dự án thực tế]
        └─ ...
```

### C3. Thêm nội dung vào từng node

```
Node detail → Edit:
    Body Markdown:
    ┌───────────────────────────────────────┐
    │ ## Mục tiêu                           │
    │ Sau bước này bạn sẽ:                  │
    │ - Hiểu được X                         │
    │ - Làm được Y                          │
    │                                       │
    │ ## Nội dung                           │
    │ [Viết hoặc embed content]             │
    │                                       │
    │ ## Bài tập                            │
    │ [Hướng dẫn cụ thể]                   │
    └───────────────────────────────────────┘

Resources:
    + Add resource:
        Type: video / doc / tool / lab / link
        URL: [paste URL]
        Title: tự fetch từ URL hoặc tự điền

Est. minutes: 30  ← thời lượng thực hiện
```

### C4. Publish và share

```
/w/[slug]/settings:
    Visibility:
        ○ Private (chỉ mình xem)
        ● Public read-only (ai cũng xem, không cần login)
        ○ Private — member only (cần invite)

    Save → workspace public ngay lập tức

/share/[slug] live:
    → Copy link → paste lên bất cứ đâu
    → Viewer thấy đẹp, không cần login
    → Button "Fork lộ trình này" → viral
```

### C5. Theo dõi analytics

```
/w/[slug]/audit:
    ├─ Ai đang học roadmap này (members)
    ├─ Từng thành viên: % completion, last active
    ├─ Nodes nào có nhiều người stuck (drop-off)
    └─ Skills distribution: team đang strong/weak ở đâu

Action từ insight:
    → Node X có 80% người bỏ qua → cải thiện nội dung bài đó
    → Skill Y 70% self_claimed, 0% verified → cần thêm bài kiểm tra
    → Member Z không active 7 ngày → gửi reminder
```

---

## Flow D — Admin quản lý team học tập

### D1. Setup workspace team

```
Admin tạo workspace:
    → Tạo hoặc fork template
    → Visibility: Private — member only
    → Tên: "Training Q1-2026 — [Tên team]"
```

### D2. Invite thành viên

```
/w/[slug]/members:

    + Invite member:
        ├─ Nhập email (hoặc bulk import CSV)
        ├─ Role:
        │   ├─ learner: chỉ học, không sửa roadmap
        │   ├─ editor: sửa được roadmap
        │   └─ owner: full quyền
        └─ Send invite

Member nhận email:
    → Click link → tạo account nếu chưa có
    → Auto-join workspace → thấy roadmap ngay
    → Mỗi member có progress riêng biệt
```

### D3. Theo dõi tiến độ toàn team

```
/w/[slug]/roster:

    Bảng tổng quan:
    Name        | Progress | Last Active | At Risk
    ─────────────────────────────────────────────
    [Member A]  | 78%      | Hôm nay     | ○
    [Member B]  | 34%      | 3 ngày trước| ● ← cần chú ý
    [Member C]  | 91%      | Hôm qua     | ○

    Skills gap matrix:
    Skill         | Team avg | Strong | Weak
    ─────────────────────────────────────────
    [Skill 1]     | M        | 8/10   | 2/10
    [Skill 2]     | XS       | 1/10   | 9/10 ← action needed

    Export:
    → Excel: progress chi tiết từng người
    → PDF: báo cáo tổng quan cho manager
```

### D4. Assign task cho member cụ thể

```
Click vào member → member profile:
    ├─ Progress chi tiết từng node
    ├─ Skills matrix của riêng họ
    ├─ Activity log: làm gì, khi nào
    └─ Actions:
        ├─ "Giao thêm task" → suggest node specific
        ├─ "Nhắc nhở" → gửi notification
        └─ "Verify skill" → confirm level của họ
```

---

## Flow E — Forking và cộng đồng

```
Mục tiêu: Người học lấy roadmap có sẵn, customize về của mình
```

### E1. Khám phá

```
/discover:
    ├─ Filter: domain / số node / phổ biến / mới
    ├─ Mỗi card: tên + mô tả + số node + số fork
    └─ Click → /share/[slug] (xem trước)
```

### E2. Fork

```
/share/[slug]:
    → Click "Fork về của tôi"
    → (Đăng nhập nếu chưa)
    → Chọn tên workspace mới
    → Tạo bản copy độc lập:
        ├─ Toàn bộ cây node được copy
        ├─ Resources được copy
        ├─ Nội dung được copy
        └─ Progress = trống (bắt đầu từ 0)
```

### E3. Customize fork

```
/w/[new-slug]:
    Creator gốc không thể thấy thay đổi của bạn.
    Bạn hoàn toàn sở hữu fork của mình.

    Có thể:
    → Xóa node không phù hợp với mình
    → Thêm node mới theo nhu cầu
    → Đổi thứ tự
    → Gắn resource khác
    → Chia sẻ fork của mình (nếu đủ hay)
```

---

## Flow F — Gamification chi tiết

### XP (Experience Points)

```
Kiếm XP:
    ├─ Mark node done: +10 XP (leaf) | +50 (level 2) | +200 (level 1) | +500 (root)
    ├─ Streak daily: +5 XP
    ├─ Streak 7 ngày: +50 bonus
    ├─ Streak 30 ngày: +300 bonus
    ├─ Badge earned: +25 XP
    └─ Skill verified: +30 XP

Mất XP:
    → Không có (XP chỉ tăng, không bao giờ giảm)
    → Hearts là resource có thể mất thay vì XP
```

### Hearts (Công cụ duy trì thói quen)

```
Max 5 hearts
    ├─ Mỗi ngày không học: -1 heart (khi mở app)
    ├─ Skip task trong daily planner: -0.5 heart
    └─ 0 hearts: cần nghỉ 1 ngày hoặc refill

Refill hearts:
    ├─ Tự động sau 4 giờ: +1 heart
    ├─ Ôn bài cũ: +1 heart
    └─ Trong tương lai: Pro users có unlimited hearts
```

### Streaks

```
Streak = số ngày liên tiếp có hoạt động học

Quy tắc:
    ├─ Cần ít nhất 1 node mark done HOẶC 1 daily task done
    ├─ Reset về 0 nếu không có hoạt động trong ngày
    └─ Múi giờ: theo múi giờ account (tránh reset lúc nửa đêm bất ngờ)

Milestone streak badges:
    3 ngày  → First Streak
    7 ngày  → Weekly Warrior
    30 ngày → Monthly Master
    100 ngày → Century Learner
```

### Badges

```
Badge system dựa trên rules JSON:
    {
      "id": "first_completion",
      "name": "First Step",
      "description": "Hoàn thành bước đầu tiên",
      "rule": { "nodes_done": { "gte": 1 } },
      "xp_reward": 25
    }

Creator tạo custom badge cho workspace của mình:
    → Badge "Hoàn thành Phase 1"
    → Badge "Streak 7 ngày trong workspace này"
    → Badge "Tất cả skill level M trở lên"
```

### Crowns (per Skill)

```
Mỗi skill có 0-5 crowns:
    ├─ Crown earn khi hoàn thành lesson liên kết skill
    ├─ 5 crowns = mastered
    └─ Crown color: gray (self_claimed) | blue (learned) | gold (verified)
```

---

## Flow G — Certificate

```
Khi hoàn thành ≥ 80% workspace:
    → Notification: "Bạn đủ điều kiện nhận Certificate"
    → /w/[slug]/certificate

Certificate bao gồm:
    ├─ Tên người học
    ├─ Tên lộ trình
    ├─ Ngày hoàn thành
    ├─ % hoàn thành
    ├─ Danh sách skills đã đạt
    └─ QR code verify (link về /share/[slug])

Export:
    → PDF đẹp (A4 landscape)
    → Share link online: /cert/[unique-id]
    → Badge image: paste lên LinkedIn, Twitter

Verify:
    → Employer click link → thấy progress thực tế
    → Không thể fake (data trong DB)
```

---

## State transition map — Node progress

```
[todo]
  │
  ├── User click "Bắt đầu học"
  │
  ▼
[doing]
  │
  ├── User gắn evidence URL
  ├── User viết journal (optional)
  ├── User mark done
  │   ├── IF children not all done → BLOCKED (lỗi)
  │   └── IF ok → transition
  │
  ▼
[done]
  │
  ├── XP earned
  ├── Streak update
  ├── Badge check
  ├── Parent progress recalculate
  └── Skill level update (nếu có skill link)

Un-done:
  done → todo (creator có thể reset)
  → Cascade: parent un-done nếu trước đó đã done
```

---

## Error States và Empty States

```
Workspace empty (mới tạo, chưa có node):
    → Hiện illustration + "Tạo bước đầu tiên"
    → Button → /w/[slug]/new
    → KHÔNG hiện placeholder data

Skills matrix empty (chưa define skill nào):
    → Hiện "Creator chưa thêm skills matrix"
    → KHÔNG hiện fake skill rows

Daily planner empty (không có suggestion):
    → Hiện "Không có gợi ý hôm nay"
    → Button "Thêm task thủ công"

Auth error:
    → /sign-in?error=auth_failed
    → Hiện "Đăng nhập thất bại, thử lại"
    → KHÔNG silent fail

Node not found:
    → 404 page đẹp với "Quay về dashboard"
```
