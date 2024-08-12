import { expect, test } from '@playwright/test';

import { SbPage } from './util';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';

// This is a slow test, and (presumably) framework independent, so only run it on one sandbox
const skipTest = process.env.STORYBOOK_TEMPLATE_NAME !== 'react-vite/default-ts';

test.describe('composition', () => {
  test.beforeEach(async ({ page }) => {
    if (skipTest) return;
    await page.goto(storybookUrl);
    await new SbPage(page).waitUntilLoaded();
  });

  test('should correctly filter composed stories', async ({ page }) => {
    if (skipTest) return;

    // Expect that composed Storybooks are visible
    await expect(await page.getByTitle('Storybook 8.0.0')).toBeVisible();
    await expect(await page.getByTitle('Storybook 7.6.18')).toBeVisible();

    // Expect composed stories to be available in the sidebar
    await page.locator('[id="storybook\\@8\\.0\\.0_components-badge"]').click();
    await expect(
      await page.locator('[id="storybook\\@8\\.0\\.0_components-badge--default"]')
    ).toBeVisible();

    await page.locator('[id="storybook\\@7\\.6\\.18_components-badge"]').click();
    await expect(
      await page.locator('[id="storybook\\@7\\.6\\.18_components-badge--default"]')
    ).toBeVisible();

    // Expect composed stories `to be available in the search
    await page.getByPlaceholder('Find components').fill('Button');
    await expect(
      await page.getByRole('option', { name: 'Button Storybook 8.0.0 / @blocks / examples' })
    ).toBeVisible();
    await expect(
      await page.getByRole('option', { name: 'Button Storybook 7.6.18 / @blocks / examples' })
    ).toBeVisible();
  });
});
