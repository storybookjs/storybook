/* eslint-disable no-underscore-dangle */
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import { test } from '@playwright/test';

import { SbPage } from './util';

declare global {
  interface Window {
    __STORYBOOK_BEFORE_ALL_CALLS__: number;
    __STORYBOOK_BEFORE_ALL_CLEANUP_CALLS__: number;
  }
}

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME || '';
const sandboxDir =
  process.env.STORYBOOK_SANDBOX_DIR ||
  join(__dirname, '..', '..', 'sandbox', 'react-vite-default-ts');
const previewFilePath = join(sandboxDir, '.storybook', 'preview.ts');
const isStorybookDev = process.env.STORYBOOK_TYPE === 'dev';

test.describe('Storybook hooks', () => {
  test.skip(); // TODO remove
  test.skip(
    !templateName?.includes('react-vite/default-ts'),
    'Only run this test for react-vite sandbox'
  );
  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);
    await new SbPage(page).waitUntilLoaded();
  });

  test('should call beforeAll upon loading Storybook', async ({ page }, { titlePath }) => {
    const sbPage = new SbPage(page);

    await sbPage.navigateToStory('example/button', 'primary');

    await page.waitForFunction(
      () =>
        window.__STORYBOOK_BEFORE_ALL_CALLS__ === 1 &&
        window.__STORYBOOK_BEFORE_ALL_CLEANUP_CALLS__ === 0,
      undefined,
      { timeout: 2000 }
    );
  });

  test('should call beforeAll and cleanup on HMR', async ({ page }, { titlePath }) => {
    test.skip(!isStorybookDev, 'HMR is only applicable in dev mode');
    const sbPage = new SbPage(page);

    await sbPage.navigateToStory('example/button', 'primary');

    const originalContent = await fs.readFile(previewFilePath, 'utf8');
    const newContent = `${originalContent}\nconsole.log('Written from E2E test: ${titlePath}');`;

    await page.waitForFunction(
      () =>
        window.__STORYBOOK_BEFORE_ALL_CALLS__ === 1 &&
        window.__STORYBOOK_BEFORE_ALL_CLEANUP_CALLS__ === 0,
      undefined,
      { timeout: 2000 }
    );

    // Save the file to trigger HMR, then wait for it
    await fs.writeFile(previewFilePath, newContent);

    await page.waitForFunction(
      () =>
        window.__STORYBOOK_BEFORE_ALL_CALLS__ === 2 &&
        window.__STORYBOOK_BEFORE_ALL_CLEANUP_CALLS__ === 1,
      undefined,
      { timeout: 2000 }
    );

    // Restore the original content of the preview file
    await fs.writeFile(previewFilePath, originalContent);
  });
});
