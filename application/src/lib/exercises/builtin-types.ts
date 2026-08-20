/**
 * The built-in exercise kinds — code-side source of truth.
 *
 * These mirror the global rows (`workspace_id IS NULL`) seeded by
 * drizzle/migrations/0006_open_exercise_types.sql. The DB row makes a kind
 * selectable and labelled; this list adds what only code can know — which
 * engine backs it and which payload paths are secret.
 *
 * tests/unit/exercise-builtin-types.test.ts asserts the two stay in step, so
 * adding a kind in one place and forgetting the other fails CI.
 *
 * The first six are the exact values of the retired `exercise_kind` enum and
 * MUST keep their slugs: 72 rows in `exercises` already reference them.
 */
import type { GradingMode } from '@/lib/db/schema-exercises';

export type BuiltinExerciseType = {
  slug: string;
  label: string;
  description: string;
  gradingMode: GradingMode;
  /** Registry key in src/lib/exercises/registry.ts. */
  engine: string;
};

/** The six kinds carried over from the old enum. Slugs are load-bearing. */
export const LEGACY_EXERCISE_KINDS = [
  'mcq',
  'mcq_multi',
  'fill_blank',
  'order_steps',
  'type_answer',
  'code_block_review',
] as const;

export const BUILTIN_EXERCISE_TYPES: readonly BuiltinExerciseType[] = [
  {
    slug: 'mcq',
    label: 'Trắc nghiệm 1 đáp án',
    description: 'Chọn một phương án đúng trong danh sách.',
    gradingMode: 'auto',
    engine: 'mcq',
  },
  {
    slug: 'mcq_multi',
    label: 'Trắc nghiệm nhiều đáp án',
    description: 'Chọn đúng toàn bộ tập phương án đúng — thiếu hoặc thừa đều sai.',
    gradingMode: 'auto',
    engine: 'mcq_multi',
  },
  {
    slug: 'fill_blank',
    label: 'Điền vào chỗ trống',
    description: 'Điền từng chỗ trống; mọi chỗ trống phải đúng.',
    gradingMode: 'auto',
    engine: 'fill_blank',
  },
  {
    slug: 'order_steps',
    label: 'Sắp xếp thứ tự',
    description: 'Kéo các bước về đúng trình tự.',
    gradingMode: 'auto',
    engine: 'order_steps',
  },
  {
    slug: 'type_answer',
    label: 'Gõ đáp án',
    description: 'Gõ đáp án khớp exact / exact_ci / regex.',
    gradingMode: 'auto',
    engine: 'type_answer',
  },
  {
    slug: 'code_block_review',
    label: 'Đọc code chọn lỗi',
    description: 'Đọc đoạn code rồi chọn nhận định đúng.',
    gradingMode: 'auto',
    engine: 'code_block_review',
  },
  {
    slug: 'essay',
    label: 'Tự luận',
    description: 'Bài viết tự do. Luôn vào hàng đợi chấm tay, không tự chấm.',
    gradingMode: 'manual',
    engine: 'essay',
  },
  {
    slug: 'rubric',
    label: 'Chấm theo rubric',
    description: 'Chấm theo nhiều tiêu chí có trọng số; người chấm cho điểm từng tiêu chí.',
    gradingMode: 'hybrid',
    engine: 'rubric',
  },
  {
    slug: 'numeric_range',
    label: 'Đáp án số theo khoảng',
    description: 'Đáp án là số, đúng khi nằm trong khoảng chấp nhận.',
    gradingMode: 'auto',
    engine: 'numeric_range',
  },
  {
    slug: 'short_answer',
    label: 'Trả lời ngắn',
    description: 'Trả lời ngắn; có thể chấm điểm thành phần theo từ khoá trọng số.',
    gradingMode: 'auto',
    engine: 'short_answer',
  },
];

const BY_SLUG = new Map(BUILTIN_EXERCISE_TYPES.map((t) => [t.slug, t]));

export function getBuiltinExerciseType(slug: string): BuiltinExerciseType | undefined {
  return BY_SLUG.get(slug);
}

export function isBuiltinExerciseKind(slug: string): boolean {
  return BY_SLUG.has(slug);
}
