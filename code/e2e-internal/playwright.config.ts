import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for internal Storybook UI e2e (`code/.storybook`).
 * Sandbox e2e uses `code/playwright.config.ts` and `code/e2e-sandbox/`.
 */
export default defineConfig({
  testDir: '.',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.PLAYWRIGHT_JUNIT_OUTPUT_NAME
    ? [
        [
          'junit',
          {
            embedAnnotationsAsProperties: true,
            outputFile: process.env.PLAYWRIGHT_JUNIT_OUTPUT_NAME,
          },
        ],
      ]
    : 'html',
  use: {
    ...devices['Desktop Chrome'],
    actionTimeout: 0,
    trace: 'retain-on-failure',
  },
  outputDir: '../playwright-results/',
});
