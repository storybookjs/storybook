import { expect, test } from '@playwright/test';
import process from 'process';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';
const type = process.env.STORYBOOK_TYPE || 'dev';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME || '';

const storyUrl = `${storybookUrl}/iframe.html?id=example-button--primary&viewMode=story`;
const earlyImport = `<script type="module">import('/@id/@storybook/web-components-vite');</script>`;

test.describe('preview runtime order', () => {
  test.skip(type !== 'dev', 'Pre-bundled dependencies only exist on the Vite dev server.');
  test.skip(
    templateName !== 'lit-vite/default-ts',
    'The early import targets @storybook/web-components-vite.'
  );

  test('renders a story when a head module script imports a pre-bundled Storybook package', async ({
    page,
  }) => {
    const missingGlobalErrors: string[] = [];
    page.on('pageerror', ({ message }) => {
      if (message.includes('__STORYBOOK_MODULE_')) {
        missingGlobalErrors.push(message);
      }
    });
    await page.route(/\/iframe\.html/, async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace('</head>', `${earlyImport}</head>`);
      await route.fulfill({ response, body });
    });

    await page.goto(storyUrl);

    // Reloading covers two server facts: the early import only outruns the preview entry once
    // the browser has cached it, and a rewritten document never gets Vite's reload request.
    await expect(async () => {
      await page.reload();
      await expect(page.locator('#storybook-root button')).toBeVisible();
    }).toPass({ timeout: 20_000 });

    expect(missingGlobalErrors).toStrictEqual([]);
  });
});
