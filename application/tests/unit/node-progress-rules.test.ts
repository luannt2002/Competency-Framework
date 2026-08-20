import { describe, it, expect } from 'vitest';
import {
  NODE_XP,
  XP,
  nodeCompletionXp,
  streakMilestoneBonus,
} from '@/lib/learn/xp-rules';
import { hasEvidence } from '@/lib/learn/node-progress';
import {
  planDay,
  nodeTaskKind,
  type UserContext,
  type NodeTaskContext,
} from '@/lib/learn/daily-planner';

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

const node = (
  id: string,
  over: Partial<NodeTaskContext> = {},
): NodeTaskContext => ({
  id,
  title: `Node ${id}`,
  slug: `node-${id}`,
  nodeType: 'lesson',
  estMinutes: 20,
  inProgress: false,
  ...over,
});

describe('nodeCompletionXp — USER_FLOWS Flow F pricing', () => {
  it('a leaf pays the leaf award regardless of depth', () => {
    expect(nodeCompletionXp({ depth: 0, hasChildren: false })).toBe(NODE_XP.LEAF);
    expect(nodeCompletionXp({ depth: 4, hasChildren: false })).toBe(NODE_XP.LEAF);
  });

  it('containers pay by depth: root → 500, level 1 → 200, level 2 → 50', () => {
    expect(nodeCompletionXp({ depth: 0, hasChildren: true })).toBe(NODE_XP.ROOT);
    expect(nodeCompletionXp({ depth: 1, hasChildren: true })).toBe(NODE_XP.LEVEL_1);
    expect(nodeCompletionXp({ depth: 2, hasChildren: true })).toBe(NODE_XP.LEVEL_2);
  });

  it('containers below level 2 fall back to the leaf award', () => {
    expect(nodeCompletionXp({ depth: 3, hasChildren: true })).toBe(NODE_XP.LEAF);
    expect(nodeCompletionXp({ depth: 9, hasChildren: true })).toBe(NODE_XP.LEAF);
  });
});

describe('streakMilestoneBonus', () => {
  it('pays only on the exact milestone day', () => {
    expect(streakMilestoneBonus(7)).toBe(XP.STREAK_7);
    expect(streakMilestoneBonus(30)).toBe(XP.STREAK_30);
    expect(streakMilestoneBonus(6)).toBe(0);
    expect(streakMilestoneBonus(8)).toBe(0);
    expect(streakMilestoneBonus(31)).toBe(0);
  });
});

describe('hasEvidence', () => {
  it('treats null, empty and whitespace-only lists as no evidence', () => {
    expect(hasEvidence(null)).toBe(false);
    expect(hasEvidence([])).toBe(false);
    expect(hasEvidence(['   '])).toBe(false);
  });

  it('is true when at least one URL has content', () => {
    expect(hasEvidence(['https://example.com'])).toBe(true);
    expect(hasEvidence(['', 'https://example.com'])).toBe(true);
  });
});

describe('nodeTaskKind', () => {
  it('maps hands-on node types onto the lab kind', () => {
    expect(nodeTaskKind('lab')).toBe('lab');
    expect(nodeTaskKind('project')).toBe('lab');
    expect(nodeTaskKind('exam')).toBe('lab');
  });

  it('maps everything else onto the lesson kind', () => {
    expect(nodeTaskKind('lesson')).toBe('lesson');
    expect(nodeTaskKind('reading')).toBe('lesson');
    expect(nodeTaskKind('anything-custom')).toBe('lesson');
  });
});

describe('planDay — roadmap tree nodes (Flow B5)', () => {
  it('emits node tasks with refKind "node" so the row can deep-link', () => {
    const plan = planDay({
      userContext: baseContext({ unfinishedNodes: [node('A'), node('B')] }),
    });
    expect(plan.length).toBeGreaterThanOrEqual(2);
    expect(plan.every((t) => t.refKind === 'node')).toBe(true);
    expect(plan.map((t) => t.refId)).toContain('A');
  });

  it('keeps the caller-supplied order — started nodes come first', () => {
    const plan = planDay({
      userContext: baseContext({
        unfinishedNodes: [node('STARTED', { inProgress: true }), node('NEXT')],
      }),
    });
    expect(plan[0]?.refId).toBe('STARTED');
    expect(plan[0]?.description).toContain('Đang học dở');
  });

  it('never lets the node backlog fill more than the 5-task cap', () => {
    const many = Array.from({ length: 20 }, (_, i) => node(`N${i}`));
    const plan = planDay({ userContext: baseContext({ unfinishedNodes: many }) });
    expect(plan.length).toBeLessThanOrEqual(5);
  });

  it('still puts streak_keeper first when the streak is at risk', () => {
    const plan = planDay({
      userContext: baseContext({
        unfinishedNodes: [node('A'), node('B')],
        streakAtRisk: true,
        yesterdayExercise: { exerciseId: 'ex-1', promptShort: 'recall' },
      }),
    });
    expect(plan[0]?.kind).toBe('streak_keeper');
    expect(plan[1]?.refKind).toBe('node');
  });

  it('drops nodes too long for one sitting', () => {
    const plan = planDay({
      userContext: baseContext({
        unfinishedNodes: [
          node('WEEK', { estMinutes: 480 }),
          node('LESSON', { estMinutes: 20 }),
        ],
      }),
    });
    const refs = plan.map((t) => t.refId);
    expect(refs).toContain('LESSON');
    expect(refs).not.toContain('WEEK');
  });

  it('keeps oversized nodes when they are the only thing left to do', () => {
    const plan = planDay({
      userContext: baseContext({
        unfinishedNodes: [node('WEEK', { estMinutes: 480 })],
      }),
    });
    expect(plan.map((t) => t.refId)).toContain('WEEK');
  });

  it('is a no-op for lesson-only workspaces (unfinishedNodes undefined)', () => {
    const plan = planDay({
      userContext: baseContext({
        currentWeek: {
          id: 'wk-1',
          weekIndex: 1,
          title: 'Linux',
          lessonIds: ['L1'],
          labIds: [],
        },
        unfinishedLessons: [{ id: 'L1', title: 'Lesson 1', estMinutes: 8 }],
      }),
    });
    expect(plan.some((t) => t.refKind === 'node')).toBe(false);
    expect(plan[0]?.kind).toBe('lesson');
  });
});
