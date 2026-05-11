/**
 * Standalone CLI for bootstrap ingestion — runs the markdown ETL without
 * needing the web app to be up.
 *
 * Usage:
 *   tsx drizzle/scripts/etl-import.ts --workspace-id=<uuid>
 *   tsx drizzle/scripts/etl-import.ts --workspace-id=<uuid> --csv
 *   tsx drizzle/scripts/etl-import.ts --workspace-id=<uuid> --markdown --csv
 *
 * Defaults: when neither --markdown nor --csv is passed, both are enabled
 * (markdown first, then CSV — order is irrelevant for idempotency).
 */
import 'dotenv/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { runIngestion } from '../../src/lib/etl/import-runner';

/* ============================ args ============================ */

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
  }
  return undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`);
}

/* ============================ paths ============================ */

// `tsx` runs scripts in CJS-compatible mode where `__dirname` is available
// (same pattern used in drizzle/seed.ts).
const APPLICATION_ROOT = resolve(__dirname, '../..'); // .../application
const REPO_ROOT = resolve(APPLICATION_ROOT, '..'); // .../devops-roadmap

const MARKDOWN_FILES = [
  '02_PHASE1_AWS_TERRAFORM_DEEP_DIVE_Q1.md',
  '03_PHASE2_KUBERNETES_EKS_GOLANG_Q2.md',
  '04_PHASE3_DEVSECOPS_GITOPS_ADVANCED_Q3.md',
  '05_PHASE4_PLATFORM_ENGINEERING_GOLANG_SENIOR_Q4.md',
].map((f) => resolve(REPO_ROOT, f));

const SKILLS_CSV = resolve(APPLICATION_ROOT, 'drizzle/seeds/raw-csv/skills.csv');
const LEVELS_CSV = resolve(APPLICATION_ROOT, 'drizzle/seeds/raw-csv/levels.csv');

/* ============================ main ============================ */

async function main() {
  const workspaceId = getArg('workspace-id') ?? getArg('workspace');
  if (!workspaceId) {
    console.error('[etl-import] Missing --workspace-id=<uuid>');
    process.exit(1);
  }
  const markdownRequested = hasFlag('markdown');
  const csvRequested = hasFlag('csv');
  const both = !markdownRequested && !csvRequested;

  const dbUrl = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[etl-import] DATABASE_URL not set. Copy .env.example → .env.local.');
    process.exit(1);
  }
  const sql = postgres(dbUrl, { prepare: false, max: 1 });
  const db = drizzle(sql);

  const sources: {
    markdownPaths?: string[];
    skillsCsvPath?: string;
    levelsCsvPath?: string;
  } = {};

  if (both || markdownRequested) {
    const missing = MARKDOWN_FILES.filter((p) => !existsSync(p));
    if (missing.length > 0) {
      console.error('[etl-import] Missing markdown files:');
      for (const m of missing) console.error('  -', m);
      process.exit(1);
    }
    sources.markdownPaths = MARKDOWN_FILES;
  }
  if (both || csvRequested) {
    if (existsSync(SKILLS_CSV)) sources.skillsCsvPath = SKILLS_CSV;
    if (existsSync(LEVELS_CSV)) sources.levelsCsvPath = LEVELS_CSV;
    if (!sources.skillsCsvPath && !sources.levelsCsvPath && !sources.markdownPaths) {
      console.error(
        '[etl-import] --csv was requested but neither skills.csv nor levels.csv exists.',
      );
      process.exit(1);
    }
  }

  console.log('[etl-import] workspaceId =', workspaceId);
  console.log('[etl-import] sources    =', sources);

  // Cast to satisfy the cross-package typing — at runtime the schema is the
  // same single Drizzle instance.
  const dbAny = db as unknown as Parameters<typeof runIngestion>[0]['db'];
  const result = await runIngestion({
    workspaceId,
    db: dbAny,
    sources,
  });

  console.log('[etl-import] result    =', JSON.stringify(result, null, 2));
  console.log('[etl-import] Done.');
  await sql.end();
  if (result.errors.length > 0) process.exit(2);
}

main().catch((err) => {
  console.error('[etl-import] Fatal:', err);
  process.exit(1);
});
