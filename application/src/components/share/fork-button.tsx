'use client';

/**
 * ForkButton — audit 7.13 / E2.3.
 *
 * - Not logged in → plain link to sign-in (unchanged flow).
 * - Logged in → opens a small dialog where the user can name their fork
 *   (defaults to "<source name> (Fork)"). Slug is auto-generated, noted in
 *   the dialog. Submitting calls `forkWorkspace` with `newName`.
 */
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { GitFork, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { isNextControlFlowError } from '@/lib/is-redirect-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { forkWorkspace } from '@/actions/workspaces';

type Props = {
  sourceSlug: string;
  /** Auto-generated default fork name: "<source name> (Fork)". */
  defaultName: string;
  /** null = not logged in, string = logged-in user id */
  viewerId: string | null;
  /** true if the viewer owns this workspace (don't show fork to yourself) */
  isOwner: boolean;
};

export function ForkButton({ sourceSlug, defaultName, viewerId, isOwner }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [pending, startTransition] = useTransition();

  if (isOwner) return null;

  if (!viewerId) {
    return (
      <Button asChild size="sm" variant="default">
        <Link href={`/sign-in?next=/share/${sourceSlug}`}>
          <GitFork className="size-4" />
          Fork roadmap này
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <GitFork className="size-4" />
        Fork roadmap này
      </Button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Fork roadmap</DialogTitle>
            <DialogDescription>
              Đặt tên cho bản sao của bạn. Đường dẫn (slug) sẽ được tự động tạo.
            </DialogDescription>
          </DialogHeader>
          <form
            action={(fd) => {
              // `startTransition` phải nhận callback BẤT ĐỒNG BỘ và `await`
              // action bên trong.
              //
              // Trước đợt này callback là hàm đồng bộ và promise bị vứt: React
              // kết thúc transition ngay khi callback return, nên `pending` về
              // false gần như tức thì trong khi `forkWorkspace` vẫn đang sao
              // chép hơn 10 bảng. Hệ quả — nút hết disabled và không quay, người
              // dùng bấm lại, tài khoản có hai bản fork trùng phải tự đi xoá;
              // `onOpenChange` cũng mất tác dụng vì nó gác theo `pending`.
              //
              // Promise bị vứt còn nuốt luôn mọi lỗi của action
              // (WORKSPACE_NOT_FOUND, WORKSPACE_NOT_PUBLIC): fork thất bại thì
              // màn hình đứng yên, không báo gì.
              startTransition(async () => {
                try {
                  await forkWorkspace(fd);
                } catch (e) {
                  // `forkWorkspace` kết thúc bằng `redirect()`, mà redirect báo
                  // hiệu bằng cách ném lỗi — nuốt nó là biến thành công thành
                  // thất bại.
                  if (isNextControlFlowError(e)) throw e;
                  toast.error('Fork không thành công', {
                    description: e instanceof Error ? e.message : 'Thử lại sau.',
                  });
                }
              });
            }}
            className="space-y-4"
          >
            <input type="hidden" name="sourceSlug" value={sourceSlug} />
            <div className="space-y-2">
              <label htmlFor="fork-name" className="text-sm font-medium">
                Tên workspace
              </label>
              <Input
                id="fork-name"
                name="newName"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder={defaultName}
                required
              />
              <p className="text-xs text-muted-foreground">
                Mặc định: {defaultName}
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={pending || !name.trim()}>
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <GitFork className="size-4" />
                )}
                {pending ? 'Đang fork…' : 'Fork ngay'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
