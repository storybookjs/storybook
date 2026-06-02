import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from './util.ts';

/**
 * E2E regression for the open-service background demo (`code/.storybook/background-service`).
 *
 * Validates the reload bootstrap path (registration-order race): preview must converge via
 * manager postMessage — welcome retries, buffered patch flush, and iframe gating — not only
 * dev-server websocket.
 *
 * Run (from `code/`):
 *   yarn nx compile core && yarn storybook:ui          # terminal 1
 *   yarn playwright test --project=open-service-internal  # terminal 2
 *
 * Or let Playwright start Storybook (CI): `CI=1 yarn playwright test --project=open-service-internal`
 */

/** Internal Storybook UI (`code/.storybook`) — not a sandbox template. */
const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';

const STORY_PATH = '/story/core-basics--basic';

const DARK_BG = 'rgb(27, 28, 29)'; // #1B1C1D
const ACTIVE_SWATCH_BORDER = 'rgb(30, 167, 253)'; // #1ea7fd

async function previewBodyBackground(page: import('@playwright/test').Page): Promise<string> {
  const sbPage = new SbPage(page, expect);
  return sbPage.getCanvasBodyElement().evaluate((el) => getComputedStyle(el).backgroundColor);
}

test.describe('open-service background example', () => {
  test.setTimeout(60_000);

  test('preview canvas keeps the dark background after a full page reload', async ({ page }) => {
    await page.goto(`${storybookUrl}/?path=${STORY_PATH}`);
    await page.waitForSelector('#storybook-preview-iframe');
    await page.waitForTimeout(5_000);

    const darkSwatch = page.getByRole('toolbar').getByRole('button', { name: 'Dark', exact: true });

    await expect(darkSwatch).toBeVisible();
    await darkSwatch.click();

    await expect
      .poll(() => previewBodyBackground(page), {
        message: 'preview should follow the manager dark selection before reload',
        timeout: 15_000,
      })
      .toBe(DARK_BG);

    await page.reload();
    await page.waitForSelector('#storybook-preview-iframe');
    await page.waitForTimeout(5_000);

    // Manager bootstraps from the dev-server's persisted state (still dark).
    await expect(darkSwatch).toHaveCSS('border-color', ACTIVE_SWATCH_BORDER);

    // Known bug regression: preview must keep dark background after reload (manager + server stay dark).
    await expect
      .poll(() => previewBodyBackground(page), {
        message: 'preview should still be dark after reload (matches manager + server)',
        timeout: 15_000,
      })
      .toBe(DARK_BG);
  });
});
