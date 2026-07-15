import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from '../e2e-sandbox/util.ts';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';

test.describe('navigating', () => {
  test('a URL with a partial storyId will redirect to the first story', async ({ page }) => {
    // this is purposefully not using the SbPage class, and the URL is a partial (it does not contain the full storyId)
    await page.goto(`${storybookUrl}?path=/story/example-button`);

    const sbPage = new SbPage(page, expect);

    await sbPage.waitUntilLoaded();

    await page.waitForFunction(() =>
      window.document.location.href.match('/docs/example-button--docs')
    );

    expect(sbPage.page.url()).toContain('/docs/example-button--docs');
  });

  test('searching for "typography" surfaces the brand typography docs entry', async ({ page }) => {
    await page.goto(storybookUrl);

    const searchField = page.locator('#storybook-explorer-searchfield');
    await expect(searchField).toBeVisible();
    await searchField.fill('typography');

    await expect(page.locator('[data-id="brand-typography--docs"]')).toBeVisible();
    await expect(page.locator('[data-id="brand-typography"]')).toBeHidden();
  });
});
