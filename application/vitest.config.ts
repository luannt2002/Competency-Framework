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
    // `tests/integration/**` chạm Postgres thật (cần DATABASE_URL đã migrate).
    // Hai lỗi P0 của cây nằm ở tầng SQL chứ không ở logic JS — mock thì cả hai
    // đều "xanh", nên phải có một tầng test chạm DB.
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
