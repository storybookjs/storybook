import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from './util';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME;

test.describe('Svelte', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);
    await new SbPage(page, expect).waitUntilLoaded();
  });

  test.skip(!templateName?.includes('svelte'), 'Only run these tests on Svelte');

  test('Decorators are excluded from generated source code', async ({ page }) => {
    const sbPage = new SbPage(page, expect);

    await sbPage.navigateToStory('stories/renderers/svelte/decorators', 'docs');
    const root = sbPage.previewRoot();
    const showCodeButton = (await root.locator('button', { hasText: 'Show Code' }).all())[0];
    await showCodeButton.click();
    const sourceCode = root.locator('pre.prismjs');
    const expectedSource = '<Button />';
    await expect(sourceCode).toHaveText(expectedSource);
  });

  test.describe('SvelteKit', () => {
    test.skip(!templateName?.includes('svelte-kit'), 'Only run this test on SvelteKit');

    test('Links are logged in Actions panel', async ({ page }) => {
      const sbPage = new SbPage(page, expect);

      await sbPage.navigateToStory('stories/frameworks/sveltekit/modules/hrefs', 'default-actions');
      const root = sbPage.previewRoot();
      const link = root.locator('a', { hasText: 'Link to /basic-href' });
      await link.click();

      await sbPage.viewAddonPanel('Actions');
      const basicLogItem = page.locator('#storybook-panel-root [role="tabpanel"]', {
        hasText: `/basic-href`,
      });

      await expect(basicLogItem).toBeVisible();
      const complexLogItem = page.locator('#storybook-panel-root [role="tabpanel"]', {
        hasText: `/deep/nested`,
      });
      await expect(complexLogItem).toBeVisible();
    });

    test('goto are logged in Actions panel', async ({ page }) => {
      const sbPage = new SbPage(page, expect);

      await sbPage.navigateToStory(
        'stories/frameworks/sveltekit/modules/navigation',
        'default-actions'
      );
      const root = sbPage.previewRoot();
      await sbPage.viewAddonPanel('Actions');

      const goto = root.locator('button', { hasText: 'goto' });
      await goto.click();

      const gotoLogItem = page.locator('#storybook-panel-root [role="tabpanel"]', {
        hasText: `/storybook-goto`,
      });
      await expect(gotoLogItem).toBeVisible();

      const invalidate = root.getByRole('button', { name: 'invalidate', exact: true });
      await invalidate.click();

      const invalidateLogItem = page.locator('#storybook-panel-root [role="tabpanel"]', {
        hasText: `/storybook-invalidate`,
      });
      await expect(invalidateLogItem).toBeVisible();

      const invalidateAll = root.getByRole('button', { name: 'invalidateAll' });
      await invalidateAll.click();

      const invalidateAllLogItem = page.locator('#storybook-panel-root [role="tabpanel"]', {
        hasText: `"invalidateAll"`,
      });
      await expect(invalidateAllLogItem).toBeVisible();

      const replaceState = root.getByRole('button', { name: 'replaceState' });
      await replaceState.click();

      const replaceStateLogItem = page.locator('#storybook-panel-root [role="tabpanel"]', {
        hasText: `/storybook-replace-state`,
      });
      await expect(replaceStateLogItem).toBeVisible();

      const pushState = root.getByRole('button', { name: 'pushState' });
      await pushState.click();

      const pushStateLogItem = page.locator('#storybook-panel-root [role="tabpanel"]', {
        hasText: `/storybook-push-state`,
      });
      await expect(pushStateLogItem).toBeVisible();
    });
  });
});
