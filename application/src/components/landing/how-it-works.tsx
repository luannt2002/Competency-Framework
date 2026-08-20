/**
 * "Cách hoạt động" — the three-beat story from PRODUCT_MINDSET:
 * vẽ cây → publish link → người khác học & bạn thấy tiến độ.
 *
 * Pure presentation, no new styling: <LandingSection> supplies the rhythm and
 * <InfoCard> supplies chrome identical to the feature and role cards below.
 */
import { GitBranch, Link2, LineChart } from 'lucide-react';
import { GRID_GAP, InfoCard, LandingSection } from './kit';

type Step = {
  eyebrow: string;
  watermark: string;
  title: string;
  desc: string;
  icon: typeof GitBranch;
};

const STEPS: readonly Step[] = [
  {
    eyebrow: 'Bước 01',
    watermark: '1',
    title: 'Vẽ cây lộ trình',
    desc: 'Tự định nghĩa cấu trúc: giai đoạn → tuần → buổi → bài học, lab, project. Không giới hạn độ sâu, không node type bị áp đặt — bạn vẽ đúng logic lĩnh vực mình dạy.',
    icon: GitBranch,
  },
  {
    eyebrow: 'Bước 02',
    watermark: '2',
    title: 'Publish thành một link',
    desc: 'Bật public-readonly là có ngay đường dẫn /share/… xem được mà không cần đăng nhập, kèm OG image động để chia sẻ lên Slack, Zalo hay mạng xã hội.',
    icon: Link2,
  },
  {
    eyebrow: 'Bước 03',
    watermark: '3',
    title: 'Người khác học, bạn thấy tiến độ',
    desc: 'Learner fork lộ trình về, đánh dấu hoàn thành kèm bằng chứng thật. Creator và admin nhìn được ai đang đi tới đâu, ai đang mắc kẹt ở bước nào.',
    icon: LineChart,
  },
];

export function HowItWorksSection() {
  return (
    <LandingSection
      index={1}
      title="Cách hoạt động"
      subtitle="3 bước"
      lead="Từ một trang giấy trắng tới lộ trình có người học và có số liệu — ba bước, không cần cấu hình gì thêm."
    >
      <ol className={`grid grid-cols-1 md:grid-cols-3 ${GRID_GAP}`}>
        {STEPS.map((s) => (
          <li key={s.watermark}>
            <InfoCard
              icon={s.icon}
              eyebrow={s.eyebrow}
              watermark={s.watermark}
              title={s.title}
              desc={s.desc}
            />
          </li>
        ))}
      </ol>
    </LandingSection>
  );
}
