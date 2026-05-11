import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load .env.local first (dev), fallback to .env (CI/prod)
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
