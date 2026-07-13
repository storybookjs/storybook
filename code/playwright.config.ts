import { defineConfig, devices } from '@playwright/test';

/** Read environment variables from file. https://github.com/motdotla/dotenv */
// require('dotenv').config();

// Comment this out and fill in the values to run E2E tests locally using the Playwright extension easily
// process.env.STORYBOOK_URL = 'http://localhost:6006';
// process.env.STORYBOOK_TEMPLATE_NAME = 'react-vite/default-ts';

/** Specs that mutate sandbox files; they must not run alongside other specs. */
const MUTATING_SPECS = /change-detection\.spec\.ts/;

/** See https://playwright.dev/docs/test-configuration. */
export default defineConfig({
  testDir: './e2e-sandbox',
  /* Maximum time one test can run for. */
  timeout: 30 * 1000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met. For example in `await
     * expect(locator).toHaveText();`
     */
    timeout: 5000,
  },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /*
   * Parallel workers on CI: the specs are independent (each test drives its own
   * page against the shared Storybook server), except for specs that mutate
   * sandbox files — those are quarantined in the serial `chromium-mutating`
   * project below. PLAYWRIGHT_WORKERS lets each CI job match its executor size.
   */
  workers: process.env.CI ? Number(process.env.PLAYWRIGHT_WORKERS || 2) : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
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
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 0,
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      // Playwright recommends project dependencies over globalSetup when setup needs runner features
      // like fixtures, traces, and retries:
      // https://playwright.dev/docs/test-global-setup-teardown
      name: 'setup',
      testDir: './e2e-sandbox',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      testIgnore: [/.*\.setup\.ts/, MUTATING_SPECS],
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['clipboard-read', 'clipboard-write'],
      },
    },
    {
      // Specs that write to the sandbox's source files trigger dev-server
      // invalidations (HMR, index refresh) that can reload other tests' pages
      // mid-assertion. They run serially, after the parallel pass - ordered by
      // the task runner via two sequential invocations (see
      // scripts/tasks/e2e-tests-build.ts), NOT via a dependency on 'chromium':
      // Playwright runs dependency projects unfiltered, which made CI shards
      // whose file subset contained a mutating spec re-run the entire
      // chromium suite.
      name: 'chromium-mutating',
      testMatch: MUTATING_SPECS,
      dependencies: ['setup'],
      fullyParallel: false,
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['clipboard-read', 'clipboard-write'],
      },
    },

    // {
    //   name: 'firefox',
    //   use: {
    //     ...devices['Desktop Firefox'],
    //   },
    // },

    // {
    //   name: 'webkit',
    //   use: {
    //     ...devices['Desktop Safari'],
    //   },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: {
    //     ...devices['Pixel 5'],
    //   },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: {
    //     ...devices['iPhone 12'],
    //   },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: {
    //     channel: 'msedge',
    //   },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: {
    //     channel: 'chrome',
    //   },
    // },
  ],

  /* Folder for test artifacts such as screenshots, videos, traces, etc. */
  outputDir: 'playwright-results/',

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   port: 3000,
  // },
});
