'use client';

/**
 * useSkills — client hook for Skills Matrix data.
 *
 * Pattern: Server Component pre-renders initial data (`initialData`),
 * this hook handles client refetch / cache invalidation after mutation.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSkillsForWorkspace } from '@/lib/api';
import type { SkillRow } from '@/types';

const KEY = (slug: string) => ['skills', slug] as const;

export function useSkills(workspaceSlug: string, initialData?: SkillRow[]) {
  return useQuery<SkillRow[]>({
    queryKey: KEY(workspaceSlug),
    queryFn: () => getSkillsForWorkspace(workspaceSlug),
    initialData,
    enabled: !!workspaceSlug,
  });
}

/** Call after mutating an assessment to refresh skills cache. */
export function useInvalidateSkills() {
  const qc = useQueryClient();
  return (workspaceSlug: string) => qc.invalidateQueries({ queryKey: KEY(workspaceSlug) });
}
