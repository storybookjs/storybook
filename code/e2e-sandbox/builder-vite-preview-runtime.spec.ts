import { expect, test } from '@playwright/test';
import process from 'process';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';
const type = process.env.STORYBOOK_TYPE || 'dev';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME || '';

const storyUrl = `${storybookUrl}/iframe.html?id=example-button--primary&viewMode=story`;
const earlyImport = `<script>
  import('/@id/@storybook/web-components-vite').then(
    () => (window.earlyImport = 'resolved'),
    (error) => (window.earlyImport = String(error))
  );
</script>`;

test.describe('preview runtime order', () => {
  test.skip(type !== 'dev', 'Pre-bundled dependencies only exist on the Vite dev server.');
  test.skip(
    templateName !== 'lit-vite/default-ts',
    'The early import targets @storybook/web-components-vite.'
  );

  test('renders a story when a head script imports a pre-bundled Storybook package first', async ({
    page,
  }) => {
    await page.route(/\/iframe\.html/, async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace('<head>', `<head>${earlyImport}`);
      await route.fulfill({ response, body });
    });

    await page.goto(storyUrl);

    // Retrying with a reload covers server facts: the browser caches the dependency on a first
    // load, a rewritten document never gets Vite's reload request, and other specs can make Vite
    // re-bundle dependencies mid-run.
    await expect(async () => {
      await page.reload();
      await expect(page.locator('#storybook-root button')).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => (window as { earlyImport?: string }).earlyImport), {
          timeout: 2000,
        })
        .toBe('resolved');
    }).toPass({ timeout: 20_000 });
  });
});
