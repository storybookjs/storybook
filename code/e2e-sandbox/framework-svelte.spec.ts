import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from './util.ts';

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
    await expect(sourceCode).toHaveText(
      "<script>\n  import Button from './Button.svelte';\n</script>\n\n<Button />"
    );
  });

  test.describe('SvelteKit', () => {
    test.skip(!templateName?.includes('svelte-kit'), 'Only run this test on SvelteKit');

    test('Links are logged in Actions panel', async ({ page }) => {
      const sbPage = new SbPage(page, expect);

      await sbPage.navigateToStory('stories/frameworks/sveltekit/modules/hrefs', 'links');
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

      await sbPage.navigateToStory('stories/frameworks/sveltekit/modules/navigation', 'goto');
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
        hasText: `$app/navigation::invalidateAll`,
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

    test('a docs page fails when its inline stories set the mocks', async ({ page }) => {
      const sbPage = new SbPage(page, expect);

      await sbPage.navigateToStory(
        'stories/frameworks/sveltekit/modules/docs-page-shared-mocks',
        'docs'
      );
      const root = sbPage.previewRoot();

      await expect(
        root.getByText('SvelteKitMocksSharedOnDocsPageError', { exact: false }).first()
      ).toBeVisible();
      await expect(root.getByText('Welcome, Ada')).toHaveCount(0);
    });

    test('a docs page renders stories that set the mocks in iframes', async ({ page }) => {
      const sbPage = new SbPage(page, expect);

      await sbPage.navigateToStory(
        'stories/frameworks/sveltekit/modules/docs-page-isolated-mocks',
        'docs'
      );
      // The first story also renders as the primary story, so take the first of its iframes
      const storyFrame = (name: string) =>
        sbPage
          .previewIframe()
          .frameLocator(
            `#iframe--stories-frameworks-sveltekit-modules-docs-page-isolated-mocks--${name}`
          )
          .first();

      await expect(storyFrame('logged-out').getByText('Please log in')).toBeVisible();
      await expect(storyFrame('logged-in').getByText('Welcome, Ada')).toBeVisible();
    });
  });
});
