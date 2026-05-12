-- 0002_rbac_tables.sql
-- RBAC tables backing the 7-tier role model.
-- See docs/dev/RBAC_PERMISSIONS.md and src/lib/db/schema-rbac.ts.
--
-- Idempotent: uses IF NOT EXISTS so re-running on a partially-migrated DB is safe.

CREATE TABLE IF NOT EXISTS "workspace_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" varchar(32) NOT NULL DEFAULT 'learner',
  "invited_by" uuid,
  "invited_at" timestamp with time zone DEFAULT now(),
  "joined_at" timestamp with time zone
);

DO $$ BEGIN
  ALTER TABLE "workspace_members"
    ADD CONSTRAINT "workspace_members_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_members_ws_user_uq"
  ON "workspace_members" USING btree ("workspace_id", "user_id");

CREATE INDEX IF NOT EXISTS "workspace_members_user_idx"
  ON "workspace_members" USING btree ("user_id");

-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid,
  "actor_user_id" uuid,
  "actor_role" varchar(32),
  "action" varchar(64) NOT NULL,
  "resource_type" varchar(32) NOT NULL,
  "resource_id" varchar(128),
  "before" jsonb,
  "after" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "audit_log"
    ADD CONSTRAINT "audit_log_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "audit_log_ws_created_idx"
  ON "audit_log" USING btree ("workspace_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "audit_log_actor_created_idx"
  ON "audit_log" USING btree ("actor_user_id", "created_at" DESC);
