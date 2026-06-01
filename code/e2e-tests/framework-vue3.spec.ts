import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from './util.ts';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME;

test.describe('Vue 3', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);
    await new SbPage(page, expect).waitUntilLoaded();
  });

  test.skip(templateName !== 'vue3-vite/default-ts', 'Only run these tests on Vue 3');

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

  test('docs preserve unicode prop defaults from vue-component-meta', async ({ page }) => {
    const sbPage = new SbPage(page, expect);
    const docsPages = [
      {
        title: 'stories/renderers/vue3_vue3-vite-default-ts/component-meta/unicode-with-defaults',
        expectedDefaults: [
          ['Greeting', 'こんにちは'],
          ['size', '大きい'],
          ['icon', '🚀'],
        ],
      },
      {
        title: 'stories/renderers/vue3_vue3-vite-default-ts/component-meta/unicode-define-props',
        expectedDefaults: [
          ['Greeting', '你好'],
          ['size', '大きい'],
          ['icon', '✨'],
        ],
      },
    ];

    for (const { title, expectedDefaults } of docsPages) {
      await sbPage.deepLinkToStory(storybookUrl, title, 'docs');

      const argsTable = sbPage.previewRoot().locator('.docblock-argstable');
      await expect(argsTable).toBeVisible();

      for (const [propName, defaultValue] of expectedDefaults) {
        await expect(argsTable.getByRole('row', { name: new RegExp(propName) })).toContainText(
          defaultValue
        );
      }

      await expect(argsTable).not.toContainText('\\u');
    }
  });
});
