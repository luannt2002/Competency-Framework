# Report test — App "Lộ trình học tập" (Competency Framework)

> **Domain:** `suzuki-mighty-birmingham-boost.trycloudflare.com` (tunnel → localhost:3000 máy dev)
> **Ngày:** 2026-08-19 · **Loại:** app học-tập tree-first + RBAC 7-tier (Next.js), inspired roadmap.sh/Duolingo/Linear
> **Phạm vi:** 6 trục đo-thật + pentest L5 (non-destructive) + UI/UX-vision chấm bằng **Claude** (ai.innocom vision off)
> **Ghi chú:** app chạy qua tunnel (latency ~2.4s/req) — điểm Perf bị thổi phồng, trên local sẽ cao hơn.

## 1. SCORECARD

| Trục | Điểm | Đánh giá | Đo bằng |
|---|---|---|---|
| SEO | **90/100** 🟢 | Xuất sắc (Next.js SSR) | heuristic + Lighthouse-SEO |
| Accessibility | **90/100** 🟢 | Xuất sắc | axe-core impact-weighted |
| Security | **80/100** 🟢 | Khá (kéo xuống do thiếu header — xem §3) | cipher + CVE + pentest |
| UI/UX-vision | **70/100** 🟡 (L6) | TB-khá (Claude chấm, calibrate 166 khách) | Claude Code |
| Performance | **49/100** 🟡 | Thấp (nghi dev-build + tunnel) | PageSpeed v5 + CrUX |
| Ecommerce | N/A | Không phải shop (đúng) | — |
| **➤ OVERALL (5 trục)** | **76/100** 🟢 | **App TỐT** | weighted |

## 2. UI/UX-vision (Claude chấm) — 70/100

**11 chiều:** IA=7 · visual_hierarchy=8 · layout_spacing=6 · typography=8 · color_contrast=7 · consistency=6 · responsive=6 · accessibility=6 · content_clarity=8 · aesthetics=8 · conversion=7
- **Mạnh:** typography + aesthetics + content_clarity (landing sạch, hiện đại, copy rõ)
- **Yếu:** layout_spacing + consistency + responsive

**Lỗi UI thấy được:**
1. 🟡 **Icon vỡ** — 3 card "Tính năng cốt lõi" đều có ô vuông trống □ (icon không load) cạnh icon thật.
2. 🟡 **Landing mỏng** — chỉ 1 section rồi khoảng trống LỚN cuối trang. Nên thêm demo/pricing/social-proof.
3. 🟡 **Mất cân đối** — top-heavy, đáy rỗng.

## 3. Pentest (L5, non-destructive) — 8 finding, KHÔNG high/critical

**Bảo mật LÕI tốt** (no RCE/SQLi/IDOR ở bề mặt). Vấn đề = **hardening**:

| # | Finding | Mức | Fix |
|---|---|---|---|
| 1 | **Thiếu TẤT CẢ security header** (CSP/HSTS/X-Frame/X-Content-Type/Referrer/Permissions) | 🔴 MED | `next.config.js` → `headers()` thêm 6 header |
| 2 | **Clickjacking** (framable — do thiếu X-Frame-Options) | 🔴 MED | X-Frame-Options: DENY / CSP frame-ancestors |
| 3 | **Lộ stack trace** (verbose error) → nghi **DEV mode** | 🔴 MED | `next build && next start` (production) |
| 4 | Lộ email address (trong HTML) | 🟡 LOW | obfuscate email / dùng form |
| 5 | Lộ HTML comment | 🟡 LOW | strip comment khi build |
| 6 | Thiếu security.txt (RFC 9116) | ⚪ INFO | thêm `/.well-known/security.txt` |

## 4. Performance 49 — vì sao

- **60 script tag + 127KB HTML** trên homepage → JS nặng.
- **Nghi DEV build** (stack trace + 0 minify + 0 header) → chưa `next build`.
- Tunnel latency ~2.4s cộng thêm.
- **Fix:** production build → JS minify/split tối ưu → Perf vọt.

## 5. ✅ Điểm TỐT (không chê)
- **CTA hoạt động**: `/discover` · `/sign-in` · `/share/*` đều 200 (không hỏng — showcase public đúng thiết kế).
- **SEO 90 + A11y 90** — Next.js làm rất tốt.
- **Pentest sạch** — 0 lỗ nghiêm trọng.
- Landing đẹp, typography + copy mạnh.

## 6. FIX-LIST ưu tiên (giao dev)
1. **`next build && next start`** (production mode) → fix stack-trace + Perf + minify **1 phát nhiều lỗi**.
2. **Thêm 6 security header** trong `next.config.js` → Security 80→~92, hết clickjacking.
3. **Sửa icon vỡ** 3 card (icon path/import sai).
4. **Bổ sung nội dung landing** (demo/pricing/testimonial) — hết "mỏng".
5. Strip HTML comment + obfuscate email + thêm security.txt.

→ Vá xong ước: **Security ~92 · Performance ~75 · Overall ~82**.

## 7. Chưa test được
**IDOR/RBAC 7-tier** (flagship, app có "Super-admin→Guest") — cần **2 tài khoản khác role** để test authz-bypass chéo. Chưa có acc → chưa chạy.
