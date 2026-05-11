'use client';

import { useQuery } from '@tanstack/react-query';
import { getActivityForWorkspace } from '@/lib/api';
import type { ActivityEntry } from '@/types';

export function useActivity(workspaceSlug: string, initialData?: ActivityEntry[]) {
  return useQuery<ActivityEntry[]>({
    queryKey: ['activity', workspaceSlug],
    queryFn: () => getActivityForWorkspace(workspaceSlug),
    initialData,
    enabled: !!workspaceSlug,
  });
}
