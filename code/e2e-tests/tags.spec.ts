import { expect, test } from '@playwright/test';

import { SbPage, isReactSandbox } from './util';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME || '';

test.describe('tags', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);
    await new SbPage(page, expect).waitUntilLoaded();
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
      const sbPage = new SbPage(page, expect);

      // Open Tag filters tooltip
      const tooltip = await sbPage.openTagsFilter();

      // No checkbox selected by default and "Select all tags" is shown
      await expect(tooltip.locator('#select-all')).toBeVisible();
      await expect(tooltip.locator('input[type="checkbox"]:checked')).toHaveCount(0);

      // When selecting dev-only, there should be only one story in the sidebar
      await sbPage.toggleTagFilter('dev-only');
      const stories = page.locator('#storybook-explorer-menu .sidebar-item');
      await expect(stories).toHaveCount(1);
    });

    test('filters stories via Tag filter types', async ({ page }) => {
      test.skip(
        !isReactSandbox(templateName),
        'Test filtering is currently only supported in React renderer'
      );

      const sbPage = new SbPage(page, expect);

      // Open Tag filters tooltip
      const tooltip = await sbPage.openTagsFilter();

      // No checkbox selected by default and "Select all tags" is shown
      await expect(tooltip.locator('#select-all')).toBeVisible();
      await expect(tooltip.locator('input[type="checkbox"]:checked')).toHaveCount(0);

      // When selecting type docs, there should be no stories in the sidebar
      await sbPage.toggleStoryTypeFilter('Documentation');
      await sbPage.closeAnyPendingModal();
      await sbPage.expandAllSidebarNodes();
      await expect(
        page.locator('#storybook-explorer-menu .sidebar-item[data-nodetype="story"]')
      ).toHaveCount(0);

      await sbPage.clearTagsFilter();

      // When excluding type docs, there should be no stories in the sidebar
      await sbPage.toggleStoryTypeFilter('Documentation', true);
      await sbPage.closeAnyPendingModal();
      await expect(
        page.locator('#storybook-explorer-menu .sidebar-item[data-nodetype="document"]')
      ).toHaveCount(0);

      // Clear selection
      await sbPage.clearTagsFilter();

      // When selecting type play, there should be no docs in the sidebar
      await sbPage.toggleStoryTypeFilter('Play');
      await sbPage.closeAnyPendingModal();
      await sbPage.expandAllSidebarNodes();
      await expect(
        page.locator('#storybook-explorer-menu .sidebar-item[data-nodetype="document"]')
      ).toHaveCount(0);

      await sbPage.clearTagsFilter();

      // When selecting type test, there should be tests visible in the sidebar
      await sbPage.toggleStoryTypeFilter('Testing');
      await sbPage.closeAnyPendingModal();
      await sbPage.expandAllSidebarNodes();
      const testItems = page.locator(
        '#storybook-explorer-menu .sidebar-item[data-nodetype="test"]'
      );
      await expect(testItems.count()).resolves.toBeGreaterThan(0);

      await sbPage.clearTagsFilter();

      // When excluding type test, there should be no tests visible in the sidebar
      await sbPage.toggleStoryTypeFilter('Testing', true);
      await sbPage.closeAnyPendingModal();
      await expect(
        page.locator('#storybook-explorer-menu .sidebar-item[data-nodetype="test"]')
      ).toHaveCount(0);

      await sbPage.clearTagsFilter();
    });

    test.describe('mobile viewport', () => {
      test.use({ viewport: { width: 390, height: 844 } });

      test('filters stories via Tag filters tooltip (mobile)', async ({ page }) => {
        // Open mobile navigation menu to ensure the tooltip is portaled inside it
        const mobileNavigationHeading = page.locator('[aria-label="Open navigation menu"]');
        await mobileNavigationHeading.click();
        await expect(page.locator('#storybook-explorer-menu')).toBeVisible();

        // Open Tag filters tooltip
        await page.locator('[aria-label="Tag filters"]').click();
        const tagFilterPopover = page.getByRole('dialog', { name: 'Tag filters' });
        await expect(tagFilterPopover).toBeVisible();

        // No checkbox selected by default and "Select all tags" is shown
        await expect(tagFilterPopover.locator('#select-all')).toBeVisible();
        await expect(tagFilterPopover.locator('input[type="checkbox"]:checked')).toHaveCount(0);

        // Select the dev-only tag
        await page.getByText('dev-only', { exact: true }).click();

        // Assert that only one story is visible in the (mobile) sidebar
        const stories = page.locator('#storybook-explorer-menu .sidebar-item');
        await expect(stories).toHaveCount(1);

        // Clear selection
        await expect(tagFilterPopover.locator('#deselect-all')).toBeVisible();
        await tagFilterPopover.locator('#deselect-all').click();

        // Checkboxes are not selected anymore
        await expect(tagFilterPopover.locator('input[type="checkbox"]:checked')).toHaveCount(0);
      });
    });
  });
});
