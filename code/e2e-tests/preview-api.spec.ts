import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from './util';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME || '';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test.describe('preview-api', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);

    await new SbPage(page, expect).waitUntilLoaded();
  });

  test('should pass over shortcuts, but not from play functions, story', async ({ page }) => {
    test.skip(
      /^(lit)/i.test(`${templateName}`),
      `Skipping ${templateName}, which does not support addon-interactions`
    );

    const sbPage = new SbPage(page, expect);
    await sbPage.deepLinkToStory(storybookUrl, 'core/shortcuts', 'keydown-during-play');
    await expect(sbPage.page.locator('.sidebar-container')).toBeVisible();

    // wait for the play function to complete
    await sbPage.viewAddonPanel('Component tests');
    const interactionsTab = page.locator('#tabbutton-storybook-test-panel');
    await expect(interactionsTab).toBeVisible();
    const panel = sbPage.panelContent();
    const runStatusBadge = panel.locator('[aria-label="Status of the test run"]');
    await expect(runStatusBadge).toContainText(/Pass/);

    // click outside, to remove focus from the input of the story, then press S to toggle sidebar
    await sbPage.previewRoot().click();
    await sbPage.previewRoot().press('Alt+s');
    await expect(sbPage.page.locator('.sidebar-container')).toBeHidden();
  });

  test('should pass over shortcuts, but not from play functions, docs', async ({ page }) => {
    test.skip(
      /^(lit)/i.test(`${templateName}`),
      `Skipping ${templateName}, which does not support addon-interactions`
    );

    const sbPage = new SbPage(page, expect);
    await sbPage.deepLinkToStory(storybookUrl, 'core/shortcuts', 'docs');

    await expect(sbPage.page.locator('.sidebar-container')).toBeVisible();

    await sbPage.previewRoot().getByRole('button').getByText('Submit').first().press('Alt+s');
    await expect(sbPage.page.locator('.sidebar-container')).toBeHidden();
  });

  // if rerenders were interleaved the button would have rendered "Error: Interleaved loaders. Changed arg"
  test('should only render once at a time when rapidly changing args', async ({ page }) => {
    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory('core/rendering', 'slow-loader');

    const root = sbPage.previewRoot();

    const labelControl = sbPage.page.locator('#control-label');

    await expect(root.getByText('Loaded. Click me')).toBeVisible();
    await expect(labelControl).toBeVisible();

    await labelControl.fill('');
    await labelControl.type('Changed arg', { delay: 50 });
    await labelControl.blur();

    await expect(root.getByText('Loaded. Changed arg')).toBeVisible();
  });

  test('should reload plage when remounting while loading', async ({ page }) => {
    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory('core/rendering', 'slow-loader');

    const root = sbPage.previewRoot();

    await expect(root.getByText('Loaded. Click me')).toBeVisible();

    await sbPage.page.getByRole('button', { name: 'Remount component' }).click();
    await wait(200);
    await sbPage.page.getByRole('button', { name: 'Remount component' }).click();

    // the loading spinner indicates the iframe is being fully reloaded
    await expect(sbPage.previewIframe().locator('.sb-preparing-story > .sb-loader')).toBeVisible();
    await expect(root.getByText('Loaded. Click me')).toBeVisible();
  });
});
