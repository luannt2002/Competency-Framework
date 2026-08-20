/**
 * "Động lực mỗi ngày" — the Duolingo half of the pitch: XP, streak, badge,
 * crown.
 *
 * The four tiles explain the mechanics (no invented numbers — the copy only
 * states rules that exist in the product). The wall underneath then shows the
 * REAL badge definitions currently published, streamed in behind a skeleton.
 */
import { Suspense } from 'react';
import { Crown, Flame, Trophy, Zap } from 'lucide-react';
import { GRID_GAP, InfoCard, LandingSection } from './kit';
import { BadgeWall } from './badge-wall';
import { BadgeWallSkeleton } from './skeletons';

type Mechanic = {
  title: string;
  desc: string;
  icon: typeof Zap;
};

const MECHANICS: readonly Mechanic[] = [
  {
    title: 'XP',
    desc: 'Mỗi lesson, lab hay project hoàn thành đều cộng điểm vào tổng XP. Biểu đồ theo tuần cho thấy hôm nào bạn thật sự học.',
    icon: Zap,
  },
  {
    title: 'Streak',
    desc: 'Chuỗi ngày học liên tiếp. Nghỉ một ngày là chuỗi mất — chính áp lực nhẹ đó kéo bạn quay lại vào hôm sau.',
    icon: Flame,
  },
  {
    title: 'Huy hiệu',
    desc: 'Mở khoá theo luật do chính workspace định nghĩa: số lesson đã xong, số ngày streak, tổng XP hay số crown.',
    icon: Trophy,
  },
  {
    title: 'Crown & cấp độ',
    desc: 'Mỗi skill có tối đa 5 crown và bốn mức XS / S / M / L. Học xong bài học sẽ tự nâng mức năng lực tương ứng.',
    icon: Crown,
  },
];

export function MotivationSection() {
  return (
    <LandingSection
      index={4}
      title="Động lực mỗi ngày"
      subtitle="XP · Streak · Badge · Crown"
      lead="Tiến độ đo được là một chuyện, quay lại mỗi ngày lại là chuyện khác. Bốn cơ chế dưới đây lo phần thứ hai."
    >
      <ul role="list" className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 ${GRID_GAP}`}>
        {MECHANICS.map((m) => (
          <li key={m.title}>
            <InfoCard icon={m.icon} title={m.title} desc={m.desc} />
          </li>
        ))}
      </ul>

      <div className="mt-10 sm:mt-12">
        <h3 className="mb-1.5 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Huy hiệu có thật trong các roadmap công khai
        </h3>
        <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
          Danh sách dưới đây đọc trực tiếp từ cơ sở dữ liệu — đây là luật mở khoá do creator
          viết, không phải ví dụ minh hoạ.
        </p>
        <Suspense fallback={<BadgeWallSkeleton />}>
          <BadgeWall />
        </Suspense>
      </div>
    </LandingSection>
  );
}
