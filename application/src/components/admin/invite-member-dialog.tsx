/**
 * InviteMemberDialog — client component used on /w/[slug]/members.
 *
 * Wraps shadcn Dialog. Calls the `inviteWorkspaceMember` server action; surfaces
 * the server-thrown error string under the form. MVP accepts a user-id (UUID)
 * directly — once Supabase admin email lookup is wired we can accept emails.
 */
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { inviteWorkspaceMember } from '@/actions/workspace-members';

type Role = 'learner' | 'workspace_contributor' | 'workspace_editor';

export function InviteMemberDialog({ workspaceSlug }: { workspaceSlug: string }) {
  const [open, setOpen] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [role, setRole] = useState<Role>('learner');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function reset() {
    setIdentifier('');
    setRole('learner');
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await inviteWorkspaceMember(workspaceSlug, identifier, role);
        reset();
        setOpen(false);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'INVITE_FAILED';
        setError(msg);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4" />
          Invite member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
          <DialogDescription>
            MVP: paste the user UUID. Email lookup is not wired yet — once we
            enable Supabase admin lookup, the same input will accept emails.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">User UUID</span>
            <Input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              autoFocus
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="flex h-10 w-full rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="learner">Learner</option>
              <option value="workspace_contributor">Contributor</option>
              <option value="workspace_editor">Editor</option>
            </select>
          </label>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" type="button">
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={submit} disabled={pending || identifier.trim().length === 0}>
            {pending ? 'Inviting…' : 'Send invite'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
