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

    await sbPage.navigateToStory('core/order-of-hooks', 'order-of-hooks');

    await sbPage.viewAddonPanel('Actions');
    const panel = sbPage.panelContent();
    await expect(panel).toBeVisible();

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

    // Collect all logs in the panel but only check the order of the logs
    // we care about, disregarding any other logs that could appear in between
    const logItemsCount = await panel.locator('li').count();
    const actualTexts = [];
    for (let i = 0; i < logItemsCount; i++) {
      actualTexts.push(await panel.locator(`li >> nth=${i}`).innerText());
    }

    let lastMatchIndex = -1;

    for (const expected of expectedTexts) {
      const foundIndex = actualTexts.findIndex(
        (text, i) => i > lastMatchIndex && text.includes(expected)
      );
      expect(foundIndex, `Expected log "${expected}" to appear in order`).toBeGreaterThan(
        lastMatchIndex
      );
      lastMatchIndex = foundIndex;
    }
  });

  test('should assert that utils import is mocked', async ({ page }) => {
    const sbPage = new SbPage(page, expect);

    await sbPage.navigateToStory('core/moduleMocking', 'basic');

    await sbPage.viewAddonPanel('Actions');
    const logItem = sbPage.panelContent().filter({
      hasText: 'foo: []',
    });
    await expect(logItem).toBeVisible();
  });
});
