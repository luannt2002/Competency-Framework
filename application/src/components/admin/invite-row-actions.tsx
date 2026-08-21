/**
 * InviteRowActions — nút thu hồi cho một dòng workspace_invites pending
 * trong bảng "Pending invites" ở /w/[slug]/members. OWNER-only action.
 */
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { revokeInvite } from '@/actions/workspace-members';

export function InviteRowActions({
  workspaceSlug,
  inviteId,
}: {
  workspaceSlug: string;
  inviteId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onRevoke() {
    if (!confirm('Thu hồi lời mời này? Người đó sẽ không tự vào workspace khi đăng nhập.')) return;
    setError(null);
    startTransition(async () => {
      try {
        await revokeInvite(workspaceSlug, inviteId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'REVOKE_FAILED');
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Tooltip label="Revoke invite">
        <Button
          size="sm"
          variant="ghost"
          onClick={onRevoke}
          disabled={pending}
          aria-label="Revoke invite"
          className="text-destructive hover:bg-destructive/10"
        >
          <Ban className="size-4" />
        </Button>
      </Tooltip>
      {error && <span className="text-[10px] text-destructive">{error}</span>}
    </div>
  );
}
