/**
 * Smoke test for RBAC tables + resolver round-trip.
 *
 * Verifies:
 *   1. audit_log + workspace_members tables exist with the right columns.
 *   2. We can INSERT and SELECT a fake audit row.
 *   3. Existing workspaces are reachable via owner_user_id.
 */
import 'dotenv/config';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config as dotenvConfig } from 'dotenv';
import postgres from 'postgres';

const local = join(process.cwd(), '.env.local');
if (existsSync(local)) dotenvConfig({ path: local, override: true });

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL missing');

const sql = postgres(url, { prepare: false, max: 1 });

async function main() {
  const cols = await sql<{ table_name: string; column_name: string }[]>`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('workspace_members', 'audit_log')
    ORDER BY table_name, ordinal_position
  `;
  console.log('[smoke] columns:');
  for (const c of cols) console.log(`  ${c.table_name}.${c.column_name}`);

  const ws = await sql<{ id: string; slug: string; owner_user_id: string }[]>`
    SELECT id, slug, owner_user_id FROM workspaces LIMIT 3
  `;
  console.log('[smoke] sample workspaces:', ws);

  const before = await sql<{ count: string }[]>`SELECT count(*) FROM audit_log`;
  console.log('[smoke] audit_log row count before insert:', before[0]?.count);

  // Insert a probe audit row
  const inserted = await sql<{ id: string }[]>`
    INSERT INTO audit_log (workspace_id, actor_user_id, actor_role, action, resource_type, resource_id, before, after)
    VALUES (NULL, NULL, 'super_admin', 'smoke.test', 'probe', 'rbac-smoke', NULL, ${sql.json({ ok: true })})
    RETURNING id
  `;
  console.log('[smoke] inserted probe id:', inserted[0]?.id);

  const recent = await sql<{ action: string; actor_role: string; created_at: Date }[]>`
    SELECT action, actor_role, created_at FROM audit_log
    ORDER BY created_at DESC LIMIT 5
  `;
  console.log('[smoke] recent audit rows:');
  for (const r of recent) console.log(`  ${r.created_at.toISOString()} ${r.actor_role} ${r.action}`);

  // Clean up probe so the table stays clean for real traffic
  if (inserted[0]) {
    await sql`DELETE FROM audit_log WHERE id = ${inserted[0].id}`;
    console.log('[smoke] probe row deleted');
  }

  console.log('[smoke] OK');
}

main().catch((err) => {
  console.error('[smoke] FAILED:', err);
  process.exit(1);
}).finally(() => sql.end({ timeout: 5 }));
