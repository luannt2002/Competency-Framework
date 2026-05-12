'use client';

/**
 * Per-comment actions: "Trả lời" (toggle the inline reply composer) and
 * "Xoá" (server action). Visibility of the delete button is decided
 * server-side in CommentThread; this component just renders what it's told.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, MessageSquare, Trash2 } from 'lucide-react';
import { deleteComment } from '@/actions/comments';
import { CommentComposer } from './comment-composer';
import { Tooltip } from '@/components/ui/tooltip';

type Props = {
  workspaceSlug: string;
  nodeId: string;
  commentId: string;
  canDelete: boolean;
  canReply: boolean;
};

export function CommentItemActions({
  workspaceSlug,
  nodeId,
  commentId,
  canDelete,
  canReply,
}: Props) {
  const router = useRouter();
  const [replyOpen, setReplyOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const onDelete = () => {
    if (!confirm('Xoá bình luận này?')) return;
    startTransition(async () => {
      try {
        await deleteComment({ workspaceSlug, commentId });
        toast.success('Đã xoá');
        router.refresh();
      } catch (e) {
        toast.error('Lỗi', { description: String(e) });
      }
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        {canReply && (
          <Tooltip label={replyOpen ? 'Đóng ô trả lời' : 'Trả lời bình luận'}>
            <button
              type="button"
              onClick={() => setReplyOpen((v) => !v)}
              aria-label={replyOpen ? 'Đóng ô trả lời' : 'Trả lời bình luận'}
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <MessageSquare className="size-3" />
              {replyOpen ? 'Đóng' : 'Trả lời'}
            </button>
          </Tooltip>
        )}
        {canDelete && (
          <Tooltip label="Xoá bình luận">
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              aria-label="Xoá bình luận"
              className="inline-flex items-center gap-1 hover:text-destructive transition-colors disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Trash2 className="size-3" />
              )}
              Xoá
            </button>
          </Tooltip>
        )}
      </div>
      {replyOpen && (
        <CommentComposer
          workspaceSlug={workspaceSlug}
          nodeId={nodeId}
          parentCommentId={commentId}
          onCancel={() => setReplyOpen(false)}
          autoFocus
        />
      )}
    </div>
  );
}
