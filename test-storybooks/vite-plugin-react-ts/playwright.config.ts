import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-tests',
  outputDir: './test-results',
  timeout: (process.env.CI ? 90 : 45) * 1000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['line'],
    ...(process.env.CI
      ? ([
          [
            'junit',
            {
              embedAnnotationsAsProperties: true,
              outputFile: path.join(import.meta.dirname, 'test-results', 'vite-plugin-e2e.xml'),
            },
          ],
        ] as const)
      : []),
  ],
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'embedded',
      testMatch: /embedded\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5173' },
    },
    {
      name: 'storybook-mode',
      testMatch: /storybook-mode\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5175' },
    },
    {
      name: 'middleware-host',
      testMatch: /middleware-host\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5176' },
    },
  ],
  webServer: {
    command: 'yarn dev --host 127.0.0.1 --port 5173 --strictPort',
    cwd: import.meta.dirname,
    env: { STORYBOOK_DISABLE_TELEMETRY: '1' },
    url: 'http://127.0.0.1:5173/__storybook/index.json',
    reuseExistingServer: false,
  },
});
