-- 0006_open_exercise_types.sql
-- Open the exercise system: any tenant can define new exercise kinds (essay,
-- rubric, numeric range, …) WITHOUT a code change and WITHOUT a migration.
--
-- Three moves:
--   1. exercises.kind: enum `exercise_kind` -> text. The 6 existing values are
--      preserved byte-for-byte; a lightweight slug-format CHECK replaces the
--      closed enum so the set stays open but still sane.
--   2. exercise_types: per-workspace catalogue of exercise kinds. A row with
--      workspace_id IS NULL is a global built-in shipped with the product;
--      a row with workspace_id = <ws> is that tenant's own kind. Readers must
--      always filter `workspace_id = :ws OR workspace_id IS NULL`.
--   3. user_exercise_attempts: grading columns (score / status / feedback_md /
--      graded_by / graded_at / rubric) so an attempt can be *pending review*
--      instead of a naked boolean. Existing rows are backfilled from is_correct.
--
-- Also widens notifications_kind_check by one value ('attempt.graded') so the
-- manual-grading screen can notify the learner.
--
-- Idempotent: IF NOT EXISTS + DO $$ … EXCEPTION guards throughout, mirroring
-- drizzle/migrations/0004_node_resources.sql. Safe to re-run.
--
-- See src/lib/db/schema-exercises.ts for the Drizzle mirror.

/* ==================== 1. exercises.kind : enum -> text ==================== */

-- Only converts when the column is still the enum, so a re-run is a no-op.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'exercises'
      AND column_name = 'kind'
      AND udt_name = 'exercise_kind'
  ) THEN
    ALTER TABLE "exercises" ALTER COLUMN "kind" TYPE text USING "kind"::text;
  END IF;
END $$;

-- Format guard only — deliberately NOT a value whitelist and NOT a foreign key
-- to exercise_types, because built-ins live on workspace_id IS NULL rows and a
-- tenant kind must be creatable at runtime. Application code resolves the slug
-- against exercise_types + the grader registry.
DO $$ BEGIN
  ALTER TABLE "exercises"
    ADD CONSTRAINT "exercises_kind_slug_check"
    CHECK ("kind" ~ '^[a-z][a-z0-9_]{1,47}$');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

/* ==================== 2. exercise_types ==================== */

CREATE TABLE IF NOT EXISTS "exercise_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- NULL = global built-in, visible to every workspace, editable by nobody.
  "workspace_id" uuid,
  -- Value stored in exercises.kind.
  "slug" text NOT NULL,
  "label" text NOT NULL,
  "description" text,
  -- auto = graded by the engine; manual = always queued for a human;
  -- hybrid = engine may return pending_review (e.g. rubric without scores yet).
  "grading_mode" text NOT NULL DEFAULT 'auto',
  -- Registry key of the grader that powers this type (see src/lib/exercises).
  -- Intentionally unconstrained in SQL: engines are code, validated in the app.
  "engine" text NOT NULL,
  -- Declarative field spec ({"fields":[{key,label,type,required,secret}]}) used
  -- to validate authored payloads/answers for TENANT-defined types.
  "payload_schema" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "answer_schema" jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Engine options (defaults for matchKind, passThreshold, …).
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Payload paths that must never be serialized to a client. Generalises the
  -- old hardcoded stripCorrect() switch. Supports `a.b` and `a[].b`.
  "secret_fields" text[] NOT NULL DEFAULT '{}'::text[],
  "is_builtin" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by_user_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "exercise_types"
    ADD CONSTRAINT "exercise_types_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "exercise_types"
    ADD CONSTRAINT "exercise_types_slug_check"
    CHECK ("slug" ~ '^[a-z][a-z0-9_]{1,47}$');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "exercise_types"
    ADD CONSTRAINT "exercise_types_grading_mode_check"
    CHECK ("grading_mode" IN ('auto', 'manual', 'hybrid'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- A tenant owns its slug namespace…
CREATE UNIQUE INDEX IF NOT EXISTS "et_ws_slug_uq"
  ON "exercise_types" USING btree ("workspace_id", "slug")
  WHERE "workspace_id" IS NOT NULL;

-- …and built-ins own the global namespace.
CREATE UNIQUE INDEX IF NOT EXISTS "et_builtin_slug_uq"
  ON "exercise_types" USING btree ("slug")
  WHERE "workspace_id" IS NULL;

-- Primary access path: list the kinds usable inside one workspace.
CREATE INDEX IF NOT EXISTS "et_ws_active_idx"
  ON "exercise_types" USING btree ("workspace_id", "is_active");

/* ---- Seed the built-in kinds (global rows, workspace_id IS NULL) ----
   6 legacy kinds carried over from the old `exercise_kind` enum, plus the 4
   new engines. Field specs / secret paths for built-ins come from the code
   registry (src/lib/exercises/builtin-types.ts), so nothing is duplicated in
   JSONB here — these rows only make the kinds selectable + labelled.
   Drift between this list and the TS registry is asserted in
   tests/unit/exercise-builtin-types.test.ts.                              */
INSERT INTO "exercise_types"
  ("workspace_id", "slug", "label", "grading_mode", "engine", "is_builtin", "is_active")
VALUES
  (NULL, 'mcq', 'Trắc nghiệm 1 đáp án', 'auto', 'mcq', true, true),
  (NULL, 'mcq_multi', 'Trắc nghiệm nhiều đáp án', 'auto', 'mcq_multi', true, true),
  (NULL, 'fill_blank', 'Điền vào chỗ trống', 'auto', 'fill_blank', true, true),
  (NULL, 'order_steps', 'Sắp xếp thứ tự', 'auto', 'order_steps', true, true),
  (NULL, 'type_answer', 'Gõ đáp án', 'auto', 'type_answer', true, true),
  (NULL, 'code_block_review', 'Đọc code chọn lỗi', 'auto', 'code_block_review', true, true),
  (NULL, 'essay', 'Tự luận', 'manual', 'essay', true, true),
  (NULL, 'rubric', 'Chấm theo rubric', 'hybrid', 'rubric', true, true),
  (NULL, 'numeric_range', 'Đáp án số theo khoảng', 'auto', 'numeric_range', true, true),
  (NULL, 'short_answer', 'Trả lời ngắn', 'auto', 'short_answer', true, true)
ON CONFLICT ("slug") WHERE "workspace_id" IS NULL DO NOTHING;

/* ==================== 3. user_exercise_attempts: grading ==================== */

ALTER TABLE "user_exercise_attempts" ADD COLUMN IF NOT EXISTS "score" numeric;
ALTER TABLE "user_exercise_attempts" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE "user_exercise_attempts" ADD COLUMN IF NOT EXISTS "feedback_md" text;
ALTER TABLE "user_exercise_attempts" ADD COLUMN IF NOT EXISTS "graded_by" uuid;
ALTER TABLE "user_exercise_attempts" ADD COLUMN IF NOT EXISTS "graded_at" timestamp with time zone;
ALTER TABLE "user_exercise_attempts" ADD COLUMN IF NOT EXISTS "rubric" jsonb;

DO $$ BEGIN
  ALTER TABLE "user_exercise_attempts"
    ADD CONSTRAINT "uea_status_check"
    CHECK ("status" IS NULL OR "status" IN ('correct', 'incorrect', 'partial', 'pending_review'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_exercise_attempts"
    ADD CONSTRAINT "uea_score_range_check"
    CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 1));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Backfill legacy rows so the two representations agree. Guarded by
-- `status IS NULL` so a re-run never overwrites a human grade.
UPDATE "user_exercise_attempts"
SET "status" = CASE WHEN "is_correct" IS TRUE THEN 'correct' ELSE 'incorrect' END,
    "score"  = CASE WHEN "is_correct" IS TRUE THEN 1 ELSE 0 END
WHERE "status" IS NULL;

-- Grading queue access path: the pending pile of one workspace, oldest first.
CREATE INDEX IF NOT EXISTS "uea_ws_pending_idx"
  ON "user_exercise_attempts" USING btree ("workspace_id", "created_at")
  WHERE "status" = 'pending_review';

/* ==================== 4. notifications: one new kind ==================== */

-- 0005_social.sql pinned the kind set with a CHECK. Manual grading needs to
-- tell the learner their essay was graded, so the set gains 'attempt.graded'.
-- DROP … IF EXISTS first keeps this re-runnable.
DO $$ BEGIN
  ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_kind_check";
  ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_kind_check"
    CHECK ("kind" IN (
      'comment.reply',
      'follow.new',
      'invite.received',
      'workspace.shared',
      'milestone.completed',
      'attempt.graded'
    ));
END $$;
