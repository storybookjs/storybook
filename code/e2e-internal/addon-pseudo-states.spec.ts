import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from '../e2e-sandbox/util.ts';
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

  test('preserves native hover and keyboard focus for negated states', async ({ page }) => {
    await page.goto(
      `${storybookUrl}/iframe.html?id=addons-pseudo-states-negation--native&viewMode=story`
    );
    const row = page.locator('.negation-row');
    const icon = page.locator('.negation-icon');
    await page.mouse.move(800, 0);
    await expect(icon).toHaveCSS('visibility', 'hidden');

    await row.hover();
    await expect(icon).toHaveCSS('visibility', 'visible');

    await page.locator('body').click({ position: { x: 800, y: 0 } });
    await expect(icon).toHaveCSS('visibility', 'hidden');
    await page.keyboard.press('Tab');
    await expect(row).toBeFocused();
    await expect(icon).toHaveCSS('visibility', 'visible');
  });

  test('preserves native interactions when forcing is unrelated or elsewhere', async ({ page }) => {
    await page.goto(
      `${storybookUrl}/iframe.html?id=addons-pseudo-states-negation--unrelated-active&viewMode=story`
    );
    const row = page.locator('.negation-row');
    const icon = page.locator('.negation-icon');
    await page.mouse.move(800, 0);
    await expect(page.locator('#storybook-root')).toHaveClass(/pseudo-active-all/);
    await expect(icon).toHaveCSS('visibility', 'hidden');
    await row.hover();
    await expect(icon).toHaveCSS('visibility', 'visible');
    await page.locator('body').click({ position: { x: 800, y: 0 } });
    await expect(icon).toHaveCSS('visibility', 'hidden');
    await page.keyboard.press('Tab');
    await expect(row).toBeFocused();
    await expect(icon).toHaveCSS('visibility', 'visible');

    await page.goto(
      `${storybookUrl}/iframe.html?id=addons-pseudo-states-negation--hover-elsewhere&viewMode=story`
    );
    await page.mouse.move(800, 0);
    await expect(page.locator('.other-target')).toHaveClass(/pseudo-hover/);
    await expect(row).not.toHaveClass(/pseudo-hover/);
    await expect(page.locator('#storybook-root')).not.toHaveClass(/pseudo-hover-all/);
    await expect(icon).toHaveCSS('visibility', 'hidden');
    await row.hover();
    await expect(icon).toHaveCSS('visibility', 'visible');
    await page.locator('body').click({ position: { x: 800, y: 0 } });
    await expect(icon).toHaveCSS('visibility', 'hidden');
    await page.keyboard.press('Tab');
    await expect(row).toBeFocused();
    await expect(icon).toHaveCSS('visibility', 'visible');
    await page.locator('body').click({ position: { x: 800, y: 0 } });
    await expect(icon).toHaveCSS('visibility', 'hidden');
  });

  test('preserves global simulated hover and focus for negated states', async ({ page }) => {
    await page.goto(
      `${storybookUrl}/iframe.html?id=addons-pseudo-states-negation--hover&viewMode=story`
    );
    await page.mouse.move(800, 0);
    await expect(page.locator('#storybook-root')).toHaveClass(/pseudo-hover-all/);
    await expect(page.locator('.negation-icon')).toHaveCSS('visibility', 'visible');

    await page.goto(
      `${storybookUrl}/iframe.html?id=addons-pseudo-states-negation--focus-visible&viewMode=story`
    );
    await expect(page.locator('#storybook-root')).toHaveClass(/pseudo-focus-visible-all/);
    await expect(page.locator('.negation-icon')).toHaveCSS('visibility', 'visible');
  });

  test('preserves targeted simulated hover and focus for negated states', async ({ page }) => {
    await page.goto(
      `${storybookUrl}/iframe.html?id=addons-pseudo-states-negation--targeted-hover&viewMode=story`
    );
    await page.mouse.move(800, 0);
    await expect(page.locator('.negation-row')).toHaveClass(/pseudo-hover/);
    await expect(page.locator('.negation-icon')).toHaveCSS('visibility', 'visible');

    await page.goto(
      `${storybookUrl}/iframe.html?id=addons-pseudo-states-negation--targeted-focus-visible&viewMode=story`
    );
    await expect(page.locator('.negation-row')).toHaveClass(/pseudo-focus-visible/);
    await expect(page.locator('.negation-icon')).toHaveCSS('visibility', 'visible');
  });
});
