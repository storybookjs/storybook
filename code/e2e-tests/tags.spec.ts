import { expect, test } from '@playwright/test';

import { SbPage } from './util';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';

test.describe('tags', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);
    await new SbPage(page).waitUntilLoaded();
  });

  test('should correctly filter dev-only, docs-only, test-only stories', async ({ page }) => {
    const sbPage = new SbPage(page);

    await sbPage.navigateToStory('core/tags-config', 'docs');

    // Sidebar should include dev-only and exclude docs-only and test-only
    const devOnlyEntry = await page.locator('#core-tags-config--dev-only').all();
    expect(devOnlyEntry.length).toBe(1);

    const docsOnlyEntry = await page.locator('#core-tags-config--docs-only').all();
    expect(docsOnlyEntry.length).toBe(0);

    const testOnlyEntry = await page.locator('#core-tags-config--test-only').all();
    expect(testOnlyEntry.length).toBe(0);

    // Autodocs should include docs-only and exclude dev-only and test-only
    const root = sbPage.previewRoot();

    const devOnlyAnchor = await root.locator('#anchor--core-tags-config--dev-only').all();
    expect(devOnlyAnchor.length).toBe(0);

    const docsOnlyAnchor = await root.locator('#anchor--core-tags-config--docs-only').all();
    expect(docsOnlyAnchor.length).toBe(1);

    const testOnlyAnchor = await root.locator('#anchor--core-tags-config--test-only').all();
    expect(testOnlyAnchor.length).toBe(0);
  });

  test('should correctly add dev, autodocs, test stories', async ({ page }) => {
    const sbPage = new SbPage(page);

    await sbPage.navigateToStory('core/tags-add', 'docs');

    // Sidebar should include dev and exclude inheritance, autodocs, test
    const devEntry = await page.locator('#core-tags-add--dev').all();
    expect(devEntry.length).toBe(1);

    const autodocsEntry = await page.locator('#core-tags-add--autodocs').all();
    expect(autodocsEntry.length).toBe(0);

    const testOnlyEntry = await page.locator('#core-tags-add--test').all();
    expect(testOnlyEntry.length).toBe(0);

    // Autodocs should include autodocs and exclude dev, test
    const root = sbPage.previewRoot();

    const devAnchor = await root.locator('#anchor--core-tags-add--dev').all();
    expect(devAnchor.length).toBe(0);

    // FIXME: shows as primary story and also in stories, inconsistent btw dev/CI?
    const autodocsAnchor = await root.locator('#anchor--core-tags-add--autodocs').all();
    expect(autodocsAnchor.length).not.toBe(0);

    const testAnchor = await root.locator('#anchor--core-tags-add--test').all();
    expect(testAnchor.length).toBe(0);
  });

  test('should correctly remove dev, autodocs, test stories', async ({ page }) => {
    const sbPage = new SbPage(page);

    await sbPage.navigateToStory('core/tags-remove', 'docs');

    // Sidebar should include inheritance, no-autodocs, no-test. and exclude no-dev
    const noDevEntry = await page.locator('#core-tags-remove--no-dev').all();
    expect(noDevEntry.length).toBe(0);

    const noAutodocsEntry = await page.locator('#core-tags-remove--no-autodocs').all();
    expect(noAutodocsEntry.length).toBe(1);

    const noTestEntry = await page.locator('#core-tags-remove--no-test').all();
    expect(noTestEntry.length).toBe(1);

    // Autodocs should include inheritance, no-dev, no-test. and exclude no-autodocs
    const root = sbPage.previewRoot();

    const noDevAnchor = await root.locator('#anchor--core-tags-remove--no-dev').all();
    expect(noDevAnchor.length).toBe(1);

    const noAutodocsAnchor = await root.locator('#anchor--core-tags-remove--no-autodocs').all();
    expect(noAutodocsAnchor.length).toBe(0);

    const noTestAnchor = await root.locator('#anchor--core-tags-remove--no-test').all();
    expect(noTestAnchor.length).toBe(1);
  });
});
