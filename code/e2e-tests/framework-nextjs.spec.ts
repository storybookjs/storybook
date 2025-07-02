import type { Locator } from '@playwright/test';
import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from './util';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME;

test.describe('Next.js', () => {
  // TODO: improve these E2E tests given that we have more version of Next.js to test
  // and this only tests nextjs/default-js
  test.skip(
    !templateName?.includes('nextjs/default-ts'),
    'Only run this test for the Frameworks that support next/navigation'
  );

  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);
    await new SbPage(page, expect).waitUntilLoaded();
  });

  test.describe('next/image', () => {
    let sbPage: SbPage;

    test.beforeEach(async ({ page }) => {
      sbPage = new SbPage(page, expect);
    });

    // eslint-disable-next-line playwright/no-skipped-test -- test is flaky, investigate why
    test.skip('should lazy load images by default', async () => {
      await sbPage.navigateToStory('stories/frameworks/nextjs/Image', 'lazy');

      const img = sbPage.previewRoot().locator('img');

      expect(await img.evaluate<boolean, HTMLImageElement>((image) => image.complete)).toBeFalsy();
    });

    // eslint-disable-next-line playwright/no-skipped-test -- test is flaky, investigate why
    test.skip('should eager load images when loading parameter is set to eager', async () => {
      await sbPage.navigateToStory('stories/frameworks/nextjs/Image', 'eager');

      const img = sbPage.previewRoot().locator('img');

      expect(await img.evaluate<boolean, HTMLImageElement>((image) => image.complete)).toBeTruthy();
    });
  });

  test.describe('next/navigation', () => {
    let root: Locator;
    let sbPage: SbPage;

    test.beforeEach(async ({ page }) => {
      sbPage = new SbPage(page, expect);

      await sbPage.navigateToStory('stories/frameworks/nextjs/Navigation', 'default');
      root = sbPage.previewRoot();
    });

    function testRoutingBehaviour(buttonText: string, action: string) {
      test(`should trigger ${action} action`, async ({ page }) => {
        const button = root.locator('button', { hasText: buttonText });
        await button.click();

        await sbPage.viewAddonPanel('Actions');
        const logItem = page.locator('#storybook-panel-root #panel-tab-content', {
          hasText: `useRouter().${action}`,
        });
        await expect(logItem).toBeVisible();
      });
    }

    testRoutingBehaviour('Go back', 'back');
    testRoutingBehaviour('Go forward', 'forward');
    testRoutingBehaviour('Prefetch', 'prefetch');
    testRoutingBehaviour('Push HTML', 'push');
    testRoutingBehaviour('Refresh', 'refresh');
    testRoutingBehaviour('Replace', 'replace');
  });

  test.describe('next/router', () => {
    let root: Locator;
    let sbPage: SbPage;

    test.beforeEach(async ({ page }) => {
      sbPage = new SbPage(page, expect);

      await sbPage.navigateToStory('stories/frameworks/nextjs/Router', 'default');
      root = sbPage.previewRoot();
    });

    function testRoutingBehaviour(buttonText: string, action: string) {
      test(`should trigger ${action} action`, async ({ page }) => {
        const button = root.locator('button', { hasText: buttonText });
        await button.click();

        await sbPage.viewAddonPanel('Actions');
        const logItem = page.locator('#storybook-panel-root #panel-tab-content', {
          hasText: `useRouter().${action}`,
        });
        await expect(logItem).toBeVisible();
      });
    }

    testRoutingBehaviour('Go back', 'back');
    testRoutingBehaviour('Go forward', 'forward');
    testRoutingBehaviour('Prefetch', 'prefetch');
    testRoutingBehaviour('Push HTML', 'push');
    testRoutingBehaviour('Replace', 'replace');
  });
});
