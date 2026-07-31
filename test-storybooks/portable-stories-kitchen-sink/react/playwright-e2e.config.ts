import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./e2e-tests",
  outputDir: "./test-results",
  /* Maximum time one test can run for. It caps the sum of a test's own waits, so it has to
   * clear the longest chain any test declares - today 90s in component-testing.spec.ts, which
   * waits up to 30s for a story to render and then up to 60s for its test results. At 60s
   * those tests could time out while still making progress, which is how the coverage case
   * kept flaking. Passing runs are unaffected; Playwright only spends what a test needs. */
  timeout: (process.env.CI ? 120 : 30) * 1000,
  /* Run tests in files in parallel */
  fullyParallel: false,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  retries: 0,
  /* Run tests serially to avoid side effects */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ["line"],
    [
      "junit",
      {
        embedAnnotationsAsProperties: true,
        outputFile: path.join(__dirname, "..", "..", "..", "test-results", "react-e2e-ui.xml"),
      },
    ],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "retain-on-failure",
    // video: "retain-on-failure",
    // headless: false,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  webServer: {
    command: "yarn storybook",
    url: "http://127.0.0.1:6006",
    reuseExistingServer: true,
  },
});
