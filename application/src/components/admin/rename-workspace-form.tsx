/**
 * RenameWorkspaceForm — inline rename input with a save button. Calls the
 * `renameWorkspace` server action then refreshes the route.
 */
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { renameWorkspace } from '@/actions/workspace-admin';

export function RenameWorkspaceForm({
  workspaceSlug,
  initialName,
}: {
  workspaceSlug: string;
  initialName: string;
}) {
  const [name, setName] = useState(initialName);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const dirty = name.trim() !== initialName.trim();

  function submit() {
    setMsg(null);
    startTransition(async () => {
      try {
        await renameWorkspace(workspaceSlug, name.trim());
        setMsg('Saved.');
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'SAVE_FAILED');
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="flex-1 space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Workspace name</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </label>
      <Button onClick={submit} disabled={!dirty || pending || name.trim().length === 0}>
        <Save className="size-4" />
        {pending ? 'Saving…' : 'Save'}
      </Button>
      {msg && <p className="text-xs text-muted-foreground sm:ml-3">{msg}</p>}
    </div>
  );
}
