/**
 * Badge wall — the real badge definitions shipped by public workspaces.
 *
 * The rows (name, description, lucide icon name) come straight from the
 * `badges` table, so the landing shows the actual unlock rules a creator
 * wrote rather than an invented trophy shelf. Async server component behind
 * <Suspense>; covers data / empty / error.
 */
import Link from 'next/link';
import {
  Award,
  AlertTriangle,
  Cloud,
  Crown,
  Flame,
  Footprints,
  Grid3x3,
  Sparkles,
  Star,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { AccentTile, GRID_GAP } from './kit';
import { getPublicBadges } from './landing-data';

/**
 * UI lookup: the `badges.icon` column stores a lucide icon *name*. Only the
 * icons actually referenced by seeded rows are bundled; anything unknown
 * falls back to `Award` so a new badge never renders a hole.
 */
const BADGE_ICONS: Record<string, LucideIcon> = {
  Award,
  Cloud,
  Crown,
  Flame,
  Footprints,
  Grid3x3,
  Sparkles,
  Star,
  Trophy,
  Zap,
};

export async function BadgeWall() {
  const list = await getPublicBadges();

  if (!list) {
    return (
      <EmptyState
        tone="destructive"
        icon={AlertTriangle}
        title="Không tải được danh sách huy hiệu"
        description="Truy vấn tới cơ sở dữ liệu thất bại. Nội dung khác trên trang vẫn dùng được bình thường."
      />
    );
  }

  if (list.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="Chưa có huy hiệu nào được công bố"
        description="Mỗi workspace tự định nghĩa luật mở khoá huy hiệu của mình — số ngày streak, số lesson, tổng XP hay số crown."
        action={
          <Button asChild variant="outline">
            <Link href="/sign-in">Định nghĩa huy hiệu của bạn</Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul role="list" className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${GRID_GAP}`}>
      {list.map((b) => {
        const Icon = (b.icon && BADGE_ICONS[b.icon]) || Award;
        return (
          <li key={b.slug} className="surface surface-lift flex items-start gap-3 p-4">
            <AccentTile icon={Icon} shape="circle" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{b.title}</p>
              {b.desc ? (
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{b.desc}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
