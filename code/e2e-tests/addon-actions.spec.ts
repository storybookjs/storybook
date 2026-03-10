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
    await sbPage.viewAddonPanel('Actions');

    const button = root.getByRole('button');
    await expect(button).toBeVisible();
    await button.click();

    const logItem = sbPage.panelContent().locator('span', {
      hasText: 'onClick:',
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

    await sbPage.navigateToStory('core/spies', 'show-spy-on-in-actions');

    const root = sbPage.previewRoot();
    await sbPage.viewAddonPanel('Actions');

    const button = root.getByRole('button');
    await expect(button).toBeVisible();
    await button.click();

    const logItem = sbPage.panelContent().locator('span', {
      hasText: 'console.log:',
    });
    // Avoid getting failed due to other console.log calls by frameworks
    await expect(logItem.getByText('first')).toBeVisible();
    await expect(logItem.getByText('second')).toBeVisible();
    await expect(logItem.getByText('third')).toBeVisible();
  });
});
