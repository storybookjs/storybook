import { defineConfig, devices } from '@playwright/test';
import * as path from 'node:path';

const runDir = process.env.VERIFY_RUN_DIR ?? path.resolve(process.cwd(), '.verify-output/_adhoc');

export default defineConfig({
  testDir: path.resolve(import.meta.dirname, '../../.verify-recipes'),
  outputDir: runDir,
  reporter: [['json', { outputFile: path.join(runDir, 'playwright-report.json') }], ['list']],
  use: {
    baseURL: process.env.STORYBOOK_URL ?? 'http://localhost:6006',
    trace: 'on',
    screenshot: 'on',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
});
