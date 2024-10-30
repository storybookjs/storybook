import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from './util';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';

test.describe('addon-toolbars', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);
    await new SbPage(page, expect).waitUntilLoaded();
  });

  test('should have locale button in the toolbar', async ({ page }) => {
    const sbPage = new SbPage(page, expect);

    // Click on viewport button and select spanish
    await sbPage.navigateToStory('addons/toolbars/globals', 'basic');
    await sbPage.selectToolbar('[title="Internationalization locale"]', '#list-item-es');

    // Check that spanish is selected
    await expect(sbPage.previewRoot()).toContainText('Hola');
  });

  test('locale button should be disabled for story that overrides locale global', async ({
    page,
  }) => {
    const sbPage = new SbPage(page, expect);

    // Click on viewport button and select spanish
    await sbPage.navigateToStory('addons/toolbars/globals', 'override-locale');
    await expect(sbPage.previewRoot()).toContainText('안녕하세요');
    const button = sbPage.page.locator('[title="Internationalization locale"]');

    await expect(button).toHaveAttribute('disabled', '');
  });
});
