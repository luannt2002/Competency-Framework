'use client';

/**
 * Inline "remove resource" button. Visibility decided server-side
 * (ResourcesSection only renders for adder or EDITOR+).
 */
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { removeNodeResource } from '@/actions/node-resources';

export function ResourceRemoveButton({
  workspaceSlug,
  resourceId,
  title,
}: {
  workspaceSlug: string;
  resourceId: string;
  title: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onRemove = () => {
    if (!window.confirm(`Xoá tài liệu "${title}"?`)) return;
    startTransition(async () => {
      try {
        await removeNodeResource({ workspaceSlug, resourceId });
        toast.success('Đã xoá');
        router.refresh();
      } catch (e) {
        toast.error('Lỗi xoá', { description: String(e) });
      }
    });
  };

  return (
    <Button
      onClick={onRemove}
      disabled={pending}
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0"
      aria-label="Xoá tài liệu"
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Trash2 className="size-3" />
      )}
    </Button>
  );
}
