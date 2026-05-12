/**
 * Applies the social migration (0005_social.sql) using the postgres-js client.
 *
 * Usage: pnpm tsx scripts/apply-social-migration.ts
 *
 * Reads $DATABASE_URL_DIRECT (or falls back to $DATABASE_URL) and executes the
 * SQL file at drizzle/migrations/0005_social.sql. Idempotent — uses IF NOT
 * EXISTS guards in the SQL.
 *
 * Mirrors scripts/apply-resources-migration.ts.
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
    'drizzle/migrations/0005_social.sql',
  );
  const ddl = readFileSync(sqlPath, 'utf-8');

  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    await sql.unsafe(ddl);
    const tables = await sql<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('node_comments', 'workspace_follows', 'notifications')
      ORDER BY tablename
    `;
    const indexes = await sql<{ tablename: string; indexname: string }[]>`
      SELECT tablename, indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('node_comments', 'workspace_follows', 'notifications')
      ORDER BY tablename, indexname
    `;
    console.log(
      '[social-migration] OK — tables:',
      tables.map((t) => t.tablename),
    );
    console.log('[social-migration] indexes:');
    for (const i of indexes) console.log('  ', i.tablename, '·', i.indexname);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error('[social-migration] FAILED:', err);
  process.exit(1);
});
