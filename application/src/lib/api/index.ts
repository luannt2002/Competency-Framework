/**
 * Typed API facade — single import surface for client + server code.
 *
 * Pattern:
 *   - Server actions remain the source of truth for mutations
 *     (re-exported here with stable names).
 *   - For reads, this module calls API routes backed by real DB queries.
 *   - Components import from '@/lib/api' — NEVER from '@/actions/*' directly.
 */
import { fetchJson } from '@/lib/api/fetch-json';
import type {
  SkillRow,
  CompetencyLevel,
  CareerStage,
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

/* ===== Read wrappers (used by client hooks via TanStack Query) ===== */
export async function getSkillsForWorkspace(workspaceSlug: string): Promise<SkillRow[]> {
  return fetchJson<SkillRow[]>(`/api/workspaces/${workspaceSlug}/skills`);
}

export async function getLevelsForWorkspace(workspaceSlug: string): Promise<CompetencyLevel[]> {
  return fetchJson<CompetencyLevel[]>(`/api/workspaces/${workspaceSlug}/levels`);
}

export async function getActivityForWorkspace(workspaceSlug: string): Promise<ActivityEntry[]> {
  return fetchJson<ActivityEntry[]>(`/api/workspaces/${workspaceSlug}/activity`);
}

export async function getHeartsForWorkspace(workspaceSlug: string): Promise<Hearts> {
  return fetchJson<Hearts>(`/api/workspaces/${workspaceSlug}/hearts`);
}

export async function getStreakForWorkspace(workspaceSlug: string): Promise<Streak> {
  return fetchJson<Streak>(`/api/workspaces/${workspaceSlug}/streak`);
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
