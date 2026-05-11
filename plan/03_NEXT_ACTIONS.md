# ➡️ NEXT ACTIONS — Sau khi M0 (Foundation Scaffold) hoàn tất

> File này là "playbook" rất cụ thể cho user: làm gì NGAY sau khi tôi xong M0.

---

## 🟢 Việc bạn cần làm NGAY (~30 phút setup)

### 1. Cài Node + pnpm (nếu chưa)
```bash
# Node 20+
nvm install 20
nvm use 20

# pnpm 9+
npm install -g pnpm@latest
```

### 2. Setup Supabase project (free tier)
1. Vào https://supabase.com → New Project (tên `competency-framework`, region SG hoặc gần nhất).
2. Đợi 2 phút project provisioned.
3. **Project Settings → API** → copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY` (KHÔNG commit)
4. **Authentication → Providers → Google** (tuỳ chọn): bật OAuth Google.

### 3. Setup project local
```bash
cd /root/application/devops-roadmap/application

# Copy env
cp .env.example .env.local
# Mở .env.local, paste 3 keys Supabase vào

# Cài deps
pnpm install

# Push DB schema lên Supabase
pnpm db:push

# Seed DevOps framework template
pnpm db:seed

# Chạy dev server
pnpm dev
```

Mở http://localhost:3000 → thấy landing page. Click "Get started" → sign-in. Sau sign-in → /onboarding placeholder (sẽ implement ở M1).

### 4. Export 2 Google Sheets ra CSV (chuẩn bị cho M1/M2)
- Tab 1 (Skills) gid `1970847068`: `File → Download → Comma-separated values (.csv)` → save `skills.csv`.
- Tab 2 (Levels) gid `1890838692`: same → save `levels.csv`.
- Đặt 2 file vào `/root/application/devops-roadmap/application/drizzle/seeds/raw-csv/`.

### 5. Lựa chọn: bake CSV → seed JSON
Sau khi có 2 CSV, chạy:
```bash
pnpm gen:seed-from-csv
# Script này (sẽ implement ở M1) merge CSV vào drizzle/seeds/devops.json
pnpm db:seed
```

---

## 🚀 Tiếp tục build (Milestone tiếp theo)

### Cách 1: Tự build (tham khảo prompt + plan)
- Mở `/root/application/devops-roadmap/PROMPT_DEVOPS_MASTERY_WEB_APP.md`.
- Đọc Section "Build Order" và acceptance per page.
- Code từng step.

### Cách 2: Dùng Claude/Cursor build tiếp (recommended)
1. Mở Claude Opus 4.7 hoặc Cursor.
2. Đính kèm:
   - `PROMPT_DEVOPS_MASTERY_WEB_APP.md`
   - Folder `/application/` (Cursor) hoặc paste structure (Claude chat)
   - Plan files
3. Paste prompt sau:

```
Context: Project Next.js đã scaffold tại /root/application/devops-roadmap/application/.
Đã xong: Step 0 (docs), Step 1 (Drizzle schema 18 tables), Step 2 (seed minimal),
Step 3 (Supabase auth), Step 4 (sidebar + topbar + theme).

Yêu cầu: Implement Step 5–7 (M1 — Skills Matrix + Drawer + Fork action).

Output theo format trong prompt gốc:
- File list (created/modified)
- Code đầy đủ từng file
- Verify command
- Notes/Assumptions [ASSUMPTION]
- Next step preview

Bắt đầu ngay.
```

3. AI sẽ output Step 5 → review → "next" → Step 6 → "next" → Step 7.
4. Test locally (`pnpm dev`), tick checklist trong `02_BUILD_STEPS.md`.
5. Lặp lại cho M2 → M5.

---

## 📊 Milestone tracker

Cập nhật khi xong:

- [ ] **M0 Foundation Scaffold** — *(đang làm — sẽ done sau session này)*
- [ ] **M1 Skills Matrix axis** (Step 5–7)
- [ ] **M2 Framework Editor + Import** (Step 8)
- [ ] **M3 Course Map + Week Detail** (Step 9–10) ⭐
- [ ] **M4 Lesson Runner + Exercise types** (Step 11–12) ⭐⭐
- [ ] **M5 Gamification + Dashboard + Polish** (Step 13–16)

---

## 🐞 Troubleshooting trước khi hỏi AI

| Lỗi | Cách fix |
|---|---|
| `pnpm install` fail | Xoá `node_modules` + `pnpm-lock.yaml`, chạy lại |
| `pnpm db:push` báo "permission denied" | Kiểm tra `DATABASE_URL` đúng connection string Supabase (pooler 6543 hoặc direct 5432) |
| TypeScript errors trong shadcn components | `pnpm dlx shadcn@latest add <name>` để regen |
| Google OAuth không hoạt động | Vào Supabase → Auth → URL Configuration → thêm `http://localhost:3000` vào allow list |
| Tailwind classes không apply | Restart dev server sau khi sửa `tailwind.config` |

---

## 📚 Resources khi cần học thêm

- **Next.js 15 App Router:** https://nextjs.org/docs/app
- **Drizzle ORM:** https://orm.drizzle.team
- **Supabase Auth (SSR):** https://supabase.com/docs/guides/auth/server-side
- **shadcn/ui:** https://ui.shadcn.com
- **Framer Motion:** https://www.framer.com/motion/
- **TanStack Table:** https://tanstack.com/table/latest

---

## 🎯 Success criteria sau M5

Khi tất cả milestone xong:
1. App deploy lên Vercel (1 click connect Supabase).
2. Demo 5-phút quay Loom: sign-in → fork DevOps → set 5 levels → start Week 1 lesson → finish lesson → see XP+streak.
3. Share link với 3 người thật, lấy feedback.
4. Iterate.

> **Note quan trọng:** App này được thiết kế để mở rộng. Sau MVP DevOps, bạn có thể thêm framework Frontend/Backend/Data Eng chỉ bằng **1 file JSON seed** mới — không cần đập code.
