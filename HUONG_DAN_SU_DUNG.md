# 📖 HƯỚNG DẪN SỬ DỤNG — Competency Framework

> App live tại http://localhost:3000 với dev bypass active.
> Dữ liệu DevOps thực: 4 levels · 48 weeks · 22 modules · 59 lessons · 72 exercises · 126 labs · 42 skills · 10 categories · 10 badges.

---

## 🚀 1. Bắt đầu (30 giây)

```
Mở browser → http://localhost:3000
```

Auth đã bypass — bạn KHÔNG cần đăng nhập. Click "Get started" hoặc đi thẳng `/w/devops-test`.

---

## 🗺 2. Các trang chính

| URL | Mục đích | Tip |
|---|---|---|
| `/` | Landing | Thấy framework templates có sẵn |
| `/w/devops-test` | **Dashboard** | Radar coverage, heatmap, today block |
| `/w/devops-test/skills` | **Skills Matrix** | Filter/search/sort 42 skills · click row → drawer assess |
| `/w/devops-test/learn` | **Course Map** (Duolingo path) | Curved SVG snake path, click week node → week detail |
| `/w/devops-test/roadmap-tree` ⭐ | **Roadmap Tree** | Hierarchy đầy đủ: Level → Week → Module → Lesson → Exercises |
| `/w/devops-test/daily` | **Daily Planner** | Auto-gen 3-5 task hôm nay |
| `/w/devops-test/framework` | Framework Editor | CRUD categories / skills / levels |
| `/w/devops-test/roles` | Career Target | Set target role (Junior/Mid/Senior) cho gap radar |
| `/profile` | Profile | XP / streak / badges / activity heatmap GitHub-style |
| `/settings` | Settings | Theme / sound / daily goal / language |

---

## 🌳 3. Roadmap Tree (recommend xem trước)

URL: **http://localhost:3000/w/devops-test/roadmap-tree**

### Cách dùng

- **Mặc định:** Cả 4 levels (XS · S · M · L) đã expand sẵn — bạn thấy ngay 4 tracks
- **Click vào tên level** (vd "Foundational Track") → xổ ra danh sách 12 weeks
- **Click vào tên week** → xổ ra:
  - Summary + goals + keywords (chips)
  - Modules (collapsed)
  - Hands-on Labs (icon 🧪 +50 XP)
- **Click vào tên module** → xổ ra danh sách lessons
- **Click vào tên lesson** → xổ ra danh sách exercises kèm kind (mcq/fill_blank/...)
- **Nút "Start →" bên lesson** → mở Lesson Runner full-screen (đó là chỗ duy nhất navigate)
- **Nút "Open →" bên week** → mở Week Detail page

### Shortcuts
- "Expand all" / "Collapse all" góc trên phải

### Phân cấp 4 tầng

```
Tier 1: Career Level (XS Intern → S Junior → M Mid → L Senior Tech Lead)
   └── Tier 2: Weeks (1-12 per level, total 48)
         └── Tier 3a: Modules (groups of lessons in a week)
               └── Tier 4: Lessons (5-10 min content)
                     └── Tier 5: Exercises (mcq / fill / order / type / code review)
         └── Tier 3b: Hands-on Labs (parallel to modules, +50 XP each)
```

---

## 📊 4. Skills Matrix flow (assess yourself)

URL: **http://localhost:3000/w/devops-test/skills**

1. Lưới 42 skills nhóm theo 10 categories (AWS · Terraform · K8s · Go · DevSecOps · ...)
2. **Filter:** chọn category chips ở topbar
3. **Search:** debounce 200ms
4. **Sort:** click cột header
5. **Click 1 row** → mở **Skill Drawer** từ phải sang
   - Rubric 4 mức (XS/S/M/L) với description + examples
   - **Self-assess:** chọn 1 trong 4 radio cards
   - **Target level:** chip set
   - **Why this level?** textarea
   - **Evidence URLs:** dán link GitHub/blog (1 per line)
   - **Note:** markdown
   - **🛡 Verified evidence (V8):** click expand → list evidence + confidence score + "Submit new evidence" button
   - **Auto-save 700ms** sau mỗi gõ — thấy "Saved ✓"

---

## 🎓 5. Lesson Runner flow (Duolingo-style learning)

1. Từ `/learn` (Course Map): click 1 week unlocked → Week Detail
2. Hoặc từ `/roadmap-tree`: click "Start →" bên 1 lesson
3. Hoặc từ Daily Planner: click 1 lesson task

### Trong Lesson Runner:
1. **Intro screen:** title + intro_md → click "Begin"
2. **Exercise loop:** 6 kinds — MCQ, MCQ multi, Fill blank, Type answer, Order steps, Code review
   - Chọn/gõ đáp án → "Check"
   - **Đúng** → ✅ +XP → "Continue"
   - **Sai** → ❌ giải thích → -1 heart → đẩy vào review queue
3. **Review queue:** sau khi xong main queue, replay câu sai
4. **End screen:** tổng XP earned + streak + crowns + badges newly earned
5. **Hết hearts** → modal: practice mode (no XP) hoặc back to map
6. **Hoàn thành tuần (≥80%)** → unlock week kế + +100 XP bonus
7. **Hoàn thành level** → +500 XP + unlock level kế

---

## 📅 6. Daily Planner

URL: **http://localhost:3000/w/devops-test/daily**

- Auto-gen 3-5 tasks dựa trên: tuần đang dở + lab chưa xong + 2 skill yếu nhất + 1 streak keeper
- Mỗi task có: kind icon · est minutes · skip/carry-over button
- Tick checkbox → mark done → +XP
- Daily XP goal progress bar lên top

---

## 🏆 7. Gamification

- **XP:** +10 mỗi exercise đúng · +20 lesson · +30 mastered · +100 week · +500 level
- **Streak:** đếm ngày liên tiếp có completing lesson; flame icon ở topbar
- **Hearts:** 5/5; sai exercise -1; refill 4h/heart; hết → practice mode
- **Crowns:** mỗi skill có max 5 crowns (lesson xong tăng dần)
- **Badges:** 10 loại auto-grant — First Step, On Fire, Week Warrior, Foundational, Crown Collector, ...

---

## 🛠 8. Customize Framework

URL: **http://localhost:3000/w/devops-test/framework**

3 tabs:
1. **Categories** — add/edit/delete (color picker + icon)
2. **Skills** — group by category, drag handle (planned), add/edit/delete + tags
3. **Levels** — edit rubric label/description/examples cho mỗi XS/S/M/L

---

## 🎯 9. Career Target Role

URL: **http://localhost:3000/w/devops-test/roles**

- Pick target role (Intern/Junior/Mid/Senior Tech Lead)
- Optional target date
- Dashboard sẽ hiện **Gap Radar** so sánh current vs required level cho role đó

---

## 📥 10. Re-import / Update data

### Update từ markdown:
```bash
cd /root/application/devops-roadmap/application
/tmp/etl-env-run.sh --workspace-id=00000000-0000-0000-0000-000000000001 --markdown
```

### Re-bootstrap full content:
```bash
pnpm tsx drizzle/scripts/bootstrap-full-workspace.ts \
  00000000-0000-0000-0000-000000000001 \
  00000000-0000-0000-0000-000000000099
```

### Re-import từ Google Sheets CSV:
1. Export 2 sheets (gid 1970847068 + 1890838692) ra CSV
2. Đặt vào `drizzle/seeds/raw-csv/skills.csv` + `levels.csv`
3. `pnpm gen:seed-from-csv && pnpm db:seed`

---

## 🛑 11. Tắt/restart app

```bash
# Tắt dev server
pkill -f "next dev"

# Khởi động lại
cd /root/application/devops-roadmap/application && pnpm dev

# Tắt Docker Postgres (nếu cần)
docker stop ragbot-coder-postgres
```

---

## 🐛 12. Troubleshooting

| Vấn đề | Cách fix |
|---|---|
| Port 3000 busy | `lsof -ti:3000 | xargs kill -9` |
| `placeholder.supabase.co` DNS error | OK, đã bypass bằng `DEV_AUTH_BYPASS_USER_ID` |
| Workspace không có data | Re-run `bootstrap-full-workspace.ts` |
| Postgres không kết nối | `docker ps | grep ragbot-coder-postgres` → restart container |
| Lesson Runner 500 error | Verify lesson có exercises: `SELECT COUNT(*) FROM exercises WHERE lesson_id=...` |
| Profile 500 | Đã fix bug SQL groupBy ở commit `fa7e540` |

---

## 📋 13. Quality gates manual run

```bash
cd /root/application/devops-roadmap/application
pnpm guard:no-mock        # check không có mock data
pnpm guard:no-hardcode    # check không có hardcoded business data
pnpm typecheck            # TypeScript strict
pnpm test                 # 82 unit tests
pnpm lint                 # ESLint
```

---

## 🔗 14. Repo + Stack

- **Code:** https://github.com/luannt2002/Competency-Framework
- **Tech:** Next.js 15 + TypeScript strict + Drizzle ORM + Postgres + shadcn/ui + Framer Motion + Recharts + sonner toasts
- **Auth:** Supabase magic link + Google OAuth (currently bypassed in dev)
- **DB:** Postgres trong container `ragbot-coder-postgres` (db `competency`, port 5432)

---

## ⏭ 15. Tiếp theo

- Setup Supabase project thật → replace placeholder URLs trong `.env.local` → bỏ dev bypass
- Import 2 Google Sheets CSV → workspace có full skill list từ source thật
- Deploy lên Vercel + Supabase Cloud
- Mời teammate test cohort/onboarding mode (V3)
