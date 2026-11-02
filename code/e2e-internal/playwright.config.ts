import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for internal Storybook UI e2e (`code/.storybook`).
 * Sandbox e2e uses `code/playwright.config.ts` and `code/e2e-sandbox/`.
 */

// These specs edit source files or push the dev server through a full docgen extraction, which
// can reload or starve another test's page, so they run alone after the parallel pass.
const SERIAL_SPECS = /(docgen-hot-update|story-docs|tools-attach)\.spec\.ts/;

export default defineConfig({
  testDir: '.',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? Number(process.env.PLAYWRIGHT_WORKERS || 2) : undefined,
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
  projects: [
    {
      name: 'chromium',
      testIgnore: SERIAL_SPECS,
    },
    {
      name: 'chromium-serial',
      testMatch: SERIAL_SPECS,
      dependencies: ['chromium'],
      fullyParallel: false,
      workers: 1,
    },
  ],
});
