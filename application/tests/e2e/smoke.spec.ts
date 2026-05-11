import { test, expect } from '@playwright/test';

/**
 * Smoke E2E — verifies key landing routes render without 500.
 * Does not exercise authenticated flow (requires Supabase setup).
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

test.describe('Smoke', () => {
  test('landing page renders hero + frameworks strip', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByRole('heading', { name: /competency framework|master the level/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /get started/i })).toBeVisible();
  });

  test('sign-in page renders email form', async ({ page }) => {
    await page.goto(`${BASE}/sign-in`);
    await expect(page.getByPlaceholder(/you@example\.com/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /magic link/i })).toBeVisible();
  });
});
