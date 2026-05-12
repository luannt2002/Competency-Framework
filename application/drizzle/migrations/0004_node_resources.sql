-- 0004_node_resources.sql
-- Resource library: per-node curated links / videos / docs / books that a
-- learner can attach to any tree node. Many resources per node; resources
-- belong to the workspace (cascade-deleted with it).
--
-- Idempotent: uses IF NOT EXISTS guards so re-running on a partially-migrated
-- DB is safe. Mirrors the pattern in 0003_node_journal.sql.
--
-- See src/lib/db/schema-resources.ts for the Drizzle mirror.

CREATE TABLE IF NOT EXISTS "node_resources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "node_id" uuid NOT NULL,
  "kind" varchar(16) NOT NULL,
  "title" varchar(200) NOT NULL,
  "url" text NOT NULL,
  "description" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "added_by_user_id" uuid
);

DO $$ BEGIN
  ALTER TABLE "node_resources"
    ADD CONSTRAINT "node_resources_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "node_resources"
    ADD CONSTRAINT "node_resources_node_id_fk"
    FOREIGN KEY ("node_id") REFERENCES "public"."roadmap_tree_nodes"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "node_resources"
    ADD CONSTRAINT "node_resources_kind_check"
    CHECK ("kind" IN ('link', 'video', 'doc', 'book'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Primary access path: list resources for a node in a workspace.
CREATE INDEX IF NOT EXISTS "nr_ws_node_idx"
  ON "node_resources" USING btree ("workspace_id", "node_id");
