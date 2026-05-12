/**
 * VisibilityToggle — segmented private/public switch wired to
 * `setWorkspaceVisibility`. The DB enum stores 'public-readonly' for the
 * "public" branch; the action handles the mapping.
 */
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Globe2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { setWorkspaceVisibility, type VisibilityValue } from '@/actions/workspace-admin';

export function VisibilityToggle({
  workspaceSlug,
  initialValue,
}: {
  workspaceSlug: string;
  /** UI-facing value: 'private' | 'public' (public = public-readonly in DB). */
  initialValue: VisibilityValue;
}) {
  const [value, setValue] = useState<VisibilityValue>(initialValue);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function pick(next: VisibilityValue) {
    if (next === value || pending) return;
    setError(null);
    const prev = value;
    setValue(next);
    startTransition(async () => {
      try {
        await setWorkspaceVisibility(workspaceSlug, next);
        router.refresh();
      } catch (e) {
        setValue(prev);
        setError(e instanceof Error ? e.message : 'UPDATE_FAILED');
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="inline-flex rounded-xl border border-border bg-secondary/40 p-1">
        <button
          type="button"
          onClick={() => pick('private')}
          disabled={pending}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
            value === 'private'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Lock className="size-3.5" /> Private
        </button>
        <button
          type="button"
          onClick={() => pick('public')}
          disabled={pending}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
            value === 'public'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Globe2 className="size-3.5" /> Public
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        {value === 'private'
          ? 'Only members can access this workspace.'
          : 'Anyone with the share link can read this workspace (no edits).'}
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
