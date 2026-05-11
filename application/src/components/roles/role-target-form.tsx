'use client';

/**
 * RoleTargetForm — pick a role profile + optional target date and persist it
 * as the current user's role target via `setUserRoleTarget`.
 *
 * Renders inline (no dialog) on `/w/[slug]/roles`. Submission uses a transition
 * + `router.refresh()` to revalidate the page server-side.
 */

import { useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Target } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { setUserRoleTarget } from '@/actions/role-profiles';
import { cn } from '@/lib/utils';

export type RoleOption = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
};

type Props = {
  workspaceSlug: string;
  roles: RoleOption[];
  currentRoleId: string | null;
  currentTargetDate: string | null;
  className?: string;
};

export function RoleTargetForm({
  workspaceSlug,
  roles,
  currentRoleId,
  currentTargetDate,
  className,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [roleId, setRoleId] = useState<string>(currentRoleId ?? '');
  const [targetDate, setTargetDate] = useState<string>(currentTargetDate ?? '');

  const formId = useId();
  const roleSelectId = `${formId}-role`;
  const dateId = `${formId}-date`;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roleId) {
      toast.error('Pick a role first');
      return;
    }
    startTransition(async () => {
      try {
        await setUserRoleTarget({
          workspaceSlug,
          roleId,
          targetDate: targetDate.length > 0 ? targetDate : undefined,
        });
        toast.success('Target role saved');
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        toast.error(`Could not save target: ${message}`);
      }
    });
  }

  if (roles.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No role profiles exist in this workspace yet. Roles must be created by a
        workspace admin before you can pick a target.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={roleSelectId} className="text-sm font-medium">
          Target role
        </label>
        <select
          id={roleSelectId}
          value={roleId}
          onChange={(e) => setRoleId(e.currentTarget.value)}
          className="flex h-10 w-full rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          required
        >
          <option value="">— Select a role —</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={dateId} className="text-sm font-medium">
          Target date <span className="text-xs text-muted-foreground">(optional)</span>
        </label>
        <Input
          id={dateId}
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.currentTarget.value)}
        />
      </div>

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Target className="size-4" />
              Save target role
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
