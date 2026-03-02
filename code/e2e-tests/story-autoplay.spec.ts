import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from './util';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME || '';

test.describe('story-autoplay', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);
    await new SbPage(page, expect).waitUntilLoaded();
  });

  test('should have autoplay toolbar button', async ({ page }) => {
    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory('core/autoplay', 'always-autoplay');

    const autoplayButton = page.getByLabel('Change story autoplay setting');
    await expect(autoplayButton).toBeVisible();
  });

  test('should autoplay when storyAutoplay global is "always"', async ({ page }) => {
    test.skip(
      /^(lit)/i.test(`${templateName}`),
      `Skipping ${templateName}, which does not support interactions`
    );

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory('core/autoplay', 'always-autoplay');

    // The play function sets data-played="true" on the pre element
    const pre = sbPage.previewRoot().locator('[data-testid="pre"]');
    await expect(pre).toHaveAttribute('data-played', 'true', { timeout: 10000 });
  });

  test('should not autoplay when storyAutoplay global is "never"', async ({ page }) => {
    test.skip(
      /^(lit)/i.test(`${templateName}`),
      `Skipping ${templateName}, which does not support interactions`
    );

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory('core/autoplay', 'never-autoplay');

    // The play function should NOT have run, so data-played should not be set
    const pre = sbPage.previewRoot().locator('[data-testid="pre"]');

    // Wait for the story to be rendered, then verify the play function did not run
    await expect(pre).toBeVisible({ timeout: 10000 });

    // Give a small buffer to ensure the play function would have run if it were going to
    await page.waitForTimeout(2000);
    await expect(pre).not.toHaveAttribute('data-played', 'true');
  });

  test('autoplay toolbar button should be disabled for story that overrides autoplay global', async ({
    page,
  }) => {
    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory('core/autoplay', 'always-autoplay');

    const button = page.getByLabel('Story autoplay set by story parameters');
    await expect(button).toBeDisabled();
  });
});
