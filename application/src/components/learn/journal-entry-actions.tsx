'use client';

/**
 * Per-entry inline actions for a journal entry: edit + delete.
 *
 * Rendered by JournalSection only when the current viewer is the author or
 * has effective level >= EDITOR. The visibility decision is made server-side;
 * this component does not re-check it.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { JournalEntryDialog } from './journal-entry-dialog';
import { deleteJournalEntry } from '@/actions/node-journal';

export function JournalEntryActions({
  workspaceSlug,
  entry,
}: {
  workspaceSlug: string;
  entry: {
    id: string;
    title: string;
    bodyMd: string;
    tags: string[];
  };
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const onDelete = () => {
    if (!window.confirm(`Xoá bài "${entry.title}"?`)) return;
    startTransition(async () => {
      try {
        await deleteJournalEntry({ workspaceSlug, entryId: entry.id });
        toast.success('Đã xoá');
        router.refresh();
      } catch (e) {
        toast.error('Lỗi xoá', { description: String(e) });
      }
    });
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          onClick={() => setEditOpen(true)}
          variant="ghost"
          size="sm"
          className="h-7 px-2"
        >
          <Pencil className="size-3" />
          Sửa
        </Button>
        <Button
          onClick={onDelete}
          disabled={pending}
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-destructive hover:text-destructive"
        >
          {pending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Trash2 className="size-3" />
          )}
          Xoá
        </Button>
      </div>

      <JournalEntryDialog
        mode="edit"
        open={editOpen}
        onOpenChange={setEditOpen}
        workspaceSlug={workspaceSlug}
        entry={entry}
      />
    </>
  );
}
