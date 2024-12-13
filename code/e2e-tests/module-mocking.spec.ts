import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from './util';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';

test.describe('module-mocking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);

    await new SbPage(page, expect).waitUntilLoaded();
  });

  test('should assert story lifecycle order', async ({ page }) => {
    const sbPage = new SbPage(page, expect);

    await sbPage.navigateToStory('lib/test/order-of-hooks', 'order-of-hooks');

    await sbPage.viewAddonPanel('Actions');
    const logItem = page.locator('#storybook-panel-root #panel-tab-content');
    await expect(logItem).toBeVisible();

    const expectedTexts = [
      '1 - [from loaders]',
      '2 - [from meta beforeEach]',
      '3 - [from story beforeEach]',
      '4 - [before mount]',
      '5 - [from decorator]',
      '6 - [after mount]',
      '7 - [from onClick]',
      '8 - [from story afterEach]',
      '9 - [from meta afterEach]',
    ];

    // Assert that each LI text content contains the expected text in order
    for (let i = 0; i < expectedTexts.length; i++) {
      const nthText = await logItem.locator(`li >> nth=${i}`).innerText();
      expect(nthText).toMatch(expectedTexts[i]);
    }
  });

  test('should assert that utils import is mocked', async ({ page }) => {
    const sbPage = new SbPage(page, expect);

    await sbPage.navigateToStory('lib/test/module-mocking', 'basic');

    await sbPage.viewAddonPanel('Actions');
    const logItem = page.locator('#storybook-panel-root #panel-tab-content', {
      hasText: 'foo: []',
    });
    await expect(logItem).toBeVisible();
  });
});
