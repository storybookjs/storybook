import { expect, test } from '@playwright/test';

import { SbPage } from './util';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME || '';

test.describe('composition', () => {
  test.skip(
    templateName !== 'react-vite/default-ts',
    'Slow, framework independent test, so only run it on in react-vite/default-ts'
  );

  test('should filter and render composed stories', async ({ page }) => {
    await page.goto(storybookUrl);
    await new SbPage(page, expect).waitUntilLoaded();

    // Expect that composed Storybooks are visible
    await expect(page.getByTitle('Storybook 8.0.0')).toBeVisible();
    await expect(page.getByTitle('Storybook 7.6.18')).toBeVisible();

    // Expect composed stories to be available in the sidebar
    await page.locator('[id="storybook\\@8\\.0\\.0_components-badge"]').click();
    await expect(
      page.locator('[id="storybook\\@8\\.0\\.0_components-badge--default"]')
    ).toBeVisible();

    await page.locator('[id="storybook\\@7\\.6\\.18_components-badge"]').click();
    await expect(
      page.locator('[id="storybook\\@7\\.6\\.18_components-badge--default"]')
    ).toBeVisible();

    // Expect composed stories `to be available in the search
    await page.getByPlaceholder('Find components').fill('Button');
    await expect(
      page.getByRole('option', { name: 'Button Storybook 7.6.18 / @blocks / examples' })
    ).toBeVisible();

    const buttonStory = page.getByRole('option', {
      name: 'Button Storybook 8.0.0 / @blocks / examples',
    });
    await expect(buttonStory).toBeVisible();
    await buttonStory.click();

    // Note: this could potentially be flaky due to it accessing a hosted Storybook
    await expect(
      page
        .locator('iframe[title="storybook-ref-storybook\\@8\\.0\\.0"]')
        .contentFrame()
        .getByRole('heading', { name: 'Example button component' })
    ).toBeVisible({ timeout: 15000 });
  });

  test('should filter and render composed stories on mobile', async ({ page }) => {
    page.setViewportSize({ width: 320, height: 800 });
    await page.goto(storybookUrl);
    await new SbPage(page, expect).waitUntilLoaded();

    await page.click('button[title="Open navigation menu"]');

    // Expect that composed Storybooks are visible
    await expect(page.getByTitle('Storybook 8.0.0')).toBeVisible();
    await expect(page.getByTitle('Storybook 7.6.18')).toBeVisible();

    // Expect composed stories to be available in the sidebar
    await page.locator('[id="storybook\\@8\\.0\\.0_components-badge"]').click();
    await expect(
      page.locator('[id="storybook\\@8\\.0\\.0_components-badge--default"]')
    ).toBeVisible();

    await page.locator('[id="storybook\\@7\\.6\\.18_components-badge"]').click();
    await expect(
      page.locator('[id="storybook\\@7\\.6\\.18_components-badge--default"]')
    ).toBeVisible();

    // Expect composed stories `to be available in the search
    await page.getByPlaceholder('Find components').fill('Button');
    await expect(
      page.getByRole('option', { name: 'Button Storybook 7.6.18 / @blocks / examples' })
    ).toBeVisible();

    const buttonStory = page.getByRole('option', {
      name: 'Button Storybook 8.0.0 / @blocks / examples',
    });
    await expect(buttonStory).toBeVisible();
    await buttonStory.click();

    // Note: this could potentially be flaky due to it accessing a hosted Storybook
    await expect(
      page
        .locator('iframe[title="storybook-ref-storybook\\@8\\.0\\.0"]')
        .contentFrame()
        .getByRole('heading', { name: 'Example button component' })
    ).toBeVisible({ timeout: 15000 });
  });
});
