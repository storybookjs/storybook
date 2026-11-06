import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for internal Storybook UI e2e (`code/.storybook`).
 * Sandbox e2e uses `code/playwright.config.ts` and `code/e2e-sandbox/`.
 */

// Tests that cannot share the dev server with another worker's page: these specs edit source
// files or push the server through a full docgen extraction, which can reload or starve other
// pages, and the websocket-route tests drop or hold frames to prove a repair, which any other
// page's sync request would short-circuit with a broadcast snapshot. Matched against the full
// title path, so a file name or a describe title both work.
const SERIAL_TESTS =
  /(docgen-hot-update|story-docs|tools-attach)\.spec\.ts|two-tab writes under a websocket route/;

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
      grepInvert: SERIAL_TESTS,
    },
    {
      name: 'chromium-serial',
      grep: SERIAL_TESTS,
      dependencies: ['chromium'],
      fullyParallel: false,
      workers: 1,
    },
  ],
});
