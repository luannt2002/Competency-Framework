'use client';

/**
 * Workspace-scoped error boundary.
 *
 * Bắt lỗi dưới /w/[slug]/* — truy vấn hỏng, render hỏng. Giữ phạm vi hẹp để
 * sidebar và topbar vẫn còn, người dùng không bị ném ra một trang trắng.
 *
 * KHÔNG in `error.message` ra màn hình. Bản cũ in thẳng, nên người xem không
 * đủ quyền nhận nguyên văn `WORKSPACE_NOT_FOUND_OR_FORBIDDEN` trong HTML —
 * vừa vô nghĩa với họ, vừa nói cho người ngoài biết cơ chế kiểm quyền tên là
 * gì. Chỉ giữ `digest`: đủ để tra log, không lộ gì.
 * (Trường hợp không-đủ-quyền nay ra 404 ở `requireWorkspacePage`, không rơi
 * vào đây nữa — nhưng ranh giới lỗi vẫn phải kín.)
 */
import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[workspace error boundary]', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-8">
      <div className="surface p-8 text-center space-y-4">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Không tải được phần này</h2>
          <p className="text-sm text-muted-foreground">
            Đã xảy ra lỗi khi truy vấn hoặc hiển thị. Thử lại, hoặc quay về danh
            sách workspace của bạn.
          </p>
          {error.digest && (
            <p className="text-[10px] font-mono text-muted-foreground/60 mt-2">
              ref: {error.digest}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" asChild>
            <Link href="/profile">
              <ArrowLeft className="size-4" />
              Workspace của tôi
            </Link>
          </Button>
          <Button onClick={reset}>
            <RefreshCcw className="size-4" />
            Thử lại
          </Button>
        </div>
      </div>
    </div>
  );
}
