/**
 * InviteMemberDialog — client component used on /w/[slug]/members.
 *
 * Wraps shadcn Dialog. Calls the `inviteWorkspaceMember` server action; surfaces
 * the server-thrown error string under the form. Chấp nhận email HOẶC user-id
 * (UUID). Email của người CHƯA từng đăng nhập → invite pending (D2.5): họ tự
 * vào workspace ở lần đăng nhập đầu tiên (hiện thông báo rõ cho admin).
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
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function reset() {
    setIdentifier('');
    setRole('learner');
    setError(null);
    setNotice(null);
  }

  function submit() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await inviteWorkspaceMember(workspaceSlug, identifier, role);
        if (result.outcome === 'invite_pending') {
          // D2.5 — không gửi email tự động (chưa có SMTP): admin tự chuyển
          // thông tin cho người được mời. Copy honest, không hứa email.
          setNotice(
            `Đã tạo lời mời pending cho ${result.email ?? identifier.trim()}. ` +
              'Người này sẽ tự động vào workspace khi đăng nhập bằng email này.',
          );
          setIdentifier('');
        } else {
          reset();
          setOpen(false);
          router.refresh();
        }
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
            <span className="text-xs font-medium text-muted-foreground">Email hoặc User UUID</span>
            <Input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="teammate@company.com"
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
          {notice && (
            <p className="text-xs text-primary bg-primary/10/10 border border-primary/40/30 rounded-md px-3 py-2">
              {notice}
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
