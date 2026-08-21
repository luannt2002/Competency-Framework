/**
 * Applies the streak badges migration (0011_streak_badges.sql) using the
 * postgres-js client.
 *
 * Usage: pnpm tsx scripts/apply-streak-badges.ts
 *
 * Reads $DATABASE_URL_DIRECT (or falls back to $DATABASE_URL) and executes
 * the SQL file at drizzle/migrations/0011_streak_badges.sql. Idempotent —
 * the INSERT is guarded by NOT EXISTS on (workspace_id, slug).
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
  const sqlPath = join(process.cwd(), 'drizzle/migrations/0011_streak_badges.sql');
  const ddl = readFileSync(sqlPath, 'utf-8');

  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    await sql.unsafe(ddl);
    // Verify — every workspace should now carry both streak badge slugs.
    const rows = await sql<{ slug: string; count: string }[]>`
      SELECT b.slug, COUNT(*)::text AS count
      FROM badges b
      WHERE b.slug IN ('streak-3', 'streak-100')
      GROUP BY b.slug
      ORDER BY b.slug
    `;
    console.log(
      '[streak-badges] OK — rows per slug:',
      rows.map((r) => `${r.slug}=${r.count}`),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error('[streak-badges] FAILED:', err);
  process.exit(1);
});
