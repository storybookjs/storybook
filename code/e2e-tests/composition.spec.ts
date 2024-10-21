import { expect, test } from '@playwright/test';

import { SbPage } from './util';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME || '';

test.describe('composition', () => {
  test.skip(
    templateName !== 'react-vite/default-ts',
    'Slow, framework independent test, so only run it on in react-vite/default-ts'
  );

  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);
    await new SbPage(page, expect).waitUntilLoaded();
  });

  test('should correctly filter composed stories', async ({ page }) => {
    // Expect that composed Storybooks are visible
    await expect(page.getByTitle('Storybook 8.0.0')).toBeVisible();
    await expect(page.getByTitle('Storybook 7.6.18')).toBeVisible();

    // Expect composed stories to be available in the sidebar
    await page.locator('[id="storybook\\@8\\.0\\.0_components-badge"]').click();
    await expect(
      page.locator('[id="storybook\\@8\\.0\\.0_components-badge--default"]')
    ).toBeVisible();

    await page.locator('[id="storybook\\@7\\.6\\.18_components-badge"]').click();
    await expect(
      page.locator('[id="storybook\\@7\\.6\\.18_components-badge--default"]')
    ).toBeVisible();

    // Expect composed stories `to be available in the search
    await page.getByPlaceholder('Find components').fill('Button');
    await expect(
      page.getByRole('option', { name: 'Button Storybook 8.0.0 / @blocks / examples' })
    ).toBeVisible();
    await expect(
      page.getByRole('option', { name: 'Button Storybook 7.6.18 / @blocks / examples' })
    ).toBeVisible();
  });
});
