import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-tests',
  outputDir: './test-results',
  timeout: (process.env.CI ? 60 : 30) * 1000,
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
              outputFile: path.join(__dirname, '..', '..', 'test-results', 'vite-plugin-e2e.xml'),
            },
          ],
        ] as const)
      : []),
  ],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'yarn dev --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
});
