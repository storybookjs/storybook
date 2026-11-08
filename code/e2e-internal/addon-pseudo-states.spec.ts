import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from '../e2e-sandbox/util.ts';
import { PREVIEW_STORY_TIMEOUT, waitForPreviewReady } from './helpers.ts';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';

/** A story that does not declare `parameters.pseudo` itself. */
const STORY_A_PATH = '/story/button-component--base';
const NEGATION_STORY_PATH = '/story/addons-pseudo-states-negationrow--default';

test.describe('pseudo-states addon', () => {
  test.setTimeout(60_000);

  /**
   * E2E regression for issue #32221: the pseudo-states decorator used to wipe globals
   * during the parameter->globals sync whenever a story did not declare its own
   * `parameters.pseudo`, dropping any selection set via URL or toolbar as soon as
   * the user navigated to such a story.
   */
  test('preserves toolbar selection across navigation between unrelated stories', async ({
    page,
  }) => {
    await page.goto(`${storybookUrl}/?path=${STORY_A_PATH}`);
    await waitForPreviewReady(page);

    const toolbarTrigger = page.getByRole('button', { name: 'CSS pseudo states' });
    await toolbarTrigger.click();
    await page.getByRole('option', { name: ':hover' }).click();
    // Click the toolbar heading to dismiss the listbox before navigating.
    await page.getByRole('heading', { name: 'Toolbar' }).click({ force: true });

    const storyARoot = page.frameLocator('#storybook-preview-iframe').locator('#storybook-root');
    await expect(storyARoot).toHaveClass(/pseudo-hover-all/, { timeout: PREVIEW_STORY_TIMEOUT });

    // Navigate via the sidebar so Storybook preserves globals across the URL change. The tree is
    // virtualized, so the rows are scrolled into existence first.
    const sbPage = new SbPage(page, expect);
    const selectGroup = await sbPage.revealSidebarRow('components-select');
    if ((await selectGroup.getAttribute('aria-expanded')) !== 'true') {
      await selectGroup.click();
    }
    await (await sbPage.revealSidebarRow('select-component--base')).click();
    await page.waitForURL((url) => url.search.includes('select-component--base'));
    await waitForPreviewReady(page);

    // The hover class on the root only appears if the decorator did NOT wipe globals.
    const storyBRoot = page.frameLocator('#storybook-preview-iframe').locator('#storybook-root');
    await expect(storyBRoot).toHaveClass(/pseudo-hover-all/, { timeout: PREVIEW_STORY_TIMEOUT });
  });

  test('keeps native and forced hover working in negated selectors', async ({ page }) => {
    await page.goto(`${storybookUrl}/?path=${NEGATION_STORY_PATH}`);
    await waitForPreviewReady(page);

    const preview = page.frameLocator('#storybook-preview-iframe');
    const icon = preview.locator('.negation-row-icon');
    await expect(icon).toBeHidden({ timeout: PREVIEW_STORY_TIMEOUT });

    await preview.locator('.negation-row').hover();
    await expect(icon).toBeVisible();

    await page.mouse.move(0, 0);
    await expect(icon).toBeHidden();

    await page.getByRole('button', { name: 'CSS pseudo states' }).click();
    const hoverOption = page.getByRole('option', { name: ':hover' });
    await hoverOption.click();
    await expect(icon).toBeVisible();

    await hoverOption.click();
    await expect(icon).toBeHidden();
  });
});
