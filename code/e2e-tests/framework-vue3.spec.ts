import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from './util';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME;

test.describe('Vue 3', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);
    await new SbPage(page, expect).waitUntilLoaded();
  });

  test.skip(!templateName?.includes('vue3'), 'Only run these tests on Vue 3');

  test('updateArgs works in decorators', async ({ page }) => {
    const sbPage = new SbPage(page, expect);

    await sbPage.navigateToStory(
      'stories/renderers/vue3_vue3-vite-default-ts/decorators',
      'update-args'
    );
    const previewRoot = sbPage.previewRoot();
    const button = previewRoot.getByRole('button', { name: 'Add 1' });

    await expect(previewRoot).toContainText('0');
    await button.click();
    await expect(previewRoot).toContainText('1');
    await button.click();
    await expect(previewRoot).toContainText('2');
  });

  test('Decorators can consume reactive globals', async ({ page }) => {
    const sbPage = new SbPage(page, expect);

    await sbPage.navigateToStory(
      'stories/renderers/vue3_vue3-vite-default-ts/decorators',
      'reactive-global-decorator'
    );

    // Check the original language
    await expect(sbPage.previewRoot()).toContainText('Hello');

    // Select spanish in the locale toolbar and check that the text changes
    await sbPage.selectToolbar('[aria-label^="Internationalization locale"]', 'text=/Español/');
    await expect(sbPage.previewRoot()).toContainText('Hola');
  });
});
