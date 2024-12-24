import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from './util';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME || '';

test.describe('addon-actions', () => {
  test('should trigger an action', async ({ page }) => {
    test.skip(
      templateName.includes('svelte') && templateName.includes('prerelease'),
      'Svelte 5 prerelase does not support automatic actions with our current example components yet'
    );
    test.skip(
      templateName.includes('react-native-web'),
      'React Native uses onPress rather than onClick'
    );
    await page.goto(storybookUrl);
    const sbPage = new SbPage(page, expect);
    sbPage.waitUntilLoaded();

    await sbPage.navigateToStory('example/button', 'primary');
    const root = sbPage.previewRoot();
    const button = root.getByRole('button', { name: 'Button' });
    await button.click();

    await sbPage.viewAddonPanel('Actions');
    const logItem = page.locator('#storybook-panel-root #panel-tab-content', {
      hasText: 'click',
    });
    await expect(logItem).toBeVisible();
  });

  test('should show spies', async ({ page }) => {
    test.skip(
      templateName.includes('svelte') && templateName.includes('prerelease'),
      'Svelte 5 prerelase does not support automatic actions with our current example components yet'
    );
    await page.goto(storybookUrl);
    const sbPage = new SbPage(page, expect);
    sbPage.waitUntilLoaded();

    await sbPage.navigateToStory('addons/actions/spies', 'show-spy-on-in-actions');

    const root = sbPage.previewRoot();
    const button = root.getByRole('button', { name: 'Button' });
    await button.click();

    await sbPage.viewAddonPanel('Actions');
    const logItem = page.locator('#storybook-panel-root #panel-tab-content', {
      hasText: 'console.log',
    });
    await expect(logItem).toBeVisible();
  });
});
