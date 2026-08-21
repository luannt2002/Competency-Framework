-- 0011_resource_kinds_tool_lab.sql
--
-- Extends the allowed `node_resources.kind` set with `tool` and `lab`.
--
-- Why: the resource library only accepted link / video / doc / book, but
-- learning roadmaps also reference tools (IDEs, CLIs, cloud consoles) and
-- hands-on labs (Katacoda-style exercises). The TS list
-- (src/lib/db/schema-resources.ts) and the add-resource dialog already
-- accept the extended set; this keeps the SQL CHECK in sync.
--
-- Idempotent: re-running on a partially-migrated DB is safe. Mirrors the
-- guard style of 0004_node_resources.sql.

ALTER TABLE "node_resources" DROP CONSTRAINT IF EXISTS "node_resources_kind_check";

DO $$ BEGIN
  ALTER TABLE "node_resources"
    ADD CONSTRAINT "node_resources_kind_check"
    CHECK ("kind" IN ('link', 'video', 'doc', 'book', 'tool', 'lab'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
