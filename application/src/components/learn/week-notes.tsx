'use client';

/**
 * Week notes — list of personal notes per week (L3 layer).
 * Plain markdown body, timestamp, delete.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { StickyNote, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { addWeekNote, deleteWeekNote, type WeekNote } from '@/actions/notes';
import { relativeTime } from '@/lib/utils';

type Props = {
  workspaceSlug: string;
  weekId: string;
  notes: WeekNote[];
};

export function WeekNotes({ workspaceSlug, weekId, notes }: Props) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [pending, startTransition] = useTransition();

  const add = () => {
    if (!body.trim()) return;
    startTransition(async () => {
      try {
        await addWeekNote({ workspaceSlug, weekId, bodyMd: body.trim() });
        setBody('');
        toast.success('Note added');
        router.refresh();
      } catch (e) {
        toast.error('Add failed', { description: String(e) });
      }
    });
  };

  const remove = (noteId: string) => {
    if (!window.confirm('Delete this note?')) return;
    startTransition(async () => {
      try {
        await deleteWeekNote({ workspaceSlug, noteId });
        toast.success('Note deleted');
        router.refresh();
      } catch (e) {
        toast.error('Delete failed', { description: String(e) });
      }
    });
  };

  return (
    <section className="surface overflow-hidden">
      <header className="p-4 border-b border-border bg-secondary/20 flex items-center gap-2">
        <StickyNote className="size-4 text-amber-300" />
        <h3 className="font-semibold text-sm">Your notes for this week</h3>
        <span className="text-xs text-muted-foreground">({notes.length})</span>
      </header>

      <div className="p-4 space-y-3">
        {/* Add note form */}
        <div className="space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Personal note — code snippet, idea, gotcha, doubt to revisit later... (markdown supported)"
            rows={3}
            disabled={pending}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                add();
              }
            }}
          />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">
              ⌘+Enter to add quickly
            </p>
            <Button size="sm" onClick={add} disabled={pending || !body.trim()}>
              {pending ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
              Add note
            </Button>
          </div>
        </div>

        {/* List */}
        {notes.length > 0 && (
          <ul className="space-y-2 pt-2 border-t border-border">
            {notes.map((n) => (
              <li
                key={n.id}
                className="group rounded-xl border border-border bg-secondary/30 p-3 transition-colors hover:bg-secondary/50"
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{n.bodyMd}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {n.createdAt ? relativeTime(n.createdAt) : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(n.id)}
                    className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80"
                    title="Delete"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {notes.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            No notes yet — capture your thoughts as you learn.
          </p>
        )}
      </div>
    </section>
  );
}
