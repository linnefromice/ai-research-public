/**
 * Visual regression smoke tests
 *
 * Playwright を使った主要ページのスクリーンショット比較。
 * 初回実行で baseline が作成され、以降は差分検知。
 *
 * Run: npx playwright test tests/visual.spec.ts --update-snapshots (初回)
 *      npx playwright test tests/visual.spec.ts (比較)
 *
 * Requires: @playwright/test (optional, install if running)
 */

// @ts-nocheck - Playwright は optional dep

let test: any; let expect: any;
try {
  const pw = require('@playwright/test');
  test = pw.test;
  expect = pw.expect;
} catch { /* optional */ }

if (test) {
  const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4321';

  test('home page visual', async ({ page }: any) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveScreenshot('home.png', { fullPage: false, maxDiffPixelRatio: 0.02 });
  });

  test('status page visual', async ({ page }: any) => {
    await page.goto(`${BASE_URL}/status/`);
    await expect(page).toHaveScreenshot('status.png', { fullPage: false, maxDiffPixelRatio: 0.02 });
  });

  test('calendar page visual', async ({ page }: any) => {
    await page.goto(`${BASE_URL}/calendar/`);
    await expect(page).toHaveScreenshot('calendar.png', { fullPage: false, maxDiffPixelRatio: 0.02 });
  });

  test('tags page visual', async ({ page }: any) => {
    await page.goto(`${BASE_URL}/tags/`);
    await expect(page).toHaveScreenshot('tags.png', { fullPage: false, maxDiffPixelRatio: 0.02 });
  });
}
