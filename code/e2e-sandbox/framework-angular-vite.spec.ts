import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'process';

import { SbPage } from './util.ts';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME;
const sandboxDir = process.env.STORYBOOK_SANDBOX_DIR || '';
const type = process.env.STORYBOOK_TYPE || 'dev';

const providerTitle = 'stories/frameworks/angular-vite/core/provider/provider-with-module-wrapper';
const routerTitle = 'stories/frameworks/angular-vite/router';

test.describe('Angular Vite', () => {
  // The HMR test edits a file on the shared dev server, which would interrupt the other tests.
  test.describe.configure({ mode: 'serial' });

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
    await expect(sbPage.previewRoot()).toContainText(/Mock Service|original Api Service/);
  });

  test('lets moduleMetadata.providers override a component provider only under the TestBed renderer', async ({
    page,
  }) => {
    const sbPage = new SbPage(page, expect);

    await sbPage.navigateToStory(providerTitle, 'provider-test-without-args');
    const previewFrame = page.frame({ name: 'storybook-preview-iframe' });
    const testBedRenderer = await previewFrame?.evaluate(
      () =>
        (globalThis as { FEATURES?: { previewTestBedRenderer?: boolean } }).FEATURES
          ?.previewTestBedRenderer === true
    );

    await expect(sbPage.previewRoot()).toContainText(
      testBedRenderer ? 'Mock Service' : 'original Api Service'
    );
  });

  test('scopes a module declared by a story file opened after another story', async ({ page }) => {
    const sbPage = new SbPage(page, expect);

    await sbPage.navigateToStory('example/button', 'primary');
    await expect(sbPage.previewRoot()).toContainText('Button');

    await sbPage.navigateToStory(
      'stories/frameworks/angular-vite/core/module-scope/lazy-scope',
      'renders-after-another-story'
    );
    await expect(sbPage.previewRoot()).toContainText('Scoped through the NgModule');
  });

  test('hot-updates a component template without an Angular component-id collision', async ({
    page,
  }) => {
    test.skip(!sandboxDir, 'Set STORYBOOK_SANDBOX_DIR to run the HMR test');
    test.skip(type !== 'dev', 'HMR only exists in dev mode');

    const componentPath = path.join(sandboxDir, 'src/stories/button.component.ts');
    const original = fs.readFileSync(componentPath, 'utf-8');
    const consoleMessages: string[] = [];
    page.on('console', (message) => consoleMessages.push(message.text()));

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory('example/button', 'primary');
    await expect(sbPage.previewRoot()).toContainText('Button');

    try {
      fs.writeFileSync(componentPath, original.replace('{{ label }}', 'HMR {{ label }}'));
      await expect(sbPage.previewRoot()).toContainText('HMR Button', { timeout: 15000 });
    } finally {
      fs.writeFileSync(componentPath, original);
    }

    expect(consoleMessages.filter((text) => text.includes('NG0912'))).toStrictEqual([]);
  });
});
