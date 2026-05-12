'use client';

/**
 * Client form for posting a comment or reply.
 *
 * Used both at the bottom of the thread (root composer) and inline beneath an
 * existing comment when the user clicks "Trả lời" (reply composer). The form
 * is a thin wrapper around the `addComment` server action — refresh on success
 * so the new comment shows up. Empty/whitespace-only submits are blocked.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { addComment } from '@/actions/comments';

type Props = {
  workspaceSlug: string;
  nodeId: string;
  /** When set, this composer posts a reply to that comment. */
  parentCommentId?: string;
  /** Visible when used as an inline reply box; the parent Cancel handler. */
  onCancel?: () => void;
  /** Optional placeholder override. */
  placeholder?: string;
  autoFocus?: boolean;
};

export function CommentComposer({
  workspaceSlug,
  nodeId,
  parentCommentId,
  onCancel,
  placeholder,
  autoFocus = false,
}: Props) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    startTransition(async () => {
      try {
        await addComment({
          workspaceSlug,
          nodeId,
          body: trimmed,
          parentCommentId,
        });
        setBody('');
        toast.success(parentCommentId ? 'Đã trả lời' : 'Đã gửi bình luận');
        if (onCancel) onCancel();
        router.refresh();
      } catch (e) {
        toast.error('Lỗi', { description: String(e) });
      }
    });
  };

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={parentCommentId ? 2 : 3}
        placeholder={
          placeholder ?? (parentCommentId ? 'Trả lời...' : 'Viết bình luận...')
        }
        maxLength={5000}
        autoFocus={autoFocus}
      />
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel} type="button">
            <X className="size-3" />
            Huỷ
          </Button>
        )}
        <Button
          size="sm"
          onClick={submit}
          disabled={pending || !body.trim()}
          type="button"
        >
          {pending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Send className="size-3" />
          )}
          {parentCommentId ? 'Trả lời' : 'Gửi'}
        </Button>
      </div>
    </div>
  );
}
