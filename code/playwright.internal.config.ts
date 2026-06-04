import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for internal Storybook UI e2e (`code/e2e-internal`).
 * Sandbox e2e uses `playwright.config.ts` and `code/e2e-sandbox/`.
 */
export default defineConfig({
  testDir: './e2e-internal',
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
    actionTimeout: 0,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'internal-storybook',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  outputDir: 'playwright-results/',
});
