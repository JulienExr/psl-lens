import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'pwa-update.spec.ts',
  outputDir: 'test-results-pwa-update',
  timeout: 30000,
  expect: { timeout: 5000 },
  workers: 1,
  reporter: 'list',
  use: { browserName: 'chromium', trace: 'retain-on-failure' },
});
