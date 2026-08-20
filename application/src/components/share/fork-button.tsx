'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { GitFork, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { forkWorkspace } from '@/actions/workspaces';

type Props = {
  sourceSlug: string;
  /** null = not logged in, string = logged-in user id */
  viewerId: string | null;
  /** true if the viewer owns this workspace (don't show fork to yourself) */
  isOwner: boolean;
};

export function ForkButton({ sourceSlug, viewerId, isOwner }: Props) {
  const [pending, startTransition] = useTransition();

  if (isOwner) return null;

  if (!viewerId) {
    return (
      <Button asChild size="sm" variant="default">
        <Link href={`/sign-in?next=/share/${sourceSlug}`}>
          <GitFork className="size-4" />
          Fork roadmap này
        </Link>
      </Button>
    );
  }

  return (
    <form
      action={(fd) => {
        startTransition(() => {
          forkWorkspace(fd);
        });
      }}
    >
      <input type="hidden" name="sourceSlug" value={sourceSlug} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <GitFork className="size-4" />
        )}
        {pending ? 'Đang fork…' : 'Fork roadmap này'}
      </Button>
    </form>
  );
}
