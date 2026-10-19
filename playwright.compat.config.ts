import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'compat.spec.ts',
  outputDir: 'test-results-compat',
  timeout: 90000,
  expect: { timeout: 60000 },
  reporter: 'list',
  projects: [
    {
      name: 'firefox',
      use: {
        browserName: 'firefox',
        // GPU-less CI runners can block WebGL2 before trying Mesa software GL.
        // Test the real renderer; never replace inference or change app checks.
        launchOptions: process.env.CI ? { firefoxUserPrefs: { 'webgl.force-enabled': true } } : {},
      },
    },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
