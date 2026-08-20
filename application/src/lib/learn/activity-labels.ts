/**
 * Human labels for `activity_log.kind`.
 *
 * Lives in lib (not in a component) so the vocabulary is one list shared by
 * every surface that renders the feed, and so the guard's "no business data in
 * components" rule stays satisfied.
 *
 * Unknown kinds fall back to a readable de-snake-cased form instead of being
 * hidden — a silent gap in the activity feed is worse than an ugly label.
 */
const ACTIVITY_LABELS: Record<string, string> = {
  tree_node_done: 'Hoàn thành một bước',
  tree_node_undone: 'Bỏ đánh dấu xong',
  tree_node_started: 'Bắt đầu học một bước',
  tree_node_reset: 'Đặt lại một bước về chưa học',
  tree_node_evidence_set: 'Gắn bằng chứng',
  tree_node_created: 'Tạo node mới',
  tree_node_updated: 'Sửa node',
  tree_node_deleted: 'Xoá node',
  tree_node_moved: 'Đổi thứ tự node',
  daily_plan_generated: 'Tạo kế hoạch hôm nay',
  daily_task_done: 'Xong một task hôm nay',
  daily_task_skipped: 'Bỏ qua một task',
  daily_task_carried_over: 'Dời task sang mai',
  daily_task_added: 'Thêm task thủ công',
  planner_settings_updated: 'Đổi cài đặt planner',
  lesson_completed: 'Hoàn thành bài học',
  week_completed: 'Hoàn thành tuần',
  level_completed: 'Hoàn thành cấp độ',
  lab_completed: 'Hoàn thành lab',
  assessment_updated: 'Tự đánh giá kỹ năng',
  evidence_submitted: 'Nộp bằng chứng',
  evidence_reviewed: 'Bằng chứng được duyệt',
  journal_entry_created: 'Viết journal',
  journal_entry_updated: 'Sửa journal',
  journal_entry_deleted: 'Xoá journal',
  week_note_added: 'Ghi chú tuần',
  resource_added: 'Thêm tài liệu',
  resource_removed: 'Gỡ tài liệu',
  comment_added: 'Bình luận',
  comment_deleted: 'Xoá bình luận',
  framework_forked: 'Tạo workspace',
  workspace_forked: 'Fork lộ trình',
  follow_added: 'Theo dõi lộ trình',
};

/** Emoji shown next to a feed row. Neutral dot when the kind is unknown. */
const ACTIVITY_ICONS: Record<string, string> = {
  tree_node_done: '✅',
  tree_node_started: '▶️',
  tree_node_evidence_set: '🔗',
  daily_task_done: '☑️',
  daily_plan_generated: '🗓️',
  lesson_completed: '📘',
  assessment_updated: '📊',
  journal_entry_created: '📝',
  week_note_added: '📝',
  resource_added: '📎',
};

export function activityLabel(kind: string): string {
  return ACTIVITY_LABELS[kind] ?? kind.replace(/_/g, ' ');
}

export function activityIcon(kind: string): string {
  return ACTIVITY_ICONS[kind] ?? '•';
}
