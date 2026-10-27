import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from './util.ts';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME;

const providerTitle = 'stories/frameworks/angular-vite/core/provider/provider-with-module-wrapper';
const routerTitle = 'stories/frameworks/angular-vite/router';

test.describe('Angular Vite', () => {
  test.skip(
    !templateName?.startsWith('angular-vite/'),
    'Only run these tests on the Angular Vite templates'
  );

  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);
    await new SbPage(page, expect).waitUntilLoaded();
  });

  test('renders a story after a docs page without reloading the preview', async ({ page }) => {
    const sbPage = new SbPage(page, expect);

    await sbPage.navigateToStory(providerTitle, 'docs', 'docs');
    await expect(sbPage.previewRoot()).toContainText('Provider Test Without Args');

    await sbPage.navigateToStory(providerTitle, 'provider-test-with-args');
    await expect(sbPage.previewRoot()).toContainText('Test');

    await sbPage.navigateToStory(routerTitle, 'provide-router-without-args');
    await expect(sbPage.previewRoot()).toContainText('Route');

    await sbPage.navigateToStory(providerTitle, 'docs', 'docs');
    await expect(sbPage.previewRoot()).toContainText('Provider Test Without Args');

    await sbPage.navigateToStory(providerTitle, 'provider-test-without-args');
    await expect(sbPage.previewRoot()).toContainText('original Api Service');
  });
});
