# 🗺️ LỘ TRÌNH ĐẾN EXPERT APPLICATION — Competency Framework (DevOps Mastery)

> Cập nhật: 2026-08-19 · Sau đợt audit + fix critical + V2 rebrand (Innocom) + workspace theming
> Mục tiêu: từ sản phẩm cá nhân (~90%) → **Expert Application dùng thật cho team, mở public** (100%)

---

## 📊 VỊ TRÍ HIỆN TẠI

| Giai đoạn | Trạng thái |
|---|---|
| MVP cá nhân (chạy được, data thật) | ✅ 100% |
| Sản phẩm cá nhân chất lượng cao | ✅ ~90% |
| **Expert Application** | 🔶 **~55-60%** |

### Điểm theo chiều (audit 2026-08-19)

| Chiều | Điểm | Điểm yếu chính còn lại |
|---|---|---|
| Logic đúng đắn | 8.5/10 | empty catch rename, evidence approved không persist, fork chưa transaction |
| UI/UX flows | 7/10 | thiếu resume, undo, i18n, share banner, empty states |
| Customization | 8.5/10 | chưa custom per node-type / level label / framework mới |
| Bảo mật production | 6/10 | Supabase placeholder + dev bypass, chưa rate-limit |
| Testing | 6/10 | 0 test cho 20 server actions (~5.7k LOC), 1 e2e |
| Performance | 5/10 | 160 node render 1 lần, framer ship mọi route, N+1 |
| Content engine | 4/10 | AI-generate仍是 stub |
| Observability | 2/10 | không Sentry/log/audit-alert |

### Đã hoàn thành (tổng kết)
- ✅ Fix toàn bộ critical: XP farm, hearts/streak race, bonus re-award, crowns double, timezone VN
- ✅ Fix authz: split-brain API/actions, follow private, owner guard, LEARNER toggle
- ✅ Tree integrity: re-open parent, atomic swap, dọn orphan progress
- ✅ Error: 11 mã mới, chặn leak raw message, INCOMPLETE_CHILDREN → 409 structured
- ✅ V2 brand Innocom: tokens, utilities, landing, sidebar, topbar CTA "Học ngay"
- ✅ UX: sibling nav 1/12 + progress, onboarding checklist, node card states
- ✅ Workspace theming: emoji + accent color picker (palette whitelist), áp per-workspace
- ✅ 88/88 tests · typecheck sạch · no-mock/no-hardcode guards

---

## 🚀 PHASE 1 — CUSTOMIZATION "MỌI THỨ" (+10%) · ~1 tuần

> Mục tiêu: chủ workspace tự định hình toàn bộ diện mạo + cấu trúc, không cần đụng code.

### 1.1 Node-type icon + color picker
- [x] Mở rộng `workspace-theme.ts` → bảng `node_type_appearance` (workspaceId, nodeType, icon, color)
- [x] UI trong Settings → "Loại node": grid emoji + palette màu (accordion) (tái dùng component vừa làm)
- [ ] Áp vào: `NodeCard` TYPE_META (override), roadmap circle `.rm-circle`, TOC, breadcrumb
- [x] Server action saveNodeTypeAppearance + whitelist + audit log

### 1.2 Custom level labels
- [ ] Framework Editor → Levels: cho sửa label hiển thị (XS→"Fresher", M→"Senior"…)
- [x] LevelEditor trong Settings + LevelBadge dùng nhãn DB (showLabel ở table) (badge, drawer, gap radar)
- [ ] Giữ `code` làm key nội bộ, không đổi

### 1.3 Category color xuyên suốt
- [x] CategoryColorEditor trong Settings; chips active + badge + drawer đều dùng màu: skills table row accent, dashboard chips, drawer tag
- [ ] Contrast check tự động (đen/trắng text theo luminance)

### 1.4 Framework import wizard
- [x] Import wizard /w/[slug]/import: dán markdown PHASE → phase + weeks tree (test thật 5 tuần)
- [x] Tách parseMarkdownPhaseText cho input text, giữ parse file cũ
- [ ] Cho phép fork framework public khác làm điểm khởi đầu

**Điều kiện hoàn thành:** đổi icon/màu node-type + label level từ UI, refresh vẫn giữ; import 1 framework markdown mới thành công.

---

## 🧠 PHASE 2 — UX "DỄ DÙNG, THÂN THIỆN" (+8%) · ~1 tuần

### 2.1 Resume "Tiếp tục học"
- [ ] Dashboard hero card: node đang dở gần nhất (query `user_node_progress` where status='in_progress' order by updatedAt desc limit 1) + nút "Vào học ngay"
- [ ] Topbar CTA "Học ngay" trỏ về node đó thay vì /daily khi có

### 2.2 Undo các thao tác nguy hiểm
- [ ] Toast 5s undo sau: xoá node (soft-delete cột `deletedAt` trước khi hard), đổi self-assess, move node
- [ ] Soft-delete node + khôi phục trong trash 7 ngày

### 2.3 Polishing đồng bộ
- [ ] Share view banner "🔍 Chế độ chỉ đọc — đăng nhập để học" (đang thiếu)
- [ ] Format `~480p` → `~8 giờ`; `~8p` → `~8 phút`
- [ ] Empty state chuẩn cho: comments, resources, labs, daily (component EmptyState có sẵn)
- [ ] Skeleton loading đồng bộ mọi trang (loading.tsx đã có 4 chỗ — bổ sung)
- [ ] Keyboard: `j/k` navigate node, `/` focus search, `d` toggle done

### 2.4 i18n nền tảng
- [ ] Quyết định ADR: vi-only hay next-intl
- [ ] Nếu vi-only: dọn chỗ lẫn English (placeholder search, settings labels)
- [ ] Nếu next-intl: extract string → messages/vi.json (kho ~300 string)

**Điều kiện hoàn thành:** người mới không cần hướng dẫn vẫn biết next-step; mọi destructive action có undo.

---

## ⚡ PHASE 3 — PERFORMANCE (+10%) · ~1.5 tuần

### 3.1 Dashboard 160 node
- [ ] Mặc định chỉ expand phase đang học, các phase còn lại collapse + "Xem tất cả"
- [ ] Hoặc `next/dynamic` + IntersectionObserver lazy-render từng phase
- [ ] Đo: LCP < 2.5s trên 4G (hiện chưa đo — thêm suất measure trước/sau)

### 3.2 Bundle
- [ ] `next/dynamic` cho recharts (chỉ profile/dashboard cần), confetti
- [ ] page-transition: thay framer bằng CSS animation → framer rời khỏi layout bundle
- [ ] `optimizePackageImports` trong next.config
- [ ] Xóa dead deps: zustand, @tanstack/react-virtual (hoặc dùng thật cho skills table)

### 3.3 Query
- [ ] Phân trang comments (cursor-based) + activity feed
- [ ] `awardCrowns` N+1 → 1 query批量 + 1 UPDATE...FROM
- [ ] Ancestor cascade N+1 trong toggleNodeDone → 1 query inArray
- [ ] Index thiếu: `modules (workspace_id, week_id)`

### 3.4 Streaming
- [ ] `<Suspense>` từng card dashboard (hero/stats trước, radar/heatmap stream sau)

**Điều kiện hoàn thành:** Lighthouse performance ≥ 85 trên dashboard; TTI mobile < 3.5s.

---

## 🔐 PHASE 4 — PRODUCTION READINESS (+12%) · ~2 tuần · **ĐIỀU KIỆN BẮT BUỘC TRƯỚC KHI MỜI NGƯỜI NGOÀI**

### 4.1 Auth thật
- [ ] Tạo Supabase project thật, replace placeholder trong `.env`
- [ ] Magic link + Google OAuth flow end-to-end
- [ ] Bỏ `DEV_AUTH_BYPASS_USER_ID` (giữ flag chỉ hoạt động khi `NODE_ENV≠production` — đã đúng gate)
- [ ] Session refresh middleware, cookie security review

### 4.2 Observability
- [ ] Sentry (browser + server) — dsn qua env
- [ ] Structured logger thay 3 console.error (pino, level theo env)
- [ ] `writeAudit` fail → KHÔNG nuốt: log ERROR + metric đếm
- [ ] Request-id propagation

### 4.3 Hardening
- [ ] Rate limit server actions (per-user + per-IP, upstash hoặc in-memory LRU cho MVP)
- [ ] Zod mọi action input (thanh tra lại — đa số có rồi, bổ túk chỗ thiếu)
- [ ] CSP headers, `X-Frame-Options` (share view cần allowlist)
- [ ] Secret scan CI (gitleaks)

### 4.4 Test đền bù nợ
- [ ] Unit test RBAC cho 20 server actions (bảng test matrix: role × action → pass/deny)
- [ ] Playwright e2e 5 luồng: onboarding → assess → học node → share → follow
- [ ] CI GitHub Actions: guard + typecheck + lint + test + build (chưa có CI!)

**Điều kiện hoàn thành:** deploy Vercel + Supabase cloud, một người ngoài tự đăng nhập và học mà không gặp lỗi; CI xanh.

---

## 🤖 PHASE 5 — CONTENT ENGINE (+7%) · ~1.5 tuần

### 5.1 AI sinh nội dung thật
- [ ] Wire Anthropic SDK (`ANTHROPIC_API_KEY` env) thay stub trong `ai-generate.ts`
- [ ] Prompt template theo lesson context + skill mapping, prompt caching
- [ ] Validate JSON response bằng Zod (frameworkPayloadSchema exerciseSeed đã có)
- [ ] **Review queue**: bài AI sinh ra ở trạng thái `draft`, editor duyệt rồi mới publish

### 5.2 Spaced repetition
- [ ] Bật `review_schedules` (bảng đang dead): schedule ôn tập SM-2 đơn giản theo crown/level
- [ ] Daily Planner trộn bài ôn vào task hằng ngày

### 5.3 Đo hiệu quả học tập
- [ ] Dashboard "confidence thực" = f(attempts đúng/sai, evidence verified) thay vì chỉ self-report

**Điều kiện hoàn thành:** sinh 5 exercise AI cho 1 lesson, editor duyệt, học viên làm bài — đủ vòng kín.

---

## 📈 SAU 5 PHASE — CONG ĐƯỜNG DÀI (optional, theo traction)

- Multi-org thật (org → nhiều workspace, billing theo seat)
- Template marketplace (framework public fork có attribution)
- Certificate render PDF sau khi hoàn thành track (bảng exportJobs đang dead)
- Cohort mode (team lead assign roadmap + deadline cho nhóm)
- Mobile PWA offline-first cho lesson

---

## 🧾 NGUYÊN TẮC XUYÊN SUỐT (áp cho mọi phase)

1. **Comment phải nói thật code** — tìm thấy 4 chỗ comment/code lệch, cấm lặp lại
2. **Mọi write nghi ngờ**: idempotent + atomic (pattern insertXpOnce / conditional UPDATE)
3. **Guard không thay được test**; test không thay được e2e
4. **Thêm tính năng = thêm ADR** (docs/adr/): quyết định lớn phải ghi lý do
5. Mỗi phase xong: cập nhật lại bảng điểm ở đầu file này

*Tài liệu này là nguồn sự thật cho lộ trình — cập nhật sau mỗi phase.*
