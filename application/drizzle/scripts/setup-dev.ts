/**
 * setup-dev.ts — one-shot local dev bootstrap.
 *
 * Creates a workspace for DEV_AUTH_BYPASS_USER_ID, then delegates content
 * seeding to the two existing idempotent scripts:
 *   1. bootstrap-full-workspace  — skills, tracks, weeks, lessons, exercises
 *   2. seed-tree-from-tracks     — roadmap_tree_nodes
 *
 * Idempotent: skips if workspace 'my-roadmap' already exists for that user.
 *
 * Usage (via pnpm): `pnpm db:setup`
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { execSync } from 'node:child_process';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and } from 'drizzle-orm';
import { workspaces, frameworkTemplates } from '../../src/lib/db/schema';
import { frameworkPayloadSchema } from '../../src/lib/framework/payload-schema';

const DEV_USER_ID =
  process.env.DEV_AUTH_BYPASS_USER_ID ?? '00000000-0000-0000-0000-000000000001';
const DEV_WORKSPACE_SLUG = 'my-roadmap';

const dbUrl = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('[setup-dev] DATABASE_URL missing. Copy .env.example → .env.local first.');
  process.exit(1);
}

const sql = postgres(dbUrl, { prepare: false, max: 1 });
const db = drizzle(sql);

async function main() {
  console.log(`[setup-dev] user=${DEV_USER_ID}`);

  // Check if workspace already exists
  const existing = await db
    .select({ id: workspaces.id, slug: workspaces.slug })
    .from(workspaces)
    .where(and(eq(workspaces.ownerUserId, DEV_USER_ID), eq(workspaces.slug, DEV_WORKSPACE_SLUG)))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[setup-dev] Workspace '${DEV_WORKSPACE_SLUG}' already exists (id=${existing[0]!.id}) — skipping.`);
    console.log(`[setup-dev] Open http://localhost:3000 → you are auto-logged-in.`);
    await sql.end();
    return;
  }

  // Load first published template
  const tplRows = await db
    .select()
    .from(frameworkTemplates)
    .where(eq(frameworkTemplates.isPublished, true))
    .limit(1);

  const tpl = tplRows[0];
  if (!tpl) {
    console.error('[setup-dev] No published templates found. Run `pnpm db:seed` first.');
    await sql.end();
    process.exit(1);
  }

  const payload = frameworkPayloadSchema.parse(tpl.payload);
  console.log(`[setup-dev] Template: ${tpl.slug} (${payload.name})`);

  // Create workspace
  const [ws] = await db
    .insert(workspaces)
    .values({
      ownerUserId: DEV_USER_ID,
      slug: DEV_WORKSPACE_SLUG,
      name: payload.name,
      icon: payload.icon,
      color: payload.color,
      frameworkTemplateId: tpl.id,
      visibility: 'public-readonly',
    })
    .returning();

  if (!ws) throw new Error('Workspace insert returned nothing');
  console.log(`[setup-dev] Created workspace: id=${ws.id} slug=${ws.slug}`);
  await sql.end();

  // Delegate to existing idempotent scripts
  const run = (label: string, cmd: string) => {
    console.log(`[setup-dev] → ${label}`);
    execSync(cmd, { stdio: 'inherit' });
  };

  run(
    'bootstrap content (skills / tracks / lessons / exercises)',
    `tsx drizzle/scripts/bootstrap-full-workspace.ts ${ws.id} ${DEV_USER_ID}`,
  );
  run(
    'seed tree nodes from tracks',
    `tsx drizzle/scripts/seed-tree-from-tracks.ts ${ws.id}`,
  );

  console.log('');
  console.log(`[setup-dev] ✓ Done!`);
  console.log(`[setup-dev]   workspace : /w/${ws.slug}`);
  console.log(`[setup-dev]   user id   : ${DEV_USER_ID}`);
  console.log(`[setup-dev]   Open http://localhost:3000 — you are auto-logged-in.`);
}

main().catch((err) => {
  console.error('[setup-dev] ERROR:', err);
  process.exit(1);
});
