-- 0010_workspace_slug_global_unique.sql
--
-- Makes `workspaces.slug` unique across the WHOLE table, not just per owner.
--
-- Why: every lookup resolves a workspace by slug alone —
--   src/lib/rbac/resolve.ts     resolveWorkspace()        .where(eq(slug, ?)).limit(1)
--   src/lib/workspace.ts        requireWorkspaceAccess()  .where(eq(slug, ?)).limit(1)
--   /w/[slug], /share/[slug]    route params
-- but the only uniqueness guarantee was `workspaces_owner_slug_uq (owner_user_id, slug)`.
-- Two owners could both hold `devops`; `/w/devops` then resolved to whichever
-- row Postgres returned first (no ORDER BY = no guarantee, and it can change
-- after a VACUUM or plan flip). The loser's workspace became unreachable —
-- they got WORKSPACE_NOT_FOUND_OR_FORBIDDEN on a workspace they own.
--
-- RBAC still ran against the resolved id, so this was URL hijack + denial,
-- not a cross-tenant data leak. Fixing it removes a whole class of
-- multi-tenant weirdness before the table has real customers in it.
--
-- Idempotent: re-running on a partially-migrated DB is safe. Mirrors the
-- guard style of 0003_node_journal.sql / 0004_node_resources.sql.
--
-- Allocation side lives in src/lib/workspace/slug.ts (reserveWorkspaceSlug).

-- Guard: refuse to create the index while duplicates exist, with a message
-- that names them, rather than failing with an opaque constraint error.
DO $$
DECLARE
  dup_list text;
BEGIN
  SELECT string_agg(slug || ' (x' || cnt || ')', ', ')
    INTO dup_list
    FROM (
      SELECT slug, count(*) AS cnt
        FROM workspaces
       GROUP BY slug
      HAVING count(*) > 1
    ) d;

  IF dup_list IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot enforce global slug uniqueness: duplicate slugs still present -> %. Rename them first (e.g. append -2), then re-run.',
      dup_list;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_slug_uq" ON "workspaces" ("slug");

-- The composite index stays: it is what makes `listMyWorkspaces` and the
-- owner-scoped lookups cheap, and dropping it would leave owner_user_id
-- covered only by `workspaces_owner_idx`. Keeping both costs one small index
-- on a table that holds one row per workspace.
