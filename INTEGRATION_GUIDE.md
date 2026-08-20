# Integration Guide — Roadmap + LMS + Games

> Hướng dẫn tích hợp Competency Framework với các hệ thống bên ngoài
> để tạo ra sản phẩm học tập hoàn chỉnh hơn.

---

## 1. Tổng quan tích hợp

```
External Systems ──────────────┐
                                ▼
YouTube / Vimeo          ┌─────────────────────────────┐
LeetCode / HackerRank    │   COMPETENCY FRAMEWORK      │
Killercoda / K8s Play   ─┤   (Roadmap + Progress)      │
Google Forms / Quizlet   │                             │
GitHub / GitLab          │   ┌─────────┐  ┌─────────┐ │
Notion / Google Docs     │   │  TREE   │  │ SKILLS  │ │
Stripe / VNPay           │   │  NODES  │  │ MATRIX  │ │
Slack / Discord          └───┴─────────┴──┴─────────┘─┘
```

---

## 2. Content Integration (Gắn nội dung ngoài vào node)

### 2.1 YouTube / Video
```yaml
Node type: lesson
Body markdown:
  ## Video bài giảng
  <iframe width="100%" height="400"
    src="https://www.youtube.com/embed/VIDEO_ID"
    frameborder="0" allowfullscreen>
  </iframe>

  ## Tóm tắt nội dung
  - Điểm 1
  - Điểm 2

Resources:
  - type: video
    url: https://youtube.com/watch?v=VIDEO_ID
    title: "Tên video tự fetch từ OG"
```

**Flow:**
1. Creator paste YouTube link vào Resources
2. System tự fetch title + thumbnail từ OpenGraph
3. Learner click → mở YouTube trong tab mới
4. Xem xong → quay lại → gắn timestamp "Đã xem đến 12:34" làm evidence
5. Mark done → XP

### 2.2 GitHub Repository / Code
```yaml
Node type: project
Body markdown:
  ## Yêu cầu
  - Fork repo: https://github.com/trainer/starter-project
  - Implement các TODO trong code
  - Push solution lên GitHub của bạn

Evidence expected:
  - Link GitHub repo solution của bạn
  - Link Pull Request (nếu có review)
  - Screenshot test pass
```

**Flow:**
1. Creator tạo starter repo trên GitHub
2. Gắn link vào node
3. Learner fork repo → implement → push
4. Paste link solution repo làm evidence
5. Creator (hoặc AI) review → mark "verified"

### 2.3 Coding Challenge (LeetCode / HackerRank)
```yaml
Node type: exam
Title: "Bài tập: Two Sum + Valid Parentheses"
Body markdown:
  ## Challenge 1
  Giải bài [Two Sum](https://leetcode.com/problems/two-sum/) trên LeetCode

  ## Challenge 2
  Giải bài [Valid Parentheses](https://leetcode.com/problems/valid-parentheses/)

Evidence:
  - Screenshot solution accepted
  - Link submission (nếu public)
  - Time complexity analysis (viết comment)
```

### 2.4 Interactive Lab (Killercoda / Play with K8s)
```yaml
Node type: lab
Title: "Lab: Deploy app lên Kubernetes"
Body markdown:
  ## Môi trường
  Dùng [Killercoda K8s Playground](https://killercoda.com/playgrounds/scenario/kubernetes)

  ## Yêu cầu
  1. Deploy nginx deployment với 3 replicas
  2. Expose qua Service NodePort
  3. Scale lên 5 replicas
  4. Update image version

Evidence:
  - Screenshot `kubectl get pods` với 5 pods running
  - Screenshot Service accessible
  - Ghi lại các command đã dùng
```

---

## 3. Assessment Integration (Kiểm tra kiến thức)

### 3.1 Google Forms Quiz
```
Setup:
    1. Creator tạo Google Form quiz
    2. Set "Collect email" = on
    3. Enable "Show score" + send to responder
    4. Gắn link form vào node

Learner flow:
    → Click link → làm quiz trên Google Forms
    → Nhận email kết quả (có score)
    → Copy link email hoặc screenshot
    → Paste làm evidence
    → Creator verify score > threshold → mark verified
```

### 3.2 Built-in Exercise Types (đã có trong code)
```typescript
// src/lib/db/schema.ts
export const exerciseKindEnum = pgEnum('exercise_kind', [
  'mcq',            // Multiple choice single
  'mcq_multi',      // Multiple choice multi
  'fill_blank',     // Fill in the blank
  'order_steps',    // Order the steps
  'type_answer',    // Type exact answer
  'code_block_review', // Code review
]);
```

**Add exercise vào lesson node:**
```
Node detail → Add Exercise:
    → Type: MCQ
    → Question: "Docker layer caching hoạt động như thế nào?"
    → Options: A, B, C, D
    → Correct: B
    → Explanation: "Vì..."
    → XP reward: 10

Learner:
    → Trả lời → Instant feedback
    → Correct → +10 XP
    → Wrong → -1 heart, explanation hiện ra
    → Retry cho đến khi đúng
```

### 3.3 Code Assessment (Judge0 - future)
```
Node type: code_challenge
    → Monaco Editor trong browser
    → User viết code
    → Click "Run" → gửi lên Judge0 API
    → Hidden test cases chạy
    → Pass = mark done + XP
    → Fail = error message + hint
```

---

## 4. LMS Integration

### 4.1 Competency Framework AS LMS
```
Tính năng LMS đã có:
    ✅ Course tree structure
    ✅ Student enrollment (workspace members)
    ✅ Progress tracking per student
    ✅ Assessment (exercises)
    ✅ Grading (evidence + verified)
    ✅ Certificate export
    ✅ Analytics (audit log)

Tính năng LMS chưa có (roadmap):
    ⏳ Video player built-in (hiện dùng link ngoài)
    ⏳ Assignment submission (hiện dùng evidence URL)
    ⏳ Rubric-based grading
    ⏳ Discussion forum per lesson
    ⏳ Live session scheduling
```

### 4.2 Embed Competency Framework vào LMS khác
```html
<!-- Embed roadmap vào Moodle / WordPress / LMS khác -->
<iframe
  src="https://your-app.com/share/[workspace-slug]"
  width="100%"
  height="800px"
  frameborder="0"
  title="Learning Roadmap">
</iframe>
```

### 4.3 Export để dùng ở LMS khác
```
/w/[slug]/settings → Export:
    ├─ JSON: full tree structure
    ├─ CSV: flat list of nodes
    ├─ SCORM 1.2: package cho Moodle/TalentLMS
    └─ xAPI/Tin Can: statements cho LRS

→ Import vào Moodle, TalentLMS, Cornerstone...
```

---

## 5. Social & Community Integration

### 5.1 Discord/Slack Notifications
```
Webhook setup:
    /w/[slug]/settings → Integrations → Discord/Slack:
    → Paste webhook URL
    → Events:
        ├─ User completes a milestone
        ├─ Someone new forks your roadmap
        ├─ New comment on a node
        └─ Weekly summary

Example Discord message:
    🎉 [Minh] vừa hoàn thành "Phase 2: Kubernetes" trong 
    DevOps Mastery roadmap! 🏆 +500 XP
    → https://app.com/w/devops-test/n/kubernetes-basics
```

### 5.2 LinkedIn Auto-post (future)
```
User completes roadmap → option to auto-post:
    "Tôi vừa hoàn thành lộ trình DevOps Mastery 2026 🎉
     286 nodes, 12 phases trong 8 tháng.
     Skills gained: AWS, Kubernetes, Terraform, CI/CD
     [Certificate link]
     [Roadmap link]"

→ Viral: mỗi completion = 1 LinkedIn post = exposure
```

### 5.3 GitHub Profile Integration
```
User link GitHub account:
    → Show completed projects trên profile
    → Auto-sync: push lên GitHub repo = evidence tự động

GitHub README integration:
    ![My Learning Progress](https://app.com/api/og/badge/[userId])
    → Dynamic badge hiện % completion
```

---

## 6. Payment Integration (Monetize)

### 6.1 Paid Roadmap (Workspace Subscription)
```
Creator setup:
    /w/[slug]/settings → Monetization:
    ├─ Visibility: Private (paid only)
    ├─ Price: 199k VND / tháng
    ├─ Payment via: Stripe / VNPay / MoMo
    └─ Free preview: 3 nodes đầu public

Learner flow:
    → /share/[slug] → thấy 3 nodes free
    → Click node 4 → "Unlock full course: 199k/tháng"
    → Pay → invited as workspace_member
    → Access full tree

Platform takes: 20% commission
Creator gets: 80%
```

### 6.2 One-time Purchase
```
Template marketplace:
    /discover → tab "Premium"
    ├─ "AWS Solutions Architect Pro" — 499k
    ├─ "IELTS 7.0 Study Plan" — 299k
    └─ "React Senior Developer Path" — 699k

Buy → fork permanently → học không hết hạn
```

### 6.3 B2B Team License
```
Enterprise deal:
    ├─ Unlimited seats
    ├─ Custom domain (training.company.com)
    ├─ SSO / SAML
    ├─ Advanced analytics
    ├─ Dedicated support
    └─ Price: 5-50tr/tháng tùy seat
```

---

## 7. API Integration (Developer)

### 7.1 REST API (future)
```
GET /api/v1/workspaces/:slug/tree
Authorization: Bearer <api_key>

Response:
{
  "workspace": { "name": "DevOps Mastery", "slug": "devops-test" },
  "tree": [
    {
      "id": "uuid",
      "title": "Phase 1: Foundational",
      "type": "phase",
      "depth": 1,
      "children": [...]
    }
  ]
}
```

### 7.2 Progress Webhook
```
POST https://your-system.com/webhook/roadmap-progress

Payload khi user mark node done:
{
  "event": "node.completed",
  "userId": "user-uuid",
  "workspaceSlug": "devops-test",
  "node": {
    "id": "node-uuid",
    "title": "Deploy EC2 with Terraform",
    "type": "lab",
    "completedAt": "2026-07-20T10:30:00Z"
  },
  "progress": {
    "totalNodes": 286,
    "completedNodes": 42,
    "percentComplete": 14.7
  }
}
```

### 7.3 Embed Widget (iframe)
```html
<!-- Minimal roadmap widget -->
<script src="https://app.com/embed.js"></script>
<div
  data-roadmap="devops-test"
  data-user="user-uuid"
  data-show="progress,streak"
  style="width: 100%; height: 500px">
</div>
```

---

## 8. Data Import / Migration

### 8.1 Import từ Notion
```
Tool: Notion export → Markdown files
Script: scripts/import-from-notion.ts

notion-export/
├─ Course.md          → root node (course)
├─ Week 1/
│   ├─ Lesson 1.md   → leaf node (lesson)
│   └─ Lab 1.md      → leaf node (lab)
└─ Week 2/
    └─ ...

Run:
pnpm tsx scripts/import-from-notion.ts \
  --workspace devops-test \
  --source ./notion-export
```

### 8.2 Import từ Markdown roadmap
```
Format:
# Java Mastery (course)
## Phase 1: Basics (phase)
### Week 1: Variables (week)
- [ ] Lesson: Data Types (lesson) [20min]
- [ ] Lab: Calculator (lab) [45min]
### Week 2: OOP (week)
...

Run:
pnpm tsx scripts/import-markdown.ts \
  --workspace my-java-course \
  --file ./java-roadmap.md
```

### 8.3 Import từ Google Sheets
```
Sheet format (tab "Nodes"):
| parent_title | title              | type    | est_min | url                | body            |
|-------------|-------------------|---------|---------|-------------------|-----------------|
|             | Java Mastery       | course  |         |                   | Khóa Java...   |
| Java Mastery| Phase 1: Basics   | phase   |         |                   |                 |
| Phase 1...  | Lesson: Variables  | lesson  | 20      | youtube.com/...   | ## Mục tiêu... |
| Phase 1...  | Lab: Calculator    | lab     | 45      | github.com/...    |                 |

Run:
pnpm tsx scripts/import-from-sheets.ts \
  --workspace my-java-course \
  --sheet "https://docs.google.com/spreadsheets/d/SHEET_ID"
```
