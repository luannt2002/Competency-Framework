-- 0013_widen_rigid_enums.sql
-- Widen the last 3 rigid pgEnums to plain text, mirroring what migration 0006
-- did for `exercise_kind`: the column becomes text so tenant-defined values
-- can flow through without a code change or migration, while the allowed set
-- stays enforced at the app layer (zod / TS unions):
--   - evidence_grades.kind  (evidence_kind)   -> validated in src/actions/evidence.ts
--   - daily_tasks.kind      (daily_task_kind) -> PlannedTaskKind union + zod in
--                                                src/lib/learn/daily-planner.ts
--   - export_jobs.format    (export_format)   -> 'pdf' | 'xlsx' | 'json' (column
--                                                currently never written by app code)
--
-- Existing values are preserved byte-for-byte; the pgEnum types are dropped
-- afterwards. Idempotent via udt_name guards + IF EXISTS, mirroring 0006.

/* ==================== 1. evidence_grades.kind : enum -> text ==================== */

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'evidence_grades'
      AND column_name = 'kind'
      AND udt_name = 'evidence_kind'
  ) THEN
    ALTER TABLE "evidence_grades" ALTER COLUMN "kind" TYPE text USING "kind"::text;
  END IF;
END $$;

DROP TYPE IF EXISTS "evidence_kind";

/* ==================== 2. daily_tasks.kind : enum -> text ==================== */

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'daily_tasks'
      AND column_name = 'kind'
      AND udt_name = 'daily_task_kind'
  ) THEN
    ALTER TABLE "daily_tasks" ALTER COLUMN "kind" TYPE text USING "kind"::text;
  END IF;
END $$;

DROP TYPE IF EXISTS "daily_task_kind";

/* ==================== 3. export_jobs.format : enum -> text ==================== */

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'export_jobs'
      AND column_name = 'format'
      AND udt_name = 'export_format'
  ) THEN
    ALTER TABLE "export_jobs" ALTER COLUMN "format" TYPE text USING "format"::text;
  END IF;
END $$;

DROP TYPE IF EXISTS "export_format";
