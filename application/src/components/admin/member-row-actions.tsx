/**
 * MemberRowActions — inline change-role select + remove button for a single
 * workspace_members row. Used in the members admin table.
 */
'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { updateMemberRole, removeMember } from '@/actions/workspace-members';
import { Tooltip } from '@/components/ui/tooltip';

type Role = 'learner' | 'workspace_contributor' | 'workspace_editor';

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'learner', label: 'Learner' },
  { value: 'workspace_contributor', label: 'Contributor' },
  { value: 'workspace_editor', label: 'Editor' },
];

export function MemberRowActions({
  workspaceSlug,
  memberId,
  currentRole,
}: {
  workspaceSlug: string;
  memberId: string;
  currentRole: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Coerce unknown DB roles to a known option; surface as 'learner' visually.
  const initial: Role = (ROLE_OPTIONS.find((o) => o.value === currentRole)?.value ?? 'learner');
  const [role, setRole] = useState<Role>(initial);

  function changeRole(next: Role) {
    setRole(next);
    setError(null);
    startTransition(async () => {
      try {
        await updateMemberRole(workspaceSlug, memberId, next);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'UPDATE_FAILED');
        setRole(initial);
      }
    });
  }

  function onRemove() {
    if (!confirm('Remove this member from the workspace?')) return;
    setError(null);
    startTransition(async () => {
      try {
        await removeMember(workspaceSlug, memberId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'REMOVE_FAILED');
      }
    });
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      <Tooltip label="Change role">
        <select
          value={role}
          onChange={(e) => changeRole(e.target.value as Role)}
          disabled={pending}
          aria-label="Change role"
          className="h-8 rounded-lg border border-border bg-secondary/40 px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Tooltip>
      <Tooltip label="Remove member">
        <Button
          size="sm"
          variant="ghost"
          onClick={onRemove}
          disabled={pending}
          aria-label="Remove member"
          className="text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="size-4" />
        </Button>
      </Tooltip>
      {error && <span className="text-[10px] text-destructive">{error}</span>}
    </div>
  );
}
