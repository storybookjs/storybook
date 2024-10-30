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

    await sbPage.navigateToStory('lib/test/before-each', 'before-each-order');

    await sbPage.viewAddonPanel('Actions');
    const logItem = page.locator('#storybook-panel-root #panel-tab-content');
    await expect(logItem).toBeVisible();

    const expectedTexts = [
      '1 - [from loaders]',
      '2 - [from meta beforeEach]',
      '3 - [from story beforeEach]',
      '4 - [from decorator]',
      '5 - [from onClick]',
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
