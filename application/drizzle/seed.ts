/**
 * Seed runner — inserts the system framework template `devops` into `framework_templates`.
 *
 * Run: `pnpm db:seed`
 *
 * Idempotent: re-running updates payload + bumps version timestamp.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { frameworkTemplates } from '../src/lib/db/schema';

const dbUrl = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('[seed] DATABASE_URL missing. Copy .env.example → .env.local first.');
  process.exit(1);
}

const sql = postgres(dbUrl, { prepare: false, max: 1 });
const db = drizzle(sql);

async function seedTemplate(slug: string, jsonPath: string) {
  const fullPath = resolve(__dirname, jsonPath);
  const payload = JSON.parse(readFileSync(fullPath, 'utf-8'));

  console.log(`[seed] Upserting framework_templates.slug='${slug}' ...`);

  const existing = await db
    .select()
    .from(frameworkTemplates)
    .where(eq(frameworkTemplates.slug, slug))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(frameworkTemplates).values({
      slug,
      name: payload.name,
      description: payload.description,
      domain: payload.domain,
      authorKind: 'system',
      isPublished: true,
      payload,
      version: payload.schemaVersion ?? '2.0',
    });
    console.log(`[seed]   inserted.`);
  } else {
    await db
      .update(frameworkTemplates)
      .set({
        name: payload.name,
        description: payload.description,
        domain: payload.domain,
        payload,
        version: payload.schemaVersion ?? '2.0',
      })
      .where(eq(frameworkTemplates.slug, slug));
    console.log(`[seed]   updated.`);
  }
}

async function main() {
  await seedTemplate('devops', './seeds/devops.json');
  // Future: await seedTemplate('frontend-react', './seeds/frontend-react.json');
  // Future: await seedTemplate('backend-node', './seeds/backend-node.json');
  console.log('[seed] Done.');
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
