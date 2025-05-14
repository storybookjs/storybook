import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

// Downloading Firefox 137.0 (playwright build v1482) from https://cdn.playwright.dev/dbazure/download/playwright/builds/firefox/1482/firefox-mac-arm64.zip
// 85 MiB [====================] 100% 0.0s
// Firefox 137.0 (playwright build v1482) downloaded to /Users/me/Library/Caches/ms-playwright/firefox-1482
// Downloading Webkit 18.4 (playwright build v2158) from https://cdn.playwright.dev/dbazure/download/playwright/builds/webkit/2158/webkit-mac-15-arm64.zip
// 66.8 MiB [====================] 100% 0.0s
// Webkit 18.4 (playwright build v2158) downloaded to /Users/me/Library/Caches/ms-playwright/webkit-2158

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./e2e-tests",
  outputDir: "./test-results",
  /* Maximum time one test can run for. */
  timeout: (process.env.CI ? 60 : 30) * 1000,
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
        outputFile: path.join(__dirname, "..", "..", "..", "test-results"),
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
    stdout: "pipe",
    stderr: "pipe",
  },
});
