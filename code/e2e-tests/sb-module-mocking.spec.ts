import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from './util';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';

test.describe('sb-module-mocking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);
    await new SbPage(page, expect).waitUntilLoaded();
  });

  test('ModuleMocking: Original, Mocked', async ({ page }) => {
    const sbPage = new SbPage(page, expect);
    // Original
    await sbPage.navigateToStory('core/test/modulemocking', 'original', 'story', true);
    const root = sbPage.previewRoot();
    await expect(root.getByText(/Function: no value/)).toBeVisible();
    // Mocked
    await sbPage.navigateToStory('core/test/modulemocking', 'mocked', 'story', true);
    await expect(root.getByText(/Function: mocked value/)).toBeVisible();
  });

  test('ModuleAutoMocking: Original', async ({ page }) => {
    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory('core/test/moduleautomocking', 'original', 'story', true);
    const root = sbPage.previewRoot();
    await expect(root.getByText(/Function: automocked value/)).toBeVisible();
  });

  test('ModuleSpyMocking: Original', async ({ page }) => {
    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory('core/test/modulespymocking', 'original', 'story', true);
    const root = sbPage.previewRoot();
    await expect(root.getByText(/Function: original value/)).toBeVisible();
  });

  test('NodeModuleMocking: Original', async ({ page }) => {
    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory('core/test/nodemodulemocking', 'original', 'story', true);
    const root = sbPage.previewRoot();
    await expect(root.getByText(/Lodash Version: 1.0.0-mocked!/)).toBeVisible();
    await expect(root.getByText(/Mocked Add \(1,2\): mocked 3/)).toBeVisible();
    await expect(root.getByText(/Inline Sum \(2,2\): mocked 10/)).toBeVisible();
  });
});
