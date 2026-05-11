'use client';

import { useQuery } from '@tanstack/react-query';
import { getHeartsForWorkspace, getStreakForWorkspace } from '@/lib/api';
import type { Hearts, Streak } from '@/types';

export function useHearts(workspaceSlug: string, initialData?: Hearts) {
  return useQuery<Hearts>({
    queryKey: ['hearts', workspaceSlug],
    queryFn: () => getHeartsForWorkspace(workspaceSlug),
    initialData,
  });
}

export function useStreak(workspaceSlug: string, initialData?: Streak) {
  return useQuery<Streak>({
    queryKey: ['streak', workspaceSlug],
    queryFn: () => getStreakForWorkspace(workspaceSlug),
    initialData,
  });
}
