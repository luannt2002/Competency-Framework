-- 0003_node_journal.sql
-- Journal / Posts feature: per-node multi-post blog entries (Week / Session /
-- Lesson / any node). One node can hold many journal entries — supports the
-- use case "1 buổi có nhiều bài post/blog/bài học/lab".
--
-- Idempotent: uses IF NOT EXISTS so re-running on a partially-migrated DB is
-- safe. Mirrors the pattern in 0002_rbac_tables.sql.
--
-- See src/lib/db/schema-journal.ts for the Drizzle mirror.

CREATE TABLE IF NOT EXISTS "node_journal_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "node_id" uuid NOT NULL,
  "author_user_id" uuid NOT NULL,
  "title" varchar(200) NOT NULL,
  "body_md" text NOT NULL,
  "tags" text[] DEFAULT '{}'::text[],
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "node_journal_entries"
    ADD CONSTRAINT "node_journal_entries_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "node_journal_entries"
    ADD CONSTRAINT "node_journal_entries_node_id_fk"
    FOREIGN KEY ("node_id") REFERENCES "public"."roadmap_tree_nodes"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Primary access path: list entries for a node in a workspace, newest first.
CREATE INDEX IF NOT EXISTS "nje_ws_node_created_idx"
  ON "node_journal_entries" USING btree ("workspace_id", "node_id", "created_at" DESC);

-- Secondary: lookup all entries authored by a user (e.g. "my posts").
CREATE INDEX IF NOT EXISTS "nje_author_idx"
  ON "node_journal_entries" USING btree ("author_user_id");
