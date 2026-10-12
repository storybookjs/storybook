import { expect, test } from '@playwright/test';
import process from 'process';

import { PREVIEW_STORY_TIMEOUT, waitForPreviewReady } from './helpers.ts';

/**
 * Smoke tests for the internal Storybook UI (`code/.storybook`), not sandbox templates.
 *
 * Run locally (from repo root) with internal Storybook on port 6006:
 *   cd code && yarn storybook:ui
 *   yarn task e2e-tests-internal --no-link -s e2e-tests-internal
 *   # or: yarn playwright test -c e2e-internal/playwright.config.ts
 */

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';
const runsAgainstDevServer = !['build', 'static'].includes(process.env.STORYBOOK_TYPE || 'dev');

/** Stable core template story shipped with the internal UI. */
const STORY_PATH = '/story/core-basics--basic';

test.describe('internal Storybook UI', () => {
  test.setTimeout(60_000);

  test('loads a story in the preview iframe', async ({ page }) => {
    await page.goto(`${storybookUrl}/?path=${STORY_PATH}`);
    await expect(page.locator('#storybook-preview-iframe')).toBeVisible();
    await waitForPreviewReady(page);

    const preview = page.frameLocator('#storybook-preview-iframe');
    await expect(preview.getByRole('button', { name: 'Click Me!' })).toBeVisible({
      timeout: PREVIEW_STORY_TIMEOUT,
    });
  });

  test('restricts which pages can embed the manager and the preview', async ({ request }) => {
    test.skip(!runsAgainstDevServer, 'Only the dev server sets frame-ancestors');

    const manager = await request.get(`${storybookUrl}/`);
    expect(manager.headers()['content-security-policy']).toContain("frame-ancestors 'self'");

    const preview = await request.get(`${storybookUrl}/iframe.html`);
    expect(preview.headers()['content-security-policy']).toContain("frame-ancestors 'self'");
  });
});
