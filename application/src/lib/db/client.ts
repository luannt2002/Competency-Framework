/**
 * Drizzle client — uses `postgres-js` driver against PostgreSQL (Supabase or self-host).
 * Single connection pool, lazy-init for serverless friendliness.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

declare global {
  // eslint-disable-next-line no-var
  var _pgClient: ReturnType<typeof postgres> | undefined;
}

function getClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Did you copy .env.example to .env.local?');
  }
  if (!globalThis._pgClient) {
    globalThis._pgClient = postgres(process.env.DATABASE_URL, {
      prepare: false, // Supabase pooler does not support prepared statements
      max: 10,
    });
  }
  return globalThis._pgClient;
}

export const db = drizzle(getClient(), { schema });

export { schema };
export type Db = typeof db;
