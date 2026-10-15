import { expect, test } from '@playwright/test';

import { SbPage } from '../../../../code/e2e-sandbox/util';

const STORYBOOK_URL = 'http://localhost:6006';

test.describe('composition', () => {
  // the composed storybook can be slow to load, so we need to increase the timeout
  test.describe.configure({ mode: 'serial', timeout: 60000, retries: 2 });
  test('should filter and render composed stories', async ({ page }) => {
    await page.goto(STORYBOOK_URL);
    const sbPage = new SbPage(page, expect);
    await sbPage.waitUntilLoaded();

    // Expect that composed Storybooks are visible and loaded. The sidebar is virtualized, so each
    // row is scrolled into existence before it is looked at.
    await expect(page.getByTitle('Storybook 8.0.0')).toBeVisible();
    const badge8 = await sbPage.revealSidebarRow('components-badge', 'storybook@8.0.0');
    await expect(badge8).toBeVisible({ timeout: 15000 });
    await expect(page.getByTitle('Storybook 7.6.18')).toBeVisible();
    const badge7 = await sbPage.revealSidebarRow('components-badge', 'storybook@7.6.18');
    await expect(badge7).toBeVisible({ timeout: 15000 });

    // Expect composed stories to be available in the sidebar
    await badge8.click();
    await expect(
      await sbPage.revealSidebarRow('components-badge--default', 'storybook@8.0.0')
    ).toBeVisible();

    await (await sbPage.revealSidebarRow('components-badge', 'storybook@7.6.18')).click();
    await expect(
      page
        .locator('iframe[title="storybook-ref-storybook\\@7\\.6\\.18"]')
        .contentFrame()
        .locator('#storybook-root')
        .getByText('Default')
    ).toBeVisible({ timeout: 15000 });

    // Expect composed stories to be available in the search
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
    const sbPage = new SbPage(page, expect);
    await sbPage.waitUntilLoaded();

    await page.click('button[aria-label="Open navigation menu"]');

    // scroll down to the bottom of the element getByText('Skip to canvasStorybookSearch')

    await page.getByTitle('Storybook 7.6.18').scrollIntoViewIfNeeded();

    // Expect that composed Storybooks are visible
    await expect(page.getByTitle('Storybook 8.0.0')).toBeVisible();
    await expect(page.getByTitle('Storybook 7.6.18')).toBeVisible();

    // Expect composed stories to be available in the sidebar
    const badge8 = await sbPage.revealSidebarRow('components-badge', 'storybook@8.0.0');
    await expect(badge8).toBeVisible();
    await badge8.click();
    await expect(
      await sbPage.revealSidebarRow('components-badge--default', 'storybook@8.0.0')
    ).toBeVisible();

    await (await sbPage.revealSidebarRow('components-badge', 'storybook@7.6.18')).click();
    await (await sbPage.revealSidebarRow('components-badge--default', 'storybook@7.6.18')).click();
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
