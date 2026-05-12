/**
 * DeleteWorkspaceForm — danger-zone double-confirm delete. Requires typing the
 * exact slug AND confirming a window prompt before invoking `deleteWorkspace`.
 * On success the action redirects to `/`.
 */
'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { deleteWorkspace } from '@/actions/workspace-admin';

export function DeleteWorkspaceForm({ workspaceSlug }: { workspaceSlug: string }) {
  const [typed, setTyped] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const matches = typed.trim() === workspaceSlug;

  function submit() {
    if (!matches) return;
    if (!confirm(`Permanently delete workspace "${workspaceSlug}"? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteWorkspace(workspaceSlug);
        // deleteWorkspace redirects to '/' on success — this line is unreachable.
      } catch (e) {
        // Next.js redirect surfaces as a special error; let it propagate.
        if (e instanceof Error && e.message === 'NEXT_REDIRECT') throw e;
        setError(e instanceof Error ? e.message : 'DELETE_FAILED');
      }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Type the workspace slug{' '}
        <code
          className="rounded bg-secondary/60 px-1.5 py-0.5 text-[11px]"
          style={{ fontFamily: 'var(--font-jetbrains), monospace' }}
        >
          {workspaceSlug}
        </code>{' '}
        below to enable the delete button.
      </p>
      <Input
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={workspaceSlug}
      />
      <Button
        type="button"
        variant="destructive"
        onClick={submit}
        disabled={!matches || pending}
      >
        <Trash2 className="size-4" />
        {pending ? 'Deleting…' : 'Delete workspace'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
