# 🔁 STATE FLOW — Plan update state cho từng phần

> Mô tả khi nào state thay đổi, server action nào trigger, side-effect gì.
> Dùng làm reference cho M1–M5.

---

## 1. State containers tổng quan

```
┌──────────────────────────────────────────────────────────────────────┐
│  Source of truth = DATABASE (Postgres)                               │
│                                                                      │
│  - Reads: Server Components (RSC) query db trực tiếp                 │
│  - Writes: Server Actions ('use server') → mutate db → revalidatePath │
│  - Client state: chỉ ephemeral (drawer open, form draft, sound on)   │
└──────────────────────────────────────────────────────────────────────┘
```

**Quy tắc vàng:** Mọi state "thật" (level chosen, XP earned, streak day) phải nằm trong DB. Client state (form draft đang gõ, drawer open) ở Zustand/useState. Không sync 2-way client ↔ server.

---

## 2. Flow Assessment (Skills Matrix axis)

### Trigger
User click skill row → drawer open → chỉnh level/note/evidence/target.

### State change sequence

```
1. Click row
   └─ Client: setSelectedSkill(skill); setOpen(true)

2. Drawer hiển thị form pre-filled từ user_skill_progress
   └─ Server (SSR đã fetch trước): rubric + current data

3. User chỉnh field bất kỳ
   └─ Client: setLevel/setNote/setWhy/etc → state local
   └─ Client: debounce 700ms → setSaveState('saving')

4. Sau 700ms im lặng → gọi updateAssessment(input)
   ├─ Validate Zod
   ├─ Verify ownership (workspace + skill)
   ├─ UPSERT user_skill_progress
   ├─ INSERT activity_log {kind:'assessment_updated'}
   ├─ revalidatePath('/w/[slug]') + revalidatePath('/w/[slug]/skills')
   └─ Return {ok:true}

5. Client: setSaveState('saved'); show "Saved ✓"

6. Khi user đóng drawer hoặc navigate
   └─ Next.js refresh RSC → Dashboard counts cập nhật tự động
```

### Side effects để DESIGN_FUTURE
- Trigger spaced-repetition: nếu level tăng → schedule review_schedules.
- Trigger badge eval: `matrix-master` khi all_skills_assessed.

---

## 3. Flow Fork Template

### Trigger
User vào `/onboarding` → click button trong `<form action={forkTemplate}>`.

### State change

```
1. Form submit → forkTemplate(formData) [server action]

2. Validate input (Zod): templateId, slug, name

3. SELECT framework_templates WHERE id = templateId

4. Parse payload với frameworkPayloadSchema

5. BEGIN TRANSACTION (Drizzle handles transactionality via single connection):
   ├─ INSERT workspaces → id
   ├─ INSERT competency_levels (4 rows)
   ├─ Loop categories:
   │    INSERT skill_categories → catId
   │    INSERT skills (N rows) → mỗi slug map sang skillId
   ├─ Loop tracks (4):
   │    INSERT level_tracks
   │    Loop weeks (12):
   │       INSERT weeks
   │       Loop modules:
   │          INSERT modules
   │          Loop lessons:
   │             INSERT lessons
   │             INSERT lesson_skill_map (links)
   │             INSERT exercises (3-N per lesson)
   ├─ INSERT badges (workspace-scoped)
   ├─ INSERT user_level_progress (XS=unlocked, S/M/L=locked)
   ├─ INSERT hearts (5/5)
   ├─ INSERT streaks (0/0)
   ├─ INSERT activity_log {kind:'framework_forked'}
   └─ UPDATE framework_templates.forks_count += 1

6. revalidatePath('/')
7. redirect('/w/[slug]')
```

### Idempotency
Re-running với slug đã tồn tại sẽ throw từ unique constraint `workspaces_owner_slug_uq`. UI nên check trước hoặc append `-2`.

---

## 4. Flow Lesson Runner (Trục B)

### State machine (client-side, Zustand)

```
States: idle | intro | exercise | feedback | review | end
                                              │
Transitions:                                  ▼
   idle ──onStart──▶ intro ──onBegin──▶ exercise
                                          │
                          ┌─ onCheck ───┤
                          ▼              │
                       feedback ─onContinue─▶ (more?) exercise
                          │                  (else) review (if wrong)
                          │                     │
                          │                     onAllReviewed
                          ▼                     ▼
                                              end
```

### State shape

```ts
type RunnerState = {
  lessonId: string;
  queue: Exercise[];              // ordered exercises
  reviewQueue: Exercise[];        // exercises user got wrong
  currentIdx: number;
  phase: 'idle'|'intro'|'exercise'|'feedback'|'review'|'end';
  // Per-exercise answer cache
  answers: Record<string, unknown>;
  // Last submission result
  lastResult: { isCorrect: boolean; explanationMd?: string; xpAwarded: number } | null;
  // Cumulative for this run
  totalXp: number;
  startedAt: number;
}
```

### Server-side state changes per action

**`startLesson(lessonId)`** — first time entering a lesson:
- INSERT user_lesson_progress (if not exists) status='in_progress', attempts=1
- INSERT activity_log {kind:'lesson_started'}
- Return: lesson detail + exercises (shuffled if applicable)

**`submitExercise({ lessonId, exerciseId, answer, timeTakenMs })`**:
- Server: re-run evaluator (NEVER trust client) per kind:
  - mcq: `answer === payload.correctId`
  - mcq_multi: setEqual(answer, payload.correctIds)
  - fill_blank: each blank pass regex/exact match
  - order_steps: array equal correctOrder
  - type_answer: regex match payload.accepts
- INSERT user_exercise_attempts (answer, isCorrect, timeTakenMs)
- If correct: INSERT xp_events (amount=xpAward, reason='exercise_correct')
- Return: { isCorrect, explanationMd, xpAwarded, heartsLeft }

**`completeLesson({ lessonId, scorePct })`** (called when reach 'end'):
- UPDATE user_lesson_progress: status='completed' (or 'mastered' if scorePct=1), bestScore=max(...), attempts+=1, completedAt=now
- INSERT xp_events (amount=20 bonus, reason='lesson_complete') [+30 if mastered]
- tickStreak(): see §6
- evaluateCrowns(): update user_skill_progress.crowns cho lessons.lesson_skill_map liên quan
- evaluateBadges(): check rules → INSERT user_badges nếu pass
- INSERT activity_log {kind:'lesson_completed'}
- revalidatePath workspace
- Return: { xpAwarded, newStreak, badgesEarned, crownEarned, skillsAdvanced }

---

## 5. Flow Hearts

### Read
- Compute server-side khi render: if `next_refill_at < now` → topup 1 heart, push refill 4h sau.

### Wrong exercise
- `submitExercise` server action:
  - if isCorrect=false: UPDATE hearts SET current = GREATEST(0, current-1), next_refill_at = COALESCE(next_refill_at, now+4h)
- Client: animate heart loss (Framer Motion shake).

### Hết hearts
- Disable Check button → modal "Out of hearts" → option Practice mode (no XP) hoặc wait.

---

## 6. Flow Streak

### `tickStreak(workspaceId, userId)` — gọi mỗi khi user complete lesson đầu của ngày:
```sql
SELECT last_active_date, current_streak FROM streaks;
today = current_date in user timezone
yesterday = today - 1 day

IF last_active_date == today THEN
   no-op (đã tick hôm nay)
ELSIF last_active_date == yesterday THEN
   current_streak += 1
   longest_streak = MAX(longest_streak, current_streak)
ELSE
   current_streak = 1   -- reset (or use freeze if available)
END
UPDATE last_active_date = today
INSERT xp_events (5, 'daily_streak')
```

### Streak milestones (7/14/30/100): grant bonus XP + badge.

---

## 7. Flow Unlock Rules

### Week unlock
```
Week 1 of a Level Track: unlocked when level.status = 'unlocked'
Week N (N>1): unlocked when (N-1).pct_complete >= 0.8
```

### Level unlock
```
XS: always unlocked at fork time
S: unlocked when XS.status = 'completed' (all 12 weeks pct >= 0.8)
M: depends on S
L: depends on M
```

### Implementation
Server action `recomputeUnlockStates(workspaceId, userId)` chạy sau mỗi `completeLesson`:
- Tính user_week_progress.pct_complete = sum(completed lessons)/total lessons in week
- Nếu pct >= 0.8 → mark week complete + unlock next week
- Nếu all weeks in level complete → mark level.status='completed' + unlock next level

---

## 8. Flow Badge Evaluation

Sau mỗi mutation quan trọng (completeLesson, updateAssessment), gọi `evaluateBadges(workspaceId, userId, context)`.

```ts
for each badge in workspace.badges:
   if user already has it: skip
   eval rule:
     - lesson_completed value=N → count user_lesson_progress completed >= N
     - week_completed         → count user_week_progress completedAt not null
     - level_completed value=X → user_level_progress[X].status == 'completed'
     - streak value=N        → streaks.current_streak >= N
     - crowns_total value=N  → sum(user_skill_progress.crowns) >= N
     - category_level cat,lvl → all skills in cat have level >= lvl numeric
     - all_skills_assessed   → user_skill_progress count == skills count
     - total_xp value=N      → sum(xp_events.amount) >= N
   if pass: INSERT user_badges + INSERT xp_events (25, 'badge_earned')
   accumulate to return list
return [{badge, justNow:true}, ...]
```

Client shows toast for each newly earned badge.

---

## 9. Flow Dashboard recompute

Mỗi page load `/w/[slug]`:
- Server query (1 batch nếu được, parallel via Promise.all):
  - count(skills) where workspace=X
  - count(user_skill_progress) where workspace=X user=Y
  - groupBy(category, level) → cho radar
  - groupBy(skill_id) → cho heatmap
  - top 5 weakest = skills no progress or level=XS
  - latest 5 activity_log
  - hearts, streaks, xp today
- Render RSC. No client state.

---

## 10. Tóm tắt action → state changes

| Action | DB writes | Revalidate path |
|---|---|---|
| `forkTemplate` | workspaces+all child tables | `/` (then redirect) |
| `updateAssessment` | user_skill_progress, activity_log | `/w/[slug]`, `/w/[slug]/skills` |
| `startLesson` | user_lesson_progress | `/w/[slug]/learn/...` |
| `submitExercise` | user_exercise_attempts, xp_events, hearts | (no revalidate; client updates locally) |
| `completeLesson` | user_lesson_progress, xp_events, streaks, user_skill_progress (crowns), user_badges, user_week_progress, user_level_progress, activity_log | `/w/[slug]`, `/w/[slug]/learn` |
| `bulkSetLevel` | user_skill_progress (N rows) | `/w/[slug]/skills` |
| `deleteWorkspace` | workspaces (cascade) | `/profile`, `/` |

---

## 11. Implementation status

| Section | Status |
|---|---|
| §2 Assessment flow | ✅ updateAssessment action done; client drawer wired |
| §3 Fork template | ✅ Done |
| §4 Lesson Runner | 🟡 Plan only; component scaffold in progress |
| §5 Hearts | 🟡 Schema only |
| §6 Streak | 🟡 Schema only |
| §7 Unlock rules | 🟡 Plan only |
| §8 Badge eval | 🟡 Schema only |
| §9 Dashboard recompute | 🟡 Basic counts done; charts pending |
