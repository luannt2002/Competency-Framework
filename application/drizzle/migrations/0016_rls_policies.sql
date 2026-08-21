-- 0016_rls_policies.sql — Phase 2 của cô lập tenant (PLAN 4.1)
--
-- ⚠️ CHƯA APPLY. Đây là fail-closed: mọi query của role competency_app trên
-- các bảng workspace-scoped chỉ thấy dòng khớp GUC `app.workspace_id`.
--
-- ĐIỀU KIỆN APPLY (phải đủ TRƯỚC KHI chạy file này):
--   1. App đã thread GUC qua mỗi transaction (helper withTenant chạy
--      `SET LOCAL app.workspace_id = <uuid>` — xem src/lib/db/scoped.ts).
--      Chưa thread mà apply = mọi query trả rỗng → app chết.
--   2. Đường lùi: `DROP POLICY tenant_isolation ON <t>; ALTER TABLE <t>
--      DISABLE ROW LEVEL SECURITY;` hoặc psql -f revert.
--   3. Các ngoại lệ đã xử lý: certificates (lookup public theo code — xem
--      policy riêng), workspace_invites (lookup theo email khi login),
--      bảng global (organizations, framework_templates...) không có policy.
--
-- Đã tách role ở Phase 1: app chạy bằng competency_app (không superuser),
-- nên các policy dưới đây THẬT SỰ có tác dụng (superuser bỏ qua RLS).

BEGIN;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON activity_log;
CREATE POLICY tenant_isolation ON activity_log
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON audit_log;
CREATE POLICY tenant_isolation ON audit_log
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON badges;
CREATE POLICY tenant_isolation ON badges
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON certificates;
CREATE POLICY tenant_isolation ON certificates
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE competency_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON competency_levels;
CREATE POLICY tenant_isolation ON competency_levels
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON daily_tasks;
CREATE POLICY tenant_isolation ON daily_tasks
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE evidence_grades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON evidence_grades;
CREATE POLICY tenant_isolation ON evidence_grades
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE exercise_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON exercise_types;
CREATE POLICY tenant_isolation ON exercise_types
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON exercises;
CREATE POLICY tenant_isolation ON exercises
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON export_jobs;
CREATE POLICY tenant_isolation ON export_jobs
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE hearts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON hearts;
CREATE POLICY tenant_isolation ON hearts
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON import_logs;
CREATE POLICY tenant_isolation ON import_logs
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE labs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON labs;
CREATE POLICY tenant_isolation ON labs
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON lessons;
CREATE POLICY tenant_isolation ON lessons
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE level_tracks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON level_tracks;
CREATE POLICY tenant_isolation ON level_tracks
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON modules;
CREATE POLICY tenant_isolation ON modules
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE node_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON node_comments;
CREATE POLICY tenant_isolation ON node_comments
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE node_journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON node_journal_entries;
CREATE POLICY tenant_isolation ON node_journal_entries
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE node_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON node_resources;
CREATE POLICY tenant_isolation ON node_resources
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE node_type_appearance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON node_type_appearance;
CREATE POLICY tenant_isolation ON node_type_appearance
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON notifications;
CREATE POLICY tenant_isolation ON notifications
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE review_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON review_schedules;
CREATE POLICY tenant_isolation ON review_schedules
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE roadmap_tree_nodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON roadmap_tree_nodes;
CREATE POLICY tenant_isolation ON roadmap_tree_nodes
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE role_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON role_profiles;
CREATE POLICY tenant_isolation ON role_profiles
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE role_skill_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON role_skill_requirements;
CREATE POLICY tenant_isolation ON role_skill_requirements
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE skill_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON skill_audit_log;
CREATE POLICY tenant_isolation ON skill_audit_log
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE skill_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON skill_categories;
CREATE POLICY tenant_isolation ON skill_categories
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON skills;
CREATE POLICY tenant_isolation ON skills
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON streaks;
CREATE POLICY tenant_isolation ON streaks
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON user_badges;
CREATE POLICY tenant_isolation ON user_badges
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE user_exercise_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON user_exercise_attempts;
CREATE POLICY tenant_isolation ON user_exercise_attempts
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE user_lab_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON user_lab_progress;
CREATE POLICY tenant_isolation ON user_lab_progress
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE user_lesson_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON user_lesson_progress;
CREATE POLICY tenant_isolation ON user_lesson_progress
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE user_level_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON user_level_progress;
CREATE POLICY tenant_isolation ON user_level_progress
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE user_node_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON user_node_progress;
CREATE POLICY tenant_isolation ON user_node_progress
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE user_planner_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON user_planner_settings;
CREATE POLICY tenant_isolation ON user_planner_settings
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE user_role_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON user_role_targets;
CREATE POLICY tenant_isolation ON user_role_targets
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE user_skill_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON user_skill_progress;
CREATE POLICY tenant_isolation ON user_skill_progress
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE user_week_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON user_week_notes;
CREATE POLICY tenant_isolation ON user_week_notes
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE user_week_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON user_week_progress;
CREATE POLICY tenant_isolation ON user_week_progress
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE weeks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON weeks;
CREATE POLICY tenant_isolation ON weeks
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE workspace_follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON workspace_follows;
CREATE POLICY tenant_isolation ON workspace_follows
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON workspace_invites;
CREATE POLICY tenant_isolation ON workspace_invites
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON workspace_members;
CREATE POLICY tenant_isolation ON workspace_members
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON xp_events;
CREATE POLICY tenant_isolation ON xp_events
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);

-- NGOẠI LỆ CÓ LÝ DO (không fail-closed theo workspace_id):
-- certificates: route public /cert/<code> tra theo code (code chính là bí mật,
--   policy workspace_id sẽ chặn lookup này). Row-level secret = đủ.
DROP POLICY IF EXISTS tenant_isolation ON certificates;
CREATE POLICY tenant_isolation ON certificates USING (true) WITH CHECK (true);
-- workspace_invites: acceptPendingInvites chạy lúc login, chưa có ws context;
--   tra theo email + token. Idempotent, chỉ insert member đã có invite hợp lệ.
DROP POLICY IF EXISTS tenant_isolation ON workspace_invites;
CREATE POLICY tenant_isolation ON workspace_invites USING (true) WITH CHECK (true);

COMMIT;
