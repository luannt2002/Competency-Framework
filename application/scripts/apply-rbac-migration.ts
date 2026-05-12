/**
 * Applies the RBAC migration (0002_rbac_tables.sql) using the postgres-js client.
 *
 * Usage: pnpm tsx scripts/apply-rbac-migration.ts
 *
 * Reads $DATABASE_URL_DIRECT (or falls back to $DATABASE_URL) and executes the
 * SQL file at drizzle/migrations/0002_rbac_tables.sql. Idempotent — uses
 * IF NOT EXISTS guards in the SQL.
 */
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { config as dotenvConfig } from 'dotenv';
import postgres from 'postgres';

// dotenv/config only loads .env, not .env.local — Next.js loads both. Mirror
// that here so the script picks up the local override.
const local = join(process.cwd(), '.env.local');
if (existsSync(local)) dotenvConfig({ path: local, override: true });

async function main() {
  const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL_DIRECT (or DATABASE_URL) must be set');
  }
  const sqlPath = join(process.cwd(), 'drizzle/migrations/0002_rbac_tables.sql');
  const ddl = readFileSync(sqlPath, 'utf-8');

  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    // postgres-js can run multiple statements via .unsafe()
    await sql.unsafe(ddl);
    // Verify
    const tables = await sql<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('workspace_members', 'audit_log')
      ORDER BY tablename
    `;
    console.log('[rbac-migration] OK — tables present:', tables.map((t) => t.tablename));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error('[rbac-migration] FAILED:', err);
  process.exit(1);
});
