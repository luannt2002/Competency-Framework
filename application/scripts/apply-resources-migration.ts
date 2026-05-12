/**
 * Applies the resources migration (0004_node_resources.sql) using the
 * postgres-js client.
 *
 * Usage: pnpm tsx scripts/apply-resources-migration.ts
 *
 * Reads $DATABASE_URL_DIRECT (or falls back to $DATABASE_URL) and executes the
 * SQL file at drizzle/migrations/0004_node_resources.sql. Idempotent — uses
 * IF NOT EXISTS guards in the SQL.
 *
 * Mirrors scripts/apply-journal-migration.ts.
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
  const sqlPath = join(
    process.cwd(),
    'drizzle/migrations/0004_node_resources.sql',
  );
  const ddl = readFileSync(sqlPath, 'utf-8');

  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    await sql.unsafe(ddl);
    // Verify — the table + at least one of the indexes should exist.
    const tables = await sql<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = 'node_resources'
    `;
    const indexes = await sql<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'node_resources'
      ORDER BY indexname
    `;
    console.log(
      '[resources-migration] OK — tables:',
      tables.map((t) => t.tablename),
      'indexes:',
      indexes.map((i) => i.indexname),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error('[resources-migration] FAILED:', err);
  process.exit(1);
});
