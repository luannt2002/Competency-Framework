'use client';

/**
 * "Add new post" trigger: opens the create-mode JournalEntryDialog.
 *
 * Rendered by JournalSection only when readOnly is false and the viewer has
 * at least LEARNER level (member of the workspace). Visibility is decided
 * server-side; this component just owns the open-state for the dialog.
 */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { JournalEntryDialog } from './journal-entry-dialog';

export function JournalAddButton({
  workspaceSlug,
  nodeId,
}: {
  workspaceSlug: string;
  nodeId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" variant="default">
        <Plus className="size-3" />
        Đăng bài mới
      </Button>
      <JournalEntryDialog
        mode="create"
        open={open}
        onOpenChange={setOpen}
        workspaceSlug={workspaceSlug}
        nodeId={nodeId}
      />
    </>
  );
}
