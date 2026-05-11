import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';

// Load .env.local (dev) + .env (CI) before tests run so transitive imports
// that read DATABASE_URL etc. don't crash at module-load time.
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
