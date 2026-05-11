/**
 * Mock data for the DevOps workspace — used when NEXT_PUBLIC_USE_MOCK=true.
 * Mirrors the shape of types/* so components don't need to know if data is mock.
 */
import type {
  Workspace,
  CompetencyLevel,
  SkillCategory,
  SkillRow,
  LevelTrack,
  Week,
  Streak,
  Hearts,
  ActivityEntry,
  Badge,
} from '@/types';

export const mockWorkspace: Workspace = {
  id: 'mock-ws-devops',
  slug: 'devops',
  name: 'DevOps Mastery (mock)',
  icon: 'Cloud',
  color: '#22D3EE',
  ownerUserId: 'mock-user',
  frameworkTemplateId: 'mock-tpl-devops',
  visibility: 'private',
  createdAt: new Date('2026-01-01').toISOString(),
};

export const mockLevels: CompetencyLevel[] = [
  {
    id: 'lvl-xs',
    code: 'XS',
    label: 'Intern · Foundational',
    numericValue: 0,
    description: 'Đã đọc, hiểu khái niệm. Intern/Fresher.',
    examples: 'Đọc docs, làm theo guide có giám sát.',
    color: '#64748B',
    displayOrder: 0,
  },
  {
    id: 'lvl-s',
    code: 'S',
    label: 'Junior · Working',
    numericValue: 33,
    description: 'Làm task độc lập với hỗ trợ. Junior 1–2 năm.',
    examples: 'Ship feature, debug lỗi vừa, biết khi nào ask senior.',
    color: '#0EA5E9',
    displayOrder: 1,
  },
  {
    id: 'lvl-m',
    code: 'M',
    label: 'Mid · Strong',
    numericValue: 66,
    description: 'Làm độc lập production. Mid/Senior 3–5 năm.',
    examples: 'Design + ship service, review code, on-call, mentor junior.',
    color: '#10B981',
    displayOrder: 2,
  },
  {
    id: 'lvl-l',
    code: 'L',
    label: 'Senior Tech Lead · Expert',
    numericValue: 100,
    description: 'Set direction, mentor team. Senior 6+ / Lead.',
    examples: 'Platform initiative, conference talk, OSS contrib, ADR/RFC.',
    color: '#8B5CF6',
    displayOrder: 3,
  },
];

export const mockCategories: SkillCategory[] = [
  { id: 'cat-aws', slug: 'aws', name: 'AWS', description: 'Cloud foundation', color: '#FF9900', icon: 'Cloud', displayOrder: 0 },
  { id: 'cat-tf', slug: 'terraform', name: 'Terraform / IaC', description: '', color: '#7C3AED', icon: 'Boxes', displayOrder: 1 },
  { id: 'cat-k8s', slug: 'kubernetes', name: 'Kubernetes & EKS', description: '', color: '#3B82F6', icon: 'Container', displayOrder: 2 },
  { id: 'cat-go', slug: 'golang', name: 'Golang for DevOps', description: '', color: '#00ADD8', icon: 'Code2', displayOrder: 3 },
];

export const mockSkillRows: SkillRow[] = [
  {
    skillId: 'sk-iam',
    skillName: 'IAM Deep (trust, conditions, boundaries)',
    skillSlug: 'iam-deep',
    description: 'IAM policies, roles, SCPs, Permission Boundaries.',
    tags: ['security', 'aws'],
    categoryId: 'cat-aws',
    categoryName: 'AWS',
    categoryColor: '#FF9900',
    levelCode: 'M',
    targetLevelCode: 'L',
    noteMd: 'Đã build production IAM với SCP.',
    whyThisLevel: 'Ship 3 prod systems with least-privilege.',
    evidenceUrls: ['https://github.com/example/iam-demo'],
    crowns: 3,
    updatedAt: new Date('2026-05-10').toISOString(),
  },
  {
    skillId: 'sk-vpc',
    skillName: 'VPC Networking (subnets, NAT, endpoints)',
    skillSlug: 'vpc-networking',
    description: null,
    tags: ['network', 'aws'],
    categoryId: 'cat-aws',
    categoryName: 'AWS',
    categoryColor: '#FF9900',
    levelCode: 'S',
    targetLevelCode: null,
    noteMd: null,
    whyThisLevel: null,
    evidenceUrls: null,
    crowns: 1,
    updatedAt: new Date('2026-05-05').toISOString(),
  },
  {
    skillId: 'sk-tf-modules',
    skillName: 'Module Design & Composition',
    skillSlug: 'tf-modules',
    description: null,
    tags: ['iac'],
    categoryId: 'cat-tf',
    categoryName: 'Terraform / IaC',
    categoryColor: '#7C3AED',
    levelCode: null,
    targetLevelCode: 'M',
    noteMd: null,
    whyThisLevel: null,
    evidenceUrls: null,
    crowns: 0,
    updatedAt: null,
  },
  {
    skillId: 'sk-eks',
    skillName: 'EKS Production',
    skillSlug: 'eks-prod',
    description: null,
    tags: ['k8s', 'aws'],
    categoryId: 'cat-k8s',
    categoryName: 'Kubernetes & EKS',
    categoryColor: '#3B82F6',
    levelCode: 'XS',
    targetLevelCode: 'M',
    noteMd: null,
    whyThisLevel: null,
    evidenceUrls: null,
    crowns: 0,
    updatedAt: new Date('2026-04-20').toISOString(),
  },
  {
    skillId: 'sk-go-cli',
    skillName: 'CLI tools with cobra + AWS SDK v2',
    skillSlug: 'go-cli',
    description: null,
    tags: ['go'],
    categoryId: 'cat-go',
    categoryName: 'Golang for DevOps',
    categoryColor: '#00ADD8',
    levelCode: 'S',
    targetLevelCode: 'L',
    noteMd: null,
    whyThisLevel: null,
    evidenceUrls: null,
    crowns: 2,
    updatedAt: new Date('2026-05-08').toISOString(),
  },
];

export const mockTracks: LevelTrack[] = mockLevels.map((l, i) => ({
  id: `track-${l.code}`,
  levelCode: l.code,
  title: `${l.label} Track`,
  description: l.description,
  displayOrder: i,
}));

export const mockWeeks: Week[] = mockTracks.flatMap((t) =>
  Array.from({ length: 12 }, (_, i) => ({
    id: `wk-${t.levelCode}-${i + 1}`,
    trackId: t.id,
    weekIndex: i + 1,
    title: `Week ${i + 1} of ${t.title}`,
    summary: '(mock summary)',
    goals: ['goal a', 'goal b'],
    keywords: ['k1', 'k2'],
    estHours: 8,
  })),
);

export const mockStreak: Streak = {
  currentStreak: 5,
  longestStreak: 12,
  lastActiveDate: new Date().toISOString().slice(0, 10),
  freezeCount: 0,
};

export const mockHearts: Hearts = {
  current: 4,
  max: 5,
  nextRefillAt: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
};

export const mockActivity: ActivityEntry[] = [
  { id: 'act-1', kind: 'lesson_completed', payload: null, createdAt: new Date(Date.now() - 5 * 60_000).toISOString() },
  { id: 'act-2', kind: 'assessment_updated', payload: null, createdAt: new Date(Date.now() - 2 * 3600_000).toISOString() },
  { id: 'act-3', kind: 'framework_forked', payload: null, createdAt: new Date(Date.now() - 24 * 3600_000).toISOString() },
];

export const mockBadges: Badge[] = [
  { id: 'b1', slug: 'first-step', name: 'First Step', description: 'Hoàn thành lesson đầu', icon: 'Footprints' },
  { id: 'b2', slug: 'streak-7', name: 'On Fire', description: '7 ngày streak', icon: 'Flame' },
];

export const mockTotalXp = 1240;
