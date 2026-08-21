-- 0013_badges_is_active.sql
-- F16 — creator custom badge CRUD. Adds a soft-delete/deactivate flag to the
-- existing `badges` table. Deactivating (NOT deleting) a badge that learners
-- already earned keeps `user_badges` rows intact; the evaluator skips
-- inactive badges so no new grants happen.
--
-- Idempotent: re-running is a no-op.

ALTER TABLE "badges"
  ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;
