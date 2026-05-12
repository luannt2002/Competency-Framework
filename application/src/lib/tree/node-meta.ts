/**
 * Tree node display metadata — labels, emojis, palette.
 * Single source of truth used by every roadmap view (dashboard, share, detail).
 */

export type RoadmapColor = 'cyan' | 'purple' | 'yellow' | 'green' | 'pink';
export const ROADMAP_COLORS: readonly RoadmapColor[] = ['cyan', 'purple', 'yellow', 'green', 'pink'];

/** Pick a color for the i-th section, cycling through the palette. */
export function pickRoadmapColor(index: number, startIndex = 0): RoadmapColor {
  return ROADMAP_COLORS[(index + startIndex) % ROADMAP_COLORS.length]!;
}

export const NODE_TYPE_LABEL: Record<string, string> = {
  course: 'Khoá học',
  phase: 'Giai đoạn',
  stage: 'Chặng',
  week: 'Tuần',
  session: 'Buổi',
  module: 'Module',
  lesson: 'Bài học',
  theory: 'Lý thuyết',
  lab: 'Lab',
  project: 'Project',
  task: 'Task',
  milestone: 'Cột mốc',
  exam: 'Kiểm tra',
  capstone: 'Capstone',
  custom: 'Tuỳ chỉnh',
};

export const NODE_TYPE_EMOJI: Record<string, string> = {
  course: '🎓',
  phase: '📚',
  stage: '🪜',
  week: '🗓️',
  session: '🎬',
  module: '🧩',
  lesson: '📖',
  theory: '💡',
  lab: '🧪',
  project: '🛠️',
  task: '✅',
  milestone: '🏁',
  exam: '📝',
  capstone: '🎖️',
  custom: '✨',
};

export function nodeTypeLabel(type: string): string {
  return NODE_TYPE_LABEL[type] ?? type;
}

export function nodeTypeEmoji(type: string): string {
  return NODE_TYPE_EMOJI[type] ?? '•';
}

/** Ordered list of all node types — useful for type-picker UIs. */
export const NODE_TYPE_OPTIONS: { value: string; label: string; emoji: string }[] =
  Object.keys(NODE_TYPE_LABEL).map((value) => ({
    value,
    label: NODE_TYPE_LABEL[value]!,
    emoji: NODE_TYPE_EMOJI[value] ?? '•',
  }));
