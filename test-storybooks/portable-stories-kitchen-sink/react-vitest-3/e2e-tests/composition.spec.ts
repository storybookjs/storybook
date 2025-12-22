import { expect, test } from '@playwright/test';

import { SbPage } from '../../../../code/e2e-tests/util';

const STORYBOOK_URL = 'http://localhost:6006';

test.describe('composition', () => {
  // the composed storybook can be slow to load, so we need to increase the timeout
  test.describe.configure({ mode: 'serial', timeout: 60000, retries: 2 });
  test('should filter and render composed stories', async ({ page }) => {
    await page.goto(STORYBOOK_URL);
    await new SbPage(page, expect).waitUntilLoaded();

    // Expect that composed Storybooks are visible and loaded
    await expect(page.getByTitle('Storybook 8.0.0')).toBeVisible();
    await expect(page.locator('[id="storybook\\@8\\.0\\.0_components-badge"]')).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTitle('Storybook 7.6.18')).toBeVisible();
    await expect(page.locator('[id="storybook\\@7\\.6\\.18_components-badge"]')).toBeVisible({
      timeout: 15000,
    });

    // Expect composed stories to be available in the sidebar
    await page.locator('[id="storybook\\@8\\.0\\.0_components-badge"]').click();
    await expect(
      page.locator('[id="storybook\\@8\\.0\\.0_components-badge--default"]')
    ).toBeVisible();

    await page.locator('[id="storybook\\@7\\.6\\.18_components-badge"]').click();
    await expect(
      page
        .locator('iframe[title="storybook-ref-storybook\\@7\\.6\\.18"]')
        .contentFrame()
        .locator('#storybook-root')
        .getByText('Default')
    ).toBeVisible({ timeout: 15000 });

    // Expect composed stories `to be available in the search
    await page.getByPlaceholder('Find components').fill('Button primary');
    await expect(
      page.getByRole('option', {
        name: 'Primary Storybook 7.6.18 / @components / Button',
      })
    ).toBeVisible();

    const buttonStory = page.getByRole('option', {
      name: 'Primary Storybook 8.0.0 / @blocks / examples / Button',
    });
    await expect(buttonStory).toBeVisible();
    await buttonStory.click();

    // Note: this could potentially be flaky due to it accessing a hosted Storybook
    await expect(
      page
        .locator('iframe[title="storybook-ref-storybook\\@8\\.0\\.0"]')
        .contentFrame()
        .getByRole('button')
    ).toBeVisible({ timeout: 15000 });
  });

  test('should filter and render composed stories on mobile', async ({ page }) => {
    page.setViewportSize({ width: 320, height: 800 });
    await page.goto(STORYBOOK_URL);
    await new SbPage(page, expect).waitUntilLoaded();

    await page.click('button[aria-label="Open navigation menu"]');

    // scroll down to the bottom of the element getByText('Skip to canvasStorybookSearch')

    await page.getByTitle('Storybook 7.6.18').scrollIntoViewIfNeeded();

    // Expect that composed Storybooks are visible
    await expect(page.getByTitle('Storybook 8.0.0')).toBeVisible();
    await expect(page.getByTitle('Storybook 7.6.18')).toBeVisible();

    // Expect composed stories to be available in the sidebar
    await expect(page.locator('[id="storybook\\@8\\.0\\.0_components-badge"]')).toBeVisible();
    await page.locator('[id="storybook\\@8\\.0\\.0_components-badge"]').click();
    await expect(
      page.locator('[id="storybook\\@8\\.0\\.0_components-badge--default"]')
    ).toBeVisible();

    await page.locator('[id="storybook\\@7\\.6\\.18_components-badge"]').click();
    await page.locator('[id="storybook\\@7\\.6\\.18_components-badge--default"]').click();
    await expect(
      page
        .locator('iframe[title="storybook-ref-storybook\\@7\\.6\\.18"]')
        .contentFrame()
        .locator('#storybook-root')
        .getByText('Default')
    ).toBeVisible({ timeout: 15000 });

    await page.click('button[aria-label="Open navigation menu"]');

    // Expect composed stories `to be available in the search
    await page.getByPlaceholder('Find components').fill('Button primary');
    await expect(
      page.getByRole('option', {
        name: 'Primary Storybook 7.6.18 / @components / Button',
      })
    ).toBeVisible();

    const buttonStory = page.getByRole('option', {
      name: 'Primary Storybook 8.0.0 / @blocks / examples / Button',
    });
    await expect(buttonStory).toBeVisible();
    await buttonStory.click();

    // Note: this could potentially be flaky due to it accessing a hosted Storybook
    await expect(
      page
        .locator('iframe[title="storybook-ref-storybook\\@8\\.0\\.0"]')
        .contentFrame()
        .getByRole('button')
    ).toBeVisible({ timeout: 15000 });
  });
});
