import { expect, test } from '@playwright/test';

import { SbPage } from './util';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';

test.describe('tags', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);
    await new SbPage(page, expect).waitUntilLoaded();
  });

  test('should correctly filter dev-only, docs-only, test-only stories', async ({ page }) => {
    const sbPage = new SbPage(page, expect);

    await sbPage.navigateToStory('core/tags-config', 'docs');

    // Sidebar should include dev-only and exclude docs-only and test-only
    await expect(page.locator('#core-tags-config--dev-only')).toHaveCount(1);
    await expect(page.locator('#core-tags-config--docs-only')).toHaveCount(0);
    await expect(page.locator('#core-tags-config--test-only')).toHaveCount(0);

    // Autodocs should include docs-only and exclude dev-only and test-only
    const preview = sbPage.previewRoot();

    await expect(preview.locator('#anchor--core-tags-config--dev-only')).toHaveCount(0);
    await expect(preview.locator('#anchor--core-tags-config--docs-only')).toHaveCount(1);
    await expect(preview.locator('#anchor--core-tags-config--test-only')).toHaveCount(0);
  });

  test('should correctly add dev, autodocs, test stories', async ({ page }) => {
    const sbPage = new SbPage(page, expect);

    await sbPage.navigateToStory('core/tags-add', 'docs');

    // Sidebar should include dev and exclude inheritance, autodocs, test
    await expect(page.locator('#core-tags-add--dev')).toHaveCount(1);
    await expect(page.locator('#core-tags-add--autodocs')).toHaveCount(0);
    await expect(page.locator('#core-tags-add--test')).toHaveCount(0);

    // Autodocs should include autodocs and exclude dev, test
    const preview = sbPage.previewRoot();

    await expect(preview.locator('#anchor--core-tags-add--dev')).toHaveCount(0);
    // FIXME: shows as primary story and also in stories, inconsistent btw dev/CI?
    await expect(preview.locator('#anchor--core-tags-add--autodocs')).not.toHaveCount(0);
    await expect(preview.locator('#anchor--core-tags-add--test')).toHaveCount(0);
  });

  test('should correctly remove dev, autodocs, test stories', async ({ page }) => {
    const sbPage = new SbPage(page, expect);

    await sbPage.navigateToStory('core/tags-remove', 'docs');

    // Sidebar should include inheritance, no-autodocs, no-test. and exclude no-dev
    await expect(page.locator('#core-tags-remove--no-dev')).toHaveCount(0);
    await expect(page.locator('#core-tags-remove--no-autodocs')).toHaveCount(1);
    await expect(page.locator('#core-tags-remove--no-test')).toHaveCount(1);

    // Autodocs should include autodocs and exclude dev, test
    const preview = sbPage.previewRoot();

    await expect(preview.locator('#anchor--core-tags-remove--no-dev')).toHaveCount(1);
    await expect(preview.locator('#anchor--core-tags-remove--no-autodocs')).toHaveCount(0);
    await expect(preview.locator('#anchor--core-tags-remove--no-test')).toHaveCount(1);
  });

  test.describe('Tag filters tooltip', () => {
    test('filters stories via Tag filters tooltip (desktop)', async ({ page }) => {
      // Open Tag filters tooltip
      await page.locator('[title="Tag filters"]').click();
      const tooltip = page.locator('[data-testid="tooltip"]');
      await expect(tooltip).toBeVisible();

      // No checkbox selected by default and "Select all tags" is shown
      await expect(tooltip.locator('#select-all')).toBeVisible();
      await expect(tooltip.locator('input[type="checkbox"]:checked')).toHaveCount(0);

      // Select the dev-only tag
      await tooltip.locator('#list-item-tag-dev-only').click();

      // Assert that only one story is visible in the sidebar
      const stories = page.locator('#storybook-explorer-menu .sidebar-item');
      await expect(stories).toHaveCount(1);

      // Clear selection
      await expect(tooltip.locator('#unselect-all')).toBeVisible();
      await tooltip.locator('#unselect-all').click();

      // Checkboxes are not selected anymore
      await expect(tooltip.locator('input[type="checkbox"]:checked')).toHaveCount(0);
    });

    test.describe('mobile viewport', () => {
      test.use({ viewport: { width: 390, height: 844 } });

      test('filters stories via Tag filters tooltip (mobile)', async ({ page }) => {
        // Open mobile navigation menu to ensure the tooltip is portaled inside it
        const mobileNavigationHeading = page.locator('[aria-label="Open navigation menu"]');
        await mobileNavigationHeading.click();
        await expect(page.locator('#storybook-explorer-menu')).toBeVisible();

        // Open Tag filters tooltip
        await page.locator('[title="Tag filters"]').click();
        const tooltip = page.locator('[data-testid="tooltip"]');
        await expect(tooltip).toBeVisible();

        // No checkbox selected by default and "Select all tags" is shown
        await expect(tooltip.locator('#select-all')).toBeVisible();
        await expect(tooltip.locator('input[type="checkbox"]:checked')).toHaveCount(0);

        // Select the dev-only tag
        await tooltip.locator('#list-item-tag-dev-only').click();

        // Assert that only one story is visible in the (mobile) sidebar
        const stories = page.locator('#storybook-explorer-menu .sidebar-item');
        await expect(stories).toHaveCount(1);

        // Clear selection
        await expect(tooltip.locator('#unselect-all')).toBeVisible();
        await tooltip.locator('#unselect-all').click();

        // Checkboxes are not selected anymore
        await expect(tooltip.locator('input[type="checkbox"]:checked')).toHaveCount(0);
      });
    });
  });
});
