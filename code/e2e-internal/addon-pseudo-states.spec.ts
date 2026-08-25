import { expect, test } from '@playwright/test';
import process from 'process';

import { PREVIEW_STORY_TIMEOUT, waitForPreviewReady } from './helpers.ts';

/**
 * E2E regression for issue #32221: the pseudo-states decorator used to wipe globals
 * during the parameter->globals sync whenever a story did not declare its own
 * `parameters.pseudo`, dropping any selection set via URL or toolbar as soon as
 * the user navigated to such a story.
 */

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';

/** A story that does not declare `parameters.pseudo` itself. */
const STORY_A_PATH = '/story/button-component--base';

test.describe('pseudo-states addon', () => {
  test.setTimeout(60_000);

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

    // Navigate via the sidebar so Storybook preserves globals across the URL change.
    const selectGroup = page.locator('#components-select');
    if ((await selectGroup.getAttribute('aria-expanded')) !== 'true') {
      await selectGroup.click();
    }
    await page.locator('#select-component--base').click();
    await page.waitForURL((url) => url.search.includes('select-component--base'));
    await waitForPreviewReady(page);

    // The hover class on the root only appears if the decorator did NOT wipe globals.
    const storyBRoot = page.frameLocator('#storybook-preview-iframe').locator('#storybook-root');
    await expect(storyBRoot).toHaveClass(/pseudo-hover-all/, { timeout: PREVIEW_STORY_TIMEOUT });
  });
});
