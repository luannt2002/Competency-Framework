/**
 * Badge rule form — PURE logic for the F16 badge CRUD surface.
 *
 * The 8 evaluator rule kinds (see `src/lib/gamification/badge-evaluator.ts`,
 * `BadgeRule`) each need different form fields. This module is the SSoT for:
 *   - the kind catalogue (labels + which fields each kind needs)
 *   - client/server-shared validation (`validateRuleForm`)
 *   - a display summariser (`describeRule`) for list rows
 *
 * No DB / no React imports — unit-testable in isolation.
 */

export type BadgeRuleKind =
  | 'lesson_completed'
  | 'week_completed'
  | 'level_completed'
  | 'streak'
  | 'crowns_total'
  | 'category_level'
  | 'all_skills_assessed'
  | 'total_xp';

/** The shape actually persisted in `badges.rule` (jsonb). */
export type BadgeRule =
  | { kind: 'lesson_completed'; value: number }
  | { kind: 'week_completed'; value: number }
  | { kind: 'level_completed'; value: string }
  | { kind: 'streak'; value: number }
  | { kind: 'crowns_total'; value: number }
  | { kind: 'category_level'; category: string; level: string }
  | { kind: 'all_skills_assessed' }
  | { kind: 'total_xp'; value: number };

/** Which extra fields each kind needs beyond `kind` itself. */
type FieldSpec = 'number' | 'level_code' | 'category_level' | 'none';

export const RULE_KIND_CATALOGUE: ReadonlyArray<{
  kind: BadgeRuleKind;
  label: string;
  fields: FieldSpec;
  hint: string;
}> = [
  { kind: 'lesson_completed', label: 'Số lesson hoàn thành', fields: 'number', hint: 'Cấp khi học xong N lesson (completed hoặc mastered).' },
  { kind: 'week_completed', label: 'Số tuần hoàn thành', fields: 'number', hint: 'Cấp khi hoàn thành N tuần học.' },
  { kind: 'level_completed', label: 'Hoàn thành level', fields: 'level_code', hint: 'Cấp khi level (theo code, ví dụ L) được đánh dấu completed.' },
  { kind: 'streak', label: 'Streak liên tiếp', fields: 'number', hint: 'Cấp khi streak hiện tại đạt N ngày.' },
  { kind: 'crowns_total', label: 'Tổng số crown', fields: 'number', hint: 'Cấp khi tổng crown across skills đạt N.' },
  { kind: 'category_level', label: 'Cả nhóm skill đạt level', fields: 'category_level', hint: 'Cấp khi mọi skill trong một category đạt mức level tối thiểu.' },
  { kind: 'all_skills_assessed', label: 'Tự đánh giá mọi skill', fields: 'none', hint: 'Cấp khi learner đã assess toàn bộ skill của workspace.' },
  { kind: 'total_xp', label: 'Tổng XP', fields: 'number', hint: 'Cấp khi tổng XP tích luỹ đạt N.' },
];

export const RULE_KINDS = RULE_KIND_CATALOGUE.map((c) => c.kind) as readonly BadgeRuleKind[];

/** Lucide icon names whitelisted by BADGE_ICONS in badge-wall.tsx. */
export const BADGE_ICON_KEYS = [
  'Award',
  'CalendarCheck',
  'Cloud',
  'Crown',
  'Flame',
  'Footprints',
  'Grid3x3',
  'Medal',
  'Sparkles',
  'Star',
  'Trophy',
  'Zap',
] as const;
export type BadgeIconKey = (typeof BADGE_ICON_KEYS)[number];

/** Flat form values — strings as typed by the user; coerced on validate. */
export type RuleFormValues = {
  kind: BadgeRuleKind;
  /** Used by the 5 numeric kinds (lesson/week/streak/crowns/xp) + level_completed (code). */
  value: string;
  /** category_level only. */
  category: string;
  /** category_level only (level code). */
  level: string;
};

export const EMPTY_RULE_FORM: RuleFormValues = {
  kind: 'lesson_completed',
  value: '',
  category: '',
  level: '',
};

export type RuleValidationResult =
  | { ok: true; rule: BadgeRule }
  | { ok: false; errors: Record<string, string> };

const MAX_NUMBER = 1_000_000;

function parsePositiveInt(raw: string): number | null {
  const t = raw.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isSafeInteger(n) || n < 1 || n > MAX_NUMBER) return null;
  return n;
}

function cleanCode(raw: string): string {
  return raw.trim();
}

/** Pure validator — same logic runs client-side (inline errors) and in the
 *  server action (defence in depth). Returns the typed rule on success. */
export function validateRuleForm(input: RuleFormValues): RuleValidationResult {
  const errors: Record<string, string> = {};
  const spec = RULE_KIND_CATALOGUE.find((c) => c.kind === input.kind);

  if (!spec) {
    return { ok: false, errors: { kind: 'Loại_rule_không_hợp_lệ' } };
  }

  switch (spec.fields) {
    case 'number': {
      const n = parsePositiveInt(input.value);
      if (n === null) {
        errors.value = `Phải là số nguyên từ 1 đến ${MAX_NUMBER}`;
      } else {
        return { ok: true, rule: { kind: input.kind, value: n } as BadgeRule };
      }
      break;
    }
    case 'level_code': {
      const code = cleanCode(input.value);
      if (!code) {
        errors.value = 'Nhập code của level (ví dụ: L)';
      } else if (code.length > 40) {
        errors.value = 'Code tối đa 40 ký tự';
      } else {
        return { ok: true, rule: { kind: 'level_completed', value: code } };
      }
      break;
    }
    case 'category_level': {
      const category = cleanCode(input.category);
      const level = cleanCode(input.level);
      if (!category) errors.category = 'Nhập slug của category';
      else if (category.length > 60) errors.category = 'Slug tối đa 60 ký tự';
      if (!level) errors.level = 'Nhập code của level';
      else if (level.length > 40) errors.level = 'Code tối đa 40 ký tự';
      if (Object.keys(errors).length === 0) {
        return { ok: true, rule: { kind: 'category_level', category, level } };
      }
      break;
    }
    case 'none':
      return { ok: true, rule: { kind: 'all_skills_assessed' } };
  }

  return { ok: false, errors };
}

/** Human-readable rule summary for list rows (pure). */
export function describeRule(rule: unknown): string {
  if (!rule || typeof rule !== 'object' || !('kind' in rule)) return '—';
  const r = rule as Record<string, unknown>;
  switch (r.kind) {
    case 'lesson_completed':
      return `Hoàn thành ${r.value} lesson`;
    case 'week_completed':
      return `Hoàn thành ${r.value} tuần`;
    case 'level_completed':
      return `Hoàn thành level ${String(r.value).toUpperCase()}`;
    case 'streak':
      return `Streak ${r.value} ngày`;
    case 'crowns_total':
      return `Tổng ${r.value} crown`;
    case 'category_level':
      return `Category "${r.category}" đạt level ${String(r.level).toUpperCase()}`;
    case 'all_skills_assessed':
      return 'Tự đánh giá mọi skill';
    case 'total_xp':
      return `Tích luỹ ${Number(r.value).toLocaleString('vi-VN')} XP`;
    default:
      return '—';
  }
}

/** Slugify a badge name into a workspace-unique slug (pure). */
export function slugifyBadgeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'badge';
}
