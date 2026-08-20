/**
 * "Tính năng cốt lõi" — the original three-card feature deck, moved out of
 * page.tsx and rebuilt on <InfoCard> so it shares chrome and spacing with
 * every other card block on the page. Copy is unchanged.
 */
import { Eye, Network, ShieldCheck } from 'lucide-react';
import { GRID_GAP, InfoCard, LandingSection } from './kit';

type Feature = {
  title: string;
  desc: string;
  icon: typeof Network;
};

const FEATURES: readonly Feature[] = [
  {
    title: 'Cây học tập đa cấp',
    desc: 'CRUD cây n-depth: giai đoạn → tuần → buổi → lesson / lab / project. Drag-drop sắp lại, materialized path để query nhanh, mỗi node có description + body Markdown.',
    icon: Network,
  },
  {
    title: 'Showcase công khai',
    desc: 'Bật visibility = public-readonly là có ngay link /share/<slug> chia sẻ Slack / Zalo / Twitter. OG image động render mỗi roadmap một preview riêng.',
    icon: Eye,
  },
  {
    title: 'Phân quyền 7-tier',
    desc: 'Super-admin → Org-owner → Org-admin → WS-owner → Editor → Learner → Guest. Mỗi role nhìn thấy + sửa được những gì, kiểm tra ở cả server action và DB guard.',
    icon: ShieldCheck,
  },
];

export function FeaturesSection() {
  return (
    <LandingSection
      index={2}
      title="Tính năng cốt lõi"
      subtitle="3 trọng tâm"
      lead="Ba thứ platform lo giúp bạn, để bạn chỉ phải nghĩ về nội dung."
      delay={60}
    >
      <ul role="list" className={`grid grid-cols-1 md:grid-cols-3 ${GRID_GAP}`}>
        {FEATURES.map((f) => (
          <li key={f.title}>
            <InfoCard icon={f.icon} title={f.title} desc={f.desc} />
          </li>
        ))}
      </ul>
    </LandingSection>
  );
}
