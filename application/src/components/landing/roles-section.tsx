/**
 * "Ba vai trò, một nền tảng" — Creator / Learner / Admin, transcribed from
 * PRODUCT_MINDSET so the landing tells the same story as the product doc.
 *
 * Each role is an <InfoCard> with its bullet list, so the three columns keep
 * identical rhythm even though the copy lengths differ.
 */
import { GraduationCap, PenLine, Users } from 'lucide-react';
import { GRID_GAP, InfoCard, LandingSection } from './kit';

type Role = {
  eyebrow: string;
  title: string;
  desc: string;
  icon: typeof PenLine;
  bullets: readonly string[];
};

const ROLES: readonly Role[] = [
  {
    eyebrow: 'Creator',
    title: 'Người vẽ lộ trình',
    desc: 'Giáo viên, mentor, team lead, HR — bất kỳ ai có kiến thức muốn chia sẻ.',
    icon: PenLine,
    bullets: [
      'Vẽ lộ trình dạng cây, tự định nghĩa cấu trúc',
      'Gắn video, bài viết, bài tập, link tool vào từng bước',
      'Publish công khai hoặc riêng cho một nhóm',
      'Xem ai đang học và đang mắc kẹt ở đâu',
    ],
  },
  {
    eyebrow: 'Learner',
    title: 'Người học',
    desc: 'Cá nhân tự học, sinh viên, nhân viên mới — bất kỳ ai có mục tiêu học.',
    icon: GraduationCap,
    bullets: [
      'Fork roadmap có sẵn hoặc tự tạo mới',
      'Theo dõi tiến độ bằng streak, XP và huy hiệu',
      'Gắn bằng chứng thật khi hoàn thành mỗi bước',
      'Chia sẻ thành tích ra ngoài',
    ],
  },
  {
    eyebrow: 'Admin',
    title: 'Người quản lý nhóm',
    desc: 'Team lead, HR, giáo viên chủ nhiệm — người cần theo dõi cả tập thể.',
    icon: Users,
    bullets: [
      'Giao lộ trình cho nhiều người cùng lúc',
      'Xem tiến độ cả nhóm trên một màn hình',
      'Phát hiện ai đang chậm, ai đang bứt tốc',
      'Xuất báo cáo cho cấp trên',
    ],
  },
];

export function RolesSection() {
  return (
    <LandingSection
      index={3}
      title="Ba vai trò, một nền tảng"
      subtitle="Creator · Learner · Admin"
      lead="Cùng một cây lộ trình, ba góc nhìn khác nhau. Không cần dựng ba công cụ rời rạc."
    >
      <ul role="list" className={`grid grid-cols-1 md:grid-cols-3 ${GRID_GAP}`}>
        {ROLES.map((r) => (
          <li key={r.eyebrow}>
            <InfoCard
              icon={r.icon}
              eyebrow={r.eyebrow}
              title={r.title}
              desc={r.desc}
              bullets={r.bullets}
            />
          </li>
        ))}
      </ul>
    </LandingSection>
  );
}
