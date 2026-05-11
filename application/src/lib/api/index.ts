/**
 * Typed API facade — single import surface for client + server code.
 *
 * Pattern:
 *   - Server actions remain the source of truth for mutations
 *     (re-exported here with stable names).
 *   - For reads, this module wraps them with mock fallback.
 *   - Components import from '@/lib/api' — NEVER from '@/actions/*' directly.
 *
 * Why: lets us swap real Supabase backend for mock in dev or tests by flipping
 *      NEXT_PUBLIC_USE_MOCK env without touching components.
 */
import { USE_MOCK } from '@/lib/api-config';
import * as mock from '@/lib/mock-data/devops';
import type {
  SkillRow,
  CompetencyLevel,
  CareerStage,
  Workspace,
  ActivityEntry,
  Hearts,
  Streak,
} from '@/types';

/* ===== Re-export server actions as the canonical API ===== */
export {
  forkTemplate,
} from '@/actions/workspaces';
export {
  updateAssessment,
} from '@/actions/assessments';
export {
  startLesson,
  submitExercise,
  completeLesson,
} from '@/actions/learn';

/* ===== Mock fallback wrappers (used by client hooks via TanStack Query) ===== */
export async function getSkillsForWorkspace(_workspaceSlug: string): Promise<SkillRow[]> {
  if (USE_MOCK) return mock.mockSkillRows;
  // In real flow, the Server Component already fetches skills server-side;
  // this client hook is for refetch after mutation. Implement via fetch to an API route
  // if we want client refetch. For now, page revalidatePath handles freshness.
  return [];
}

export async function getLevelsForWorkspace(_workspaceSlug: string): Promise<CompetencyLevel[]> {
  if (USE_MOCK) return mock.mockLevels;
  return [];
}

export async function getActivityForWorkspace(_workspaceSlug: string): Promise<ActivityEntry[]> {
  if (USE_MOCK) return mock.mockActivity;
  return [];
}

export async function getHeartsForWorkspace(_workspaceSlug: string): Promise<Hearts> {
  if (USE_MOCK) return mock.mockHearts;
  return { current: 5, max: 5, nextRefillAt: null };
}

export async function getStreakForWorkspace(_workspaceSlug: string): Promise<Streak> {
  if (USE_MOCK) return mock.mockStreak;
  return { currentStreak: 0, longestStreak: 0, lastActiveDate: null, freezeCount: 0 };
}

/* ===== Career stage mapping (derived helper, pure) ===== */
export function resolveCareerStage(
  coveragePercent: number,
  stages: CareerStage[],
): CareerStage | null {
  const sorted = [...stages].sort((a, b) => a.minNumeric - b.minNumeric);
  let match: CareerStage | null = null;
  for (const s of sorted) {
    if (coveragePercent >= s.minNumeric) match = s;
    else break;
  }
  return match;
}
