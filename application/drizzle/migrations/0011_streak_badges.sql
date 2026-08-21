-- 0011_streak_badges.sql
-- Backfill the two missing streak badges ("First Streak" = 3 days,
-- "Century Learner" = 100 days) into every existing workspace's badges table.
-- Mirrors the same rows added to drizzle/seeds/devops.json (the framework
-- template payload), so freshly bootstrapped workspaces get them too.
--
-- Idempotent: re-running inserts nothing (per-workspace slug uniqueness).

INSERT INTO "badges" ("workspace_id", "slug", "name", "description", "icon", "rule")
SELECT
  w."id",
  v."slug",
  v."name",
  v."description",
  v."icon",
  v."rule"::jsonb
FROM "workspaces" w
CROSS JOIN (VALUES
  ('streak-3',   'First Streak',    '3 ngày streak liên tiếp.',   'CalendarCheck', '{"kind":"streak","value":3}'),
  ('streak-100', 'Century Learner', '100 ngày streak liên tiếp.', 'Medal',         '{"kind":"streak","value":100}')
) AS v("slug", "name", "description", "icon", "rule")
WHERE NOT EXISTS (
  SELECT 1
  FROM "badges" b
  WHERE b."workspace_id" = w."id"
    AND b."slug" = v."slug"
);
