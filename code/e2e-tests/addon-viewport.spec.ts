import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from './util';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';

test.describe('addon-viewport', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);
    await new SbPage(page, expect).waitUntilLoaded();
  });

  test('should have viewport button in the toolbar', async ({ page }) => {
    const sbPage = new SbPage(page, expect);

    // Click on viewport button and select small mobile
    await sbPage.navigateToStory('example/button', 'primary');
    await sbPage.selectToolbar('[aria-label="Viewport size"]', 'text=/Small mobile/');

    // Check that Button story is still displayed
    await expect(sbPage.previewRoot()).toContainText('Button');
  });

  test('iframe width should be changed when a mobile viewport is selected', async ({ page }) => {
    const sbPage = new SbPage(page, expect);

    // Click on viewport button and select small mobile
    await sbPage.navigateToStory('example/button', 'primary');

    // Measure the original dimensions of previewRoot
    const originalDimensions = await sbPage.getCanvasBodyElement().boundingBox();
    expect(originalDimensions?.width).toBeDefined();

    await sbPage.selectToolbar('[aria-label="Viewport size"]', 'text=/Small mobile/');

    // Measure the adjusted dimensions of previewRoot after clicking the mobile item.
    const adjustedDimensions = await sbPage.getCanvasBodyElement().boundingBox();
    expect(adjustedDimensions?.width).toBeDefined();

    // Compare the two widths
    expect(adjustedDimensions?.width).not.toBe(originalDimensions?.width);
  });

  test('viewport should be uneditable when a viewport is set via globals', async ({ page }) => {
    const sbPage = new SbPage(page, expect);

    // Story parameters/selected is set to small mobile
    await sbPage.navigateToStory('core/viewport/globals', 'selected');

    // Measure the original dimensions of previewRoot
    const originalDimensions = await sbPage.getCanvasBodyElement().boundingBox();
    expect(originalDimensions?.width).toBeDefined();

    const toolbar = page.getByLabel('Viewport size');

    await expect(toolbar).toBeDisabled();
  });
});
