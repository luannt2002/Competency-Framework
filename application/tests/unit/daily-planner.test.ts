import { describe, it, expect } from 'vitest';
import {
  planDay,
  type UserContext,
  type PlannedTaskInput,
} from '@/lib/learn/daily-planner';

/** Helper: produce an empty baseline UserContext we can mutate per-case. */
function baseContext(over: Partial<UserContext> = {}): UserContext {
  return {
    currentWeek: null,
    unfinishedLessons: [],
    unfinishedLabs: [],
    weakSkills: [],
    yesterdayExercise: null,
    streakAtRisk: false,
    ...over,
  };
}

const lessonCtx = (id: string, title = `Lesson ${id}`, estMinutes = 8) => ({
  id,
  title,
  estMinutes,
});

const labCtx = (id: string, title = `Lab ${id}`, estMinutes = 30) => ({
  id,
  title,
  estMinutes,
});

const weakCtx = (
  id: string,
  daysSinceTouched = 7,
  levelCode: string | null = null,
  name = `Skill ${id}`,
) => ({ id, name, levelCode, daysSinceTouched });

describe('planDay', () => {
  it('empty context with streak at risk and yesterday exercise → returns 1 streak_keeper', () => {
    const plan = planDay({
      userContext: baseContext({
        streakAtRisk: true,
        yesterdayExercise: { exerciseId: 'ex-1', promptShort: 'What is idempotency?' },
      }),
    });
    expect(plan).toHaveLength(1);
    const first = plan[0] as PlannedTaskInput;
    expect(first.kind).toBe('streak_keeper');
    expect(first.refKind).toBe('exercise');
    expect(first.refId).toBe('ex-1');
  });

  it('full context → returns 3–5 tasks in priority order', () => {
    const plan = planDay({
      userContext: baseContext({
        currentWeek: {
          id: 'wk-1',
          weekIndex: 1,
          title: 'Linux basics',
          lessonIds: ['L1', 'L2'],
          labIds: ['LAB1'],
        },
        unfinishedLessons: [lessonCtx('L1'), lessonCtx('L2')],
        unfinishedLabs: [labCtx('LAB1')],
        weakSkills: [weakCtx('S1', 10), weakCtx('S2', 3)],
        yesterdayExercise: { exerciseId: 'ex-9', promptShort: 'recall ssh' },
        streakAtRisk: true,
      }),
    });

    expect(plan.length).toBeGreaterThanOrEqual(3);
    expect(plan.length).toBeLessThanOrEqual(5);

    const kinds = plan.map((p) => p.kind);
    // Order: streak_keeper → lesson → lab → weak_skill_review (→ stretch)
    expect(kinds[0]).toBe('streak_keeper');
    expect(kinds[1]).toBe('lesson');
    expect(kinds[2]).toBe('lab');
    expect(kinds).toContain('weak_skill_review');
  });

  it('all caught up but weak skills exist → returns stretch goal', () => {
    const plan = planDay({
      userContext: baseContext({
        weakSkills: [weakCtx('S1', 2, 'XS')],
      }),
      options: { minTasks: 1 },
    });
    // No lessons, no labs, not at-risk → weak review + stretch fall through.
    const kinds = plan.map((p) => p.kind);
    expect(kinds).toContain('stretch');
  });

  it('weak skills present → at least 1 weak_skill_review, least-recently-touched first', () => {
    const plan = planDay({
      userContext: baseContext({
        weakSkills: [
          weakCtx('FRESH', 1),
          weakCtx('STALE', 30),
          weakCtx('MID', 7),
        ],
      }),
    });
    const weak = plan.find((p) => p.kind === 'weak_skill_review');
    expect(weak).toBeDefined();
    expect(weak?.refId).toBe('STALE');
  });

  it('unfinished labs but no current week → at least 1 lab task (carryover)', () => {
    const plan = planDay({
      userContext: baseContext({
        unfinishedLabs: [labCtx('LAB-A'), labCtx('LAB-B')],
      }),
    });
    const labTasks = plan.filter((p) => p.kind === 'lab');
    expect(labTasks.length).toBeGreaterThanOrEqual(1);
    expect(labTasks[0]?.refId).toBe('LAB-A');
  });

  it('streak at risk → streak_keeper is first', () => {
    const plan = planDay({
      userContext: baseContext({
        currentWeek: {
          id: 'wk-1',
          weekIndex: 1,
          title: 'Linux',
          lessonIds: ['L1'],
          labIds: [],
        },
        unfinishedLessons: [lessonCtx('L1')],
        unfinishedLabs: [labCtx('LAB1')],
        weakSkills: [weakCtx('S1', 5)],
        yesterdayExercise: { exerciseId: 'EX-1', promptShort: 'foo' },
        streakAtRisk: true,
      }),
    });
    expect(plan[0]?.kind).toBe('streak_keeper');
  });
});
