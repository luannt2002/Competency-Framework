/**
 * Public roadmap grid — the "proof it works" block.
 *
 * Async server component behind <Suspense>. Renders one of three things and
 * never a placeholder roadmap: the real public-readonly workspaces, an empty
 * state inviting the first publish, or an error state when the query throws.
 */
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Compass, Telescope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { NoWorkspacesIllustration } from '@/components/ui/empty-state-illustrations';
import { GRID_GAP, formatCount } from './kit';
import { getShowcase } from './landing-data';

export async function ShowcaseSection() {
  const list = await getShowcase();

  if (!list) {
    return (
      <EmptyState
        tone="destructive"
        icon={AlertTriangle}
        title="Không tải được danh sách roadmap"
        description="Kết nối tới cơ sở dữ liệu đang có vấn đề. Bạn vẫn có thể mở trang khám phá để thử lại."
        action={
          <Button asChild variant="outline">
            <Link href="/discover">
              <Compass className="size-4" />
              Mở trang khám phá
            </Link>
          </Button>
        }
      />
    );
  }

  if (list.length === 0) {
    return (
      <EmptyState
        illustration={<NoWorkspacesIllustration />}
        title="Chưa có lộ trình nào được công khai"
        description="Roadmap công khai sẽ xuất hiện ở đây ngay khi có người bật chế độ public-readonly. Bạn có thể là người đầu tiên."
        action={
          <Button asChild className="btn-brand border-0">
            <Link href="/sign-in">
              Tạo roadmap đầu tiên
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul role="list" className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${GRID_GAP}`}>
      {list.map((w) => (
        <li key={w.id}>
          <Link
            href={`/share/${w.slug}`}
            className="surface surface-lift group flex h-full flex-col p-5 sm:p-6"
          >
            <span
              className="mb-4 flex size-11 items-center justify-center rounded-xl border border-border bg-secondary/60 font-emoji text-2xl leading-none"
              aria-hidden="true"
            >
              {w.icon ?? '🗺️'}
            </span>
            <h3 className="text-base font-semibold leading-snug transition-colors group-hover:text-primary sm:text-lg">
              {w.title}
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              <span className="tabular-nums">{formatCount(w.phaseCount)}</span> giai đoạn
              <span aria-hidden="true" className="mx-1.5 opacity-50">
                ·
              </span>
              <span className="tabular-nums">{formatCount(w.nodeCount)}</span> mục
            </p>
            <span className="mt-auto flex items-center gap-1.5 pt-5 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
              <Telescope className="size-3.5" aria-hidden="true" />
              Xem không cần đăng nhập
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
