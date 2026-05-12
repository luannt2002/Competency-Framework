'use client';

/**
 * Inline quick-note composer rendered above the JournalSection on a node
 * detail page. Provides a low-friction path to capture a thought without
 * opening the full JournalEntryDialog.
 *
 * - Single textarea + Save button
 * - Auto-saves on blur if there's content (and no save already in flight)
 * - Derives a title from the first 60 chars of the body (or "Quick note")
 * - Calls the existing createJournalEntry server action
 *
 * Visibility is decided server-side (LEARNER+) so this client component is
 * only mounted on the page when allowed.
 */
import { useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Save, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { createJournalEntry } from '@/actions/node-journal';
import { useDraft } from '@/lib/hooks/use-draft';

type Props = {
  workspaceSlug: string;
  nodeId: string;
};

function deriveTitle(body: string): string {
  const firstLine = body.split(/\r?\n/)[0]?.trim() ?? '';
  if (!firstLine) return 'Quick note';
  return firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine;
}

export function QuickNoteComposer({ workspaceSlug, nodeId }: Props) {
  const router = useRouter();
  // Quick notes survive page nav via a localStorage draft scoped to the node.
  const [body, setBody, clearBody] = useDraft(`quick-note:${nodeId}`, '');
  const [pending, startTransition] = useTransition();
  const savingRef = useRef(false);

  const submit = (opts?: { silent?: boolean }) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    if (savingRef.current) return;
    savingRef.current = true;
    startTransition(async () => {
      try {
        await createJournalEntry({
          workspaceSlug,
          nodeId,
          title: deriveTitle(trimmed),
          bodyMd: trimmed,
        });
        clearBody();
        if (!opts?.silent) toast.success('Đã lưu note');
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error('Lỗi lưu note', { description: msg });
      } finally {
        savingRef.current = false;
      }
    });
  };

  return (
    <div className="surface p-4 space-y-2 border-dashed border-[#ff6b6b]/30 bg-[#ff6b6b]/5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-mono text-muted-foreground">
        <StickyNote className="size-3.5 text-[#ff6b6b]" />
        Note nhanh
      </div>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={() => submit({ silent: true })}
        placeholder="Note nhanh — bạn vừa học gì?"
        rows={2}
        className="resize-none bg-transparent"
      />
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          Tự lưu khi rời ô · hoặc nhấn Save
        </p>
        <Button
          type="button"
          size="sm"
          onClick={() => submit()}
          disabled={pending || !body.trim()}
        >
          {pending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Save className="size-3" />
          )}
          Save
        </Button>
      </div>
    </div>
  );
}
