/**
 * Lesson runner server actions.
 * - startLesson: load lesson + exercises, init user_lesson_progress
 * - submitExercise: grade, award XP, decrement hearts on wrong
 * - completeLesson: bonus XP, tick streak, mark progress
 * - listGradingQueue / gradeSubmission: EDITOR+ manual grading (essay, rubric)
 *
 * Grading itself lives in `@/lib/exercises` (registry + domain). This file only
 * validates input, resolves the workspace, delegates, and audits.
 */
'use server';
import { resolveWorkspace } from '@/lib/rbac/resolve';

import { z } from 'zod';
import { eq, and, asc, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db/client';
import {
  lessons,
  userLessonProgress,
  xpEvents,
  hearts,
  activityLog,
  notifications,
} from '@/lib/db/schema';
import {
  openExercises as exercises,
  exerciseAttempts as userExerciseAttempts,
} from '@/lib/db/schema-exercises';
import { gradeAnswer } from '@/lib/exercises/registry';
import { sanitizePayload } from '@/lib/exercises/sanitize';
import { loadTypeResolver } from '@/lib/exercises/type-repo';
import { resolveExerciseType } from '@/lib/exercises/resolve';
import {
  listPendingAttempts,
  countPendingAttempts,
  gradeAttempt,
  type PendingAttempt,
} from '@/lib/exercises/grading';
import type { GradeResult, GradeStatus } from '@/lib/exercises/types';
import type { FieldSpec } from '@/lib/exercises/field-spec';
import { XP, nodeCompletionXp } from '@/lib/learn/xp-rules';
import { awardStreakTick } from '@/lib/learn/xp-award';
import { findNodeForLesson } from '@/lib/learn/node-lesson';
import { upsertNodeStatus } from '@/lib/learn/node-progress';
import {
  readHearts,
  heartsToNumber,
  grantHeartOnce,
  REPLAY_HEART_REWARD,
} from '@/lib/gamification/hearts';
import { awardCrowns, type CrownAdvance } from '@/lib/gamification/crowns';
import { evaluateBadges, type GrantedBadge } from '@/lib/gamification/badge-evaluator';
import { recomputeUnlocks } from '@/lib/learn/unlock-rules';
import {
  insertXpOnce,
  computeLessonScore,
  countPriorAttempts,
  hasCorrectAttempt,
} from '@/lib/learn/xp-award';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { writeAudit } from '@/lib/rbac/server';


export type LessonRunData = {
  lessonId: string;
  title: string;
  introMd: string | null;
  estMinutes: number;
  exercises: Array<{
    /** Open kind slug — resolved via `exercise_types`, no longer an enum. */
    id: string;
    kind: string;
    /**
     * Resolved grading engine. The runner picks its widget from THIS, not from
     * `kind`: a tenant kind built on the `mcq` engine gets radio buttons even
     * though no code has ever heard of its slug. Safe to expose — it is a
     * registry key, not an answer (the grading queue already ships it).
     */
    engine: string;
    /** Human label of the kind, e.g. "Tự luận". */
    typeLabel: string;
    /** `manual`/`hybrid` tell the UI to promise a grade later, not a verdict now. */
    gradingMode: 'auto' | 'manual' | 'hybrid';
    promptMd: string;
    /** Public payload — every secret path stripped server-side. */
    payload: unknown;
    /**
     * Tenant-declared answer fields, secret ones removed. Empty for built-in
     * kinds; for a kind on an engine the runner has no widget for, this is
     * what it renders instead of giving up.
     */
    answerSpec: FieldSpec;
    xpAward: number;
  }>;
};

const startInput = z.object({
  workspaceSlug: z.string(),
  lessonId: z.string().uuid(),
});

/**
 * ĐỌC THUẦN: nạp bài học + bộ câu hỏi đã lọc đáp án. KHÔNG ghi gì.
 *
 * Tách ra khỏi `startLesson` vì trang `/practice` gọi nó ngay trong render GET.
 * Đo được (rà B4.13): `attempts` tăng 71 → 73 sau đúng HAI lần `curl`, trong
 * khi số lượt làm bài thật chỉ có 24 — cột đó đang đếm lượt XEM TRANG. Render
 * của Server Component phải đọc được nhiều lần mà không đổi trạng thái.
 */
export async function loadLessonRun(
  input: z.infer<typeof startInput>,
): Promise<LessonRunData> {
  const { workspaceSlug, lessonId } = startInput.parse(input);
  const { ws } = await resolveWorkspace(workspaceSlug, RBAC_LEVELS.LEARNER);

  const lessonRows = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.id, lessonId), eq(lessons.workspaceId, ws.id)))
    .limit(1);
  const lesson = lessonRows[0];
  if (!lesson) throw new Error('LESSON_NOT_FOUND');

  const exerciseRows = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.lessonId, lesson.id), eq(exercises.workspaceId, ws.id)))
    .orderBy(asc(exercises.displayOrder));

  // One catalogue read per lesson; kinds seen on rows are passed in so a kind
  // whose type row was retired still resolves via the code registry.
  const resolver = await loadTypeResolver(
    ws.id,
    exerciseRows.map((e) => e.kind),
  );

  return {
    lessonId: lesson.id,
    title: lesson.title,
    introMd: lesson.introMd ?? null,
    estMinutes: lesson.estMinutes ?? 8,
    exercises: exerciseRows.map((e) => {
      const type = resolver.get(e.kind) ?? resolveExerciseType(e.kind);
      return {
        id: e.id,
        kind: e.kind,
        engine: type.engine,
        typeLabel: type.label,
        gradingMode: type.gradingMode,
        promptMd: e.promptMd,
        // Answers never leave the server. `secretPaths` is the union of what
        // the engine declares and what the tenant flagged secret, so a kind
        // invented at runtime is stripped as thoroughly as a built-in one.
        payload: sanitizePayload(e.payload, { secretPaths: type.secretPaths }),
        answerSpec: type.answerSpec,
        xpAward: e.xpAward ?? 10,
      };
    }),
  };
}

/**
 * GHI: đánh dấu người học đã thật sự BẮT ĐẦU làm bài.
 *
 * Tách hẳn khỏi `loadLessonRun`. Chỉ được gọi từ hành vi thật của người dùng
 * (runner gọi một lần khi mount ở client), không bao giờ từ render của Server
 * Component — nếu không thì prefetch, crawler hay chỉ một lần F5 cũng làm
 * `attempts` nhảy số.
 */
export async function startLesson(input: z.infer<typeof startInput>): Promise<void> {
  const { workspaceSlug, lessonId } = startInput.parse(input);
  const { ws, user } = await resolveWorkspace(workspaceSlug, RBAC_LEVELS.LEARNER);

  const lessonRows = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(and(eq(lessons.id, lessonId), eq(lessons.workspaceId, ws.id)))
    .limit(1);
  const lesson = lessonRows[0];
  if (!lesson) throw new Error('LESSON_NOT_FOUND');

  const existing = await db
    .select({
      id: userLessonProgress.id,
      attempts: userLessonProgress.attempts,
      status: userLessonProgress.status,
    })
    .from(userLessonProgress)
    .where(
      and(
        eq(userLessonProgress.workspaceId, ws.id),
        eq(userLessonProgress.userId, user.id),
        eq(userLessonProgress.lessonId, lesson.id),
      ),
    )
    .limit(1);

  if (existing[0]) {
    // Mở lại một bài ĐÃ XONG là ôn tập, không phải tụt hạng. Ba nơi đọc đúng
    // giá trị này: unlock-rules khoá lại tuần, badge-evaluator ngừng đếm,
    // planner hồi sinh bài đã xong.
    const settled = existing[0].status === 'completed' || existing[0].status === 'mastered';
    await db
      .update(userLessonProgress)
      .set({
        status: settled ? existing[0].status : 'in_progress',
        attempts: (existing[0].attempts ?? 0) + 1,
        lastAttemptAt: new Date(),
      })
      .where(
        and(
          eq(userLessonProgress.id, existing[0].id),
          eq(userLessonProgress.workspaceId, ws.id),
        ),
      );
  } else {
    await db.insert(userLessonProgress).values({
      workspaceId: ws.id,
      userId: user.id,
      lessonId: lesson.id,
      status: 'in_progress',
      attempts: 1,
      lastAttemptAt: new Date(),
    });
  }
}

const submitInput = z.object({
  workspaceSlug: z.string(),
  lessonId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  answer: z.unknown(),
  timeTakenMs: z.number().int().min(0).max(60 * 60 * 1000).optional(),
  isRetry: z.boolean().optional(),
});

export type SubmitResult = {
  /** Legacy field: true only for a settled, fully-correct attempt. */
  isCorrect: boolean;
  /** Full verdict. `pending_review` means a human still has to grade it. */
  status: GradeStatus;
  /** 0..1. Meaningless while `status === 'pending_review'`. */
  score: number;
  /** False when a human produced (or still owes) the grade. */
  autoGraded: boolean;
  /** Learner-safe note from the engine. Never contains the answer. */
  feedback: string | null;
  /** Withheld until the attempt is settled, so an essay can't be peeked at. */
  explanationMd: string | null;
  xpAwarded: number;
  heartsLeft: number;
};

export async function submitExercise(input: z.infer<typeof submitInput>): Promise<SubmitResult> {
  const parsed = submitInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.LEARNER);

  const exRows = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.id, parsed.exerciseId), eq(exercises.workspaceId, ws.id)))
    .limit(1);
  const ex = exRows[0];
  if (!ex) throw new Error('EXERCISE_NOT_FOUND');

  // Resolve kind -> engine through the catalogue, then grade. `manual` kinds
  // come back `pending_review`: nothing is settled, so no XP and no heart lost
  // until a human grades it on /w/[slug]/grading.
  const resolver = await loadTypeResolver(ws.id, [ex.kind]);
  const type = resolver.get(ex.kind) ?? resolveExerciseType(ex.kind);
  const result: GradeResult =
    type.gradingMode === 'manual'
      ? { status: 'pending_review', score: 0, autoGraded: false }
      : gradeAnswer(type.engine, ex.payload, parsed.answer, { config: type.config });

  const isCorrect = result.status === 'correct';
  const isPending = result.status === 'pending_review';
  const isWrong = result.status === 'incorrect';

  // Server-side retry detection: prior attempts decide retry status, NOT the client.
  // (Client `isRetry` is advisory only — trusting it allowed full first-try XP forever.)
  const isServerRetry =
    (await countPriorAttempts(ws.id, user.id, ex.id)) > 0;

  // XP is awarded at most once per exercise (first correct attempt ever).
  // Re-submitting a correct answer awards nothing → no XP farming via replay.
  //
  // Scaled by `score`, which is 1 or 0 for every legacy kind — so the six
  // ported kinds pay exactly what they always paid. A `partial` result pays
  // proportionally; a `pending_review` one pays nothing until it is graded.
  let xpAwarded = 0;
  const earnsXp = !isPending && result.score > 0;
  if (earnsXp && !isServerRetry) {
    xpAwarded = Math.round((ex.xpAward ?? XP.EXERCISE_CORRECT_FIRST) * result.score);
    await db.insert(xpEvents).values({
      workspaceId: ws.id,
      userId: user.id,
      amount: xpAwarded,
      reason: 'exercise_correct',
      refKind: 'exercise',
      refId: ex.id,
    });
  } else if (earnsXp && isServerRetry) {
    // Retry-correct after at least one wrong attempt: small reward, once per exercise.
    if (!(await hasCorrectAttempt(ws.id, user.id, ex.id))) {
      xpAwarded = Math.round(XP.EXERCISE_CORRECT_RETRY * result.score);
      await db.insert(xpEvents).values({
        workspaceId: ws.id,
        userId: user.id,
        amount: xpAwarded,
        reason: 'exercise_correct_retry',
        refKind: 'exercise',
        refId: ex.id,
      });
    }
  }

  // Record attempt. `is_correct` stays in lockstep with `status` so the legacy
  // readers (computeLessonScore, hasCorrectAttempt) need no change.
  await db.insert(userExerciseAttempts).values({
    workspaceId: ws.id,
    userId: user.id,
    exerciseId: ex.id,
    answer: parsed.answer as Record<string, unknown>,
    isCorrect,
    status: result.status,
    score: String(result.score),
    timeTakenMs: parsed.timeTakenMs ?? null,
  });

  // Update hearts — single atomic upsert to avoid the read-modify-write race
  // where two concurrent wrong answers both read the same heart count and only
  // lose one heart.
  //
  // Only a settled WRONG answer costs a heart. An essay awaiting review has not
  // been judged yet, and a partial answer was not wrong — charging either would
  // punish the learner for the grader's latency.
  //
  // Lazy refill first: apply any hearts owed since next_refill_at elapsed, so
  // the reported count (and the decrement below) starts from the true value.
  // F7 — hết tim thì KHÔNG nộp bài được nữa.
  // Trước đợt này tim chỉ để trang trí: hết 5 tim vẫn học bình thường
  // (grep `heartsLeft === 0` / `NO_HEARTS` ra 0 kết quả). `readHearts` áp cả
  // hồi phục theo giờ lẫn hao vì nghỉ học rồi mới trả số, nên số ở đây là số
  // thật chứ không phải số cũ trong bảng.
  const snapshot = await readHearts(ws.id, user.id);
  if (snapshot && snapshot.current <= 0) throw new Error('NO_HEARTS');

  let heartsLeft = snapshot?.current ?? 5;
  if (isWrong) {
    const HEART_REFILL_MS = 4 * 60 * 60 * 1000;
    const upserted = await db
      .insert(hearts)
      .values({
        workspaceId: ws.id,
        userId: user.id,
        current: '4',
        max: 5,
        nextRefillAt: new Date(Date.now() + HEART_REFILL_MS),
      })
      .onConflictDoUpdate({
        target: [hearts.workspaceId, hearts.userId],
        set: {
          current: sql`GREATEST(${hearts.current} - 1, 0)`,
          nextRefillAt: sql`COALESCE(${hearts.nextRefillAt}, NOW() + interval '4 hours')`,
        },
      })
      .returning({ current: hearts.current });
    heartsLeft = heartsToNumber(upserted[0]?.current);
  }

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'exercise.submit',
    resourceType: 'exercise',
    resourceId: ex.id,
    before: null,
    after: {
      isCorrect,
      status: result.status,
      score: result.score,
      kind: ex.kind,
      engine: type.engine,
      xpAwarded,
      isRetry: isServerRetry,
    },
  });

  return {
    isCorrect,
    status: result.status,
    score: result.score,
    autoGraded: result.autoGraded,
    feedback: result.feedback ?? null,
    // Holding the explanation back while the attempt is unsettled stops a
    // learner from reading the model answer out of a pending essay.
    explanationMd: isPending ? null : ex.explanationMd ?? null,
    xpAwarded,
    heartsLeft,
  };
}

const completeInput = z.object({
  workspaceSlug: z.string(),
  lessonId: z.string().uuid(),
  scorePct: z.number().min(0).max(1),
});

export type CompleteResult = {
  xpAwarded: number;
  bonusReason: 'lesson_complete' | 'lesson_mastered';
  streakTicked: boolean;
  newStreak: number;
  crowns: CrownAdvance[];
  badges: GrantedBadge[];
  weekCompleted: boolean;
  levelCompleted: boolean;
  newlyUnlockedLevelCodes: string[];
  /** F11 — tim kiếm được nhờ ôn lại bài đã xong (0 nếu đây là lần hoàn thành đầu). */
  heartsEarned: number;
};


export async function completeLesson(input: z.infer<typeof completeInput>): Promise<CompleteResult> {
  const parsed = completeInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.LEARNER);

  // ===== Server-side score: derive from recorded attempts, never trust client =====
  const scorePct =
    (await computeLessonScore(ws.id, user.id, parsed.lessonId)) ?? parsed.scorePct;

  // Mark progress
  const mastered = scorePct >= 0.999;
  const existing = await db
    .select()
    .from(userLessonProgress)
    .where(
      and(
        eq(userLessonProgress.workspaceId, ws.id),
        eq(userLessonProgress.userId, user.id),
        eq(userLessonProgress.lessonId, parsed.lessonId),
      ),
    )
    .limit(1);

  // First-time transitions gate every XP bonus below (no re-award on replay).
  const prevStatus = existing[0]?.status ?? null;
  const firstCompletion = prevStatus !== 'completed' && prevStatus !== 'mastered';
  const firstMastery = mastered && prevStatus !== 'mastered';

  if (existing[0]) {
    await db
      .update(userLessonProgress)
      .set({
        status: mastered ? 'mastered' : 'completed',
        bestScore: String(Math.max(Number(existing[0].bestScore ?? '0'), scorePct)),
        completedAt: new Date(),
      })
      .where(
        and(
          eq(userLessonProgress.id, existing[0].id),
          eq(userLessonProgress.workspaceId, ws.id),
        ),
      );
  } else {
    await db.insert(userLessonProgress).values({
      workspaceId: ws.id,
      userId: user.id,
      lessonId: parsed.lessonId,
      status: mastered ? 'mastered' : 'completed',
      bestScore: String(scorePct),
      attempts: 1,
      completedAt: new Date(),
      lastAttemptAt: new Date(),
    });
  }

  // F11 — ôn lại một bài ĐÃ XONG được +1 tim, tối đa một lần mỗi bài mỗi ngày.
  // Đây là đường KIẾM LẠI tim duy nhất ngoài hồi phục theo giờ; không có nó thì
  // F8 (nghỉ học vơi tim) chỉ là hình phạt một chiều.
  let heartsEarned = 0;
  if (!firstCompletion) {
    const granted = await grantHeartOnce({
      workspaceId: ws.id,
      userId: user.id,
      reason: 'lesson_replay',
      refId: parsed.lessonId,
    });
    if (granted) heartsEarned = REPLAY_HEART_REWARD;
  }

  // Lesson bonus — only on the first completion, plus a one-time mastery upgrade.
  let bonus = 0;
  if (firstCompletion) {
    await insertXpOnce({
      workspaceId: ws.id,
      userId: user.id,
      amount: XP.LESSON_COMPLETE_BONUS,
      reason: 'lesson_complete',
      refKind: 'lesson',
      refId: parsed.lessonId,
    });
    bonus += XP.LESSON_COMPLETE_BONUS;
  }
  if (firstMastery) {
    const awarded = await insertXpOnce({
      workspaceId: ws.id,
      userId: user.id,
      amount: XP.LESSON_MASTERED_BONUS,
      reason: 'lesson_mastered',
      refKind: 'lesson',
      refId: parsed.lessonId,
    });
    if (awarded) bonus += XP.LESSON_MASTERED_BONUS;
  }

  // Tick streak qua awardStreakTick — KHÔNG tự insert +5 nữa.
  // Lỗi cũ (rà F3): chỗ này gọi thẳng `tickStreak` rồi tự ghi đúng +5, nên
  // BỎ MẤT bonus mốc (+50 ngày thứ 7, +300 ngày thứ 30). Ai chạm mốc bằng hành
  // vi "hoàn thành bài học" thì mất bonus; chạm bằng node-done hay daily-task
  // thì có — mất XP thật, im lặng, không ai thấy.
  const streak = await awardStreakTick(ws.id, user.id);

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'lesson_completed',
    payload: { lessonId: parsed.lessonId, scorePct, mastered },
  });

  // ===== Nối ngược về CÂY: xong bài học phải làm node tương ứng chuyển done =====
  // Đây là chỗ vòng lặp học từng ĐỨT (rà B4.15): người học làm hết bài, bảng
  // `user_lesson_progress` ghi `completed`, nhưng KHÔNG ai ghi
  // `user_node_progress` — nên cây vẫn ○, dashboard vẫn 0%, và mọi thứ đọc
  // tiến độ (planner, chứng nhận, unlock) đều không thấy gì. Lesson và node là
  // hai bảng, chỉ nối với nhau qua `meta->>'lessonSlug'`.
  let nodeXp = 0;
  let completedNodeSlug: string | null = null;
  const linkedNode = await findNodeForLesson({ workspaceId: ws.id, lessonId: parsed.lessonId });
  if (linkedNode) {
    await upsertNodeStatus({
      workspaceId: ws.id,
      userId: user.id,
      nodeId: linkedNode.id,
      status: 'done',
    });
    completedNodeSlug = linkedNode.slug;
    // Chỉ XP node ở đây. Streak đã tick phía trên và badge quét ở dưới — gọi
    // `awardNodeCompletion` sẽ tick streak và quét badge lần thứ hai.
    const nodeAmount = nodeCompletionXp({
      depth: linkedNode.depth,
      hasChildren: linkedNode.hasChildren,
    });
    const awardedNode = await insertXpOnce({
      workspaceId: ws.id,
      userId: user.id,
      amount: nodeAmount,
      reason: 'node_complete',
      refKind: 'tree_node',
      refId: linkedNode.id,
    });
    if (awardedNode) nodeXp = nodeAmount;
  }

  // ===== Side effects: crowns + unlock + bonuses + badges =====
  // Crowns only advance on real transitions (first completion / first mastery)
  // — replaying a finished lesson must not keep stacking crowns to the cap.
  const crowns = await awardCrowns(ws.id, user.id, parsed.lessonId, mastered, {
    eligible: firstCompletion || firstMastery,
    masteredUpgrade: firstMastery && !firstCompletion,
  });
  const unlock = await recomputeUnlocks(ws.id, user.id, parsed.lessonId);

  let extraBonus = 0;
  if (unlock.weekCompleted) {
    extraBonus += XP.WEEK_COMPLETE_BONUS;
    await insertXpOnce({
      workspaceId: ws.id,
      userId: user.id,
      amount: XP.WEEK_COMPLETE_BONUS,
      reason: 'week_complete',
      refKind: 'week',
      refId: unlock.completedWeekId ?? parsed.lessonId,
    });
  }
  if (unlock.levelCompleted) {
    extraBonus += XP.LEVEL_COMPLETE_BONUS;
    await insertXpOnce({
      workspaceId: ws.id,
      userId: user.id,
      amount: XP.LEVEL_COMPLETE_BONUS,
      reason: 'level_complete',
      refKind: 'level',
      refId: unlock.completedTrackId ?? parsed.lessonId,
    });
  }

  const badgesEarned = await evaluateBadges(ws.id, user.id);

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'lesson.complete',
    resourceType: 'lesson',
    resourceId: parsed.lessonId,
    before: { status: existing[0]?.status ?? null },
    after: {
      status: mastered ? 'mastered' : 'completed',
      scorePct,
      weekCompleted: unlock.weekCompleted,
      levelCompleted: unlock.levelCompleted,
    },
  });

  revalidatePath(`/w/${ws.slug}`);
  revalidatePath(`/w/${ws.slug}/learn`);
  revalidatePath(`/w/${ws.slug}/skills`);
  if (completedNodeSlug) revalidatePath(`/w/${ws.slug}/n/${completedNodeSlug}`);

  return {
    // streak.xpAwarded đã gồm cả tick ngày lẫn bonus mốc — đừng cộng tay lại.
    xpAwarded:
      bonus + streak.xpAwarded + nodeXp + extraBonus + badgesEarned.length * XP.BADGE_EARNED,
    bonusReason: mastered ? 'lesson_mastered' : 'lesson_complete',
    streakTicked: streak.ticked,
    newStreak: streak.newStreak,
    crowns,
    badges: badgesEarned,
    weekCompleted: unlock.weekCompleted,
    levelCompleted: unlock.levelCompleted,
    newlyUnlockedLevelCodes: unlock.newlyUnlockedLevelCodes,
    heartsEarned,
  };
}

/* ============================ manual grading (EDITOR+) ============================ */

/**
 * Read the pending-review queue for a workspace.
 *
 * EDITOR is the floor: grading decides someone's XP and progress, so it sits
 * with the people who own the content, not with every learner.
 */
export async function listGradingQueue(input: {
  workspaceSlug: string;
  limit?: number;
}): Promise<{ items: PendingAttempt[]; total: number }> {
  const parsed = z
    .object({
      workspaceSlug: z.string(),
      limit: z.number().int().min(1).max(200).optional(),
    })
    .parse(input);

  const { ws } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.EDITOR);
  const [items, total] = await Promise.all([
    listPendingAttempts(ws.id, parsed.limit ?? 50),
    countPendingAttempts(ws.id),
  ]);
  return { items, total };
}

const gradeInput = z
  .object({
    workspaceSlug: z.string(),
    attemptId: z.string().uuid(),
    /** Direct 0..1 score — essay and manual overrides. */
    score: z.number().min(0).max(1).optional(),
    /** Per-criterion 0..1 scores — rubric. The engine does the weighting. */
    rubricScores: z.record(z.number().min(0).max(1)).optional(),
    feedbackMd: z.string().max(10_000).optional(),
  })
  .refine((v) => v.score !== undefined || v.rubricScores !== undefined, {
    message: 'score or rubricScores is required',
  });

export type GradeSubmissionResult = {
  status: GradeStatus;
  score: number;
  xpAwarded: number;
};

/**
 * Settle one pending attempt: score it, notify the learner, audit the decision.
 *
 * The action itself only validates, resolves the workspace and delegates —
 * every rule (which engine, how a rubric totals, whether XP is owed) lives in
 * `@/lib/exercises/grading`.
 */
export async function gradeSubmission(
  input: z.infer<typeof gradeInput>,
): Promise<GradeSubmissionResult> {
  const parsed = gradeInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.EDITOR);

  const outcome = await gradeAttempt({
    workspaceId: ws.id,
    attemptId: parsed.attemptId,
    graderUserId: user.id,
    score: parsed.score,
    rubricScores: parsed.rubricScores,
    feedbackMd: parsed.feedbackMd,
  });

  // Tell the learner. A notification failure must not undo the grade.
  try {
    await db.insert(notifications).values({
      recipientUserId: outcome.learnerUserId,
      kind: 'attempt.graded',
      workspaceId: ws.id,
      resourceType: 'exercise',
      resourceId: outcome.exerciseId,
      title: 'Bài của bạn đã được chấm',
      body: parsed.feedbackMd
        ? parsed.feedbackMd.slice(0, 200)
        : `Kết quả: ${outcome.result.status} (${Math.round(outcome.result.score * 100)}%).`,
    });
  } catch (err) {
    console.error('[learn.gradeSubmission] notification failed:', err);
  }

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: outcome.learnerUserId,
    kind: 'attempt_graded',
    payload: {
      attemptId: outcome.attemptId,
      exerciseId: outcome.exerciseId,
      status: outcome.result.status,
      score: outcome.result.score,
    },
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'attempt.grade',
    resourceType: 'exercise_attempt',
    resourceId: outcome.attemptId,
    before: outcome.before,
    after: {
      status: outcome.result.status,
      score: outcome.result.score,
      learnerUserId: outcome.learnerUserId,
      xpAwarded: outcome.xpAwarded,
      rubricScores: parsed.rubricScores ?? null,
    },
  });

  revalidatePath(`/w/${ws.slug}/grading`);
  revalidatePath(`/w/${ws.slug}`);

  return {
    status: outcome.result.status,
    score: outcome.result.score,
    xpAwarded: outcome.xpAwarded,
  };
}
