import { expect, test } from '@playwright/test';
import process from 'process';
import { SbPage } from '../e2e-sandbox/util.ts';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';

test.describe('navigating', () => {
  test('a URL with a partial storyId will redirect to the first story', async ({ page }) => {
    // this is purposefully not using the SbPage class, and the URL is a partial (it does not contain the full storyId)
    await page.goto(`${storybookUrl}?path=/story/example-button`);

    const sbPage = new SbPage(page, expect);

    await sbPage.waitUntilLoaded();

    await page.waitForFunction(() =>
      window.document.location.href.match('/docs/example-button--docs')
    );

    expect(sbPage.page.url()).toContain('/docs/example-button--docs');
  });

  test.describe('docs story anchor navigation', () => {
    test('a subheading in a story can be searched and renders the subheading in a search result item', async ({
      page,
    }) => {
      await page.goto(`${storybookUrl}`);
      await page.getByRole('searchbox').fill('Monospace');

      const searchItem = page.getByRole('option', {
        name: 'Docs / Monospace brand / Typography',
        exact: true,
      });
      await expect(searchItem).toBeVisible();
    });

    test('a subheading gets scrolled into view when navigating to an anchor link on the current docs page', async ({
      page,
    }) => {
      await page.goto(`${storybookUrl}?path=/docs/brand-typography--docs`);

      const sbPage = new SbPage(page, expect);
      await sbPage.waitUntilLoaded();

      await page.getByRole('searchbox').fill('Monospace');

      await page
        .getByRole('option', {
          name: 'Docs / Monospace brand / Typography',
          exact: true,
        })
        .click();
      await sbPage.waitUntilLoaded();

      const subheading = sbPage.previewIframe().getByRole('heading', { name: 'Monospace' });

      await expect(subheading).toBeVisible();

      // Wait for smooth scroll to finish and verify the heading is near the top
      await expect
        .poll(() => subheading.evaluate((el) => el.getBoundingClientRect().top), {
          intervals: [300],
        })
        .toBeLessThan(50);
    });

    test('a subheading gets scrolled into view when navigating to a different story', async ({
      page,
    }) => {
      await page.goto(`${storybookUrl}?path=/docs/brand-typography--docs`);

      const sbPage = new SbPage(page, expect);
      await sbPage.waitUntilLoaded();

      await page.getByRole('searchbox').fill('Primary');
      await page
        .getByRole('option', {
          name: 'Docs / Primary Example / Button',
          exact: true,
        })
        .click();

      await sbPage.waitUntilLoaded();

      const subheading = sbPage.previewIframe().getByRole('heading', { name: 'Primary' });

      await expect(subheading).toBeVisible();

      // Wait for smooth scroll to finish and verify the heading is near the top
      await expect
        .poll(() => subheading.evaluate((el) => el.getBoundingClientRect().top), {
          intervals: [300],
        })
        .toBeLessThan(50);
    });
  });
});
