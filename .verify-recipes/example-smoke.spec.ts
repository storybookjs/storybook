// @verify-target: internal-ui
import { RecipePage, expect, filterPageErrors, test } from './_util.ts';

test('example-button--primary renders without runtime errors', async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  // CRITICAL: register listeners BEFORE the first page.goto so we never miss errors.
  page.on('pageerror', (err) => {
    pageErrors.push(err.stack ?? err.message ?? String(err));
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  const baseURL =
    process.env.STORYBOOK_URL ?? testInfo.project.use.baseURL ?? 'http://localhost:6006';

  try {
    await page.goto(`${baseURL}/?path=/story/example-button--primary`);

    const sb = new RecipePage(page, expect);
    await sb.waitUntilLoaded();

    const errorDisplay = page.locator('#sb-errordisplay');
    await expect(errorDisplay).toBeHidden();

    const previewIframe = page.frameLocator('#storybook-preview-iframe');
    const previewRoot = previewIframe.locator('#storybook-root, #root');
    await expect(previewRoot).toBeVisible();
    const childCount = await previewRoot.evaluate((el) => el.childElementCount);
    expect(childCount).toBeGreaterThan(0);

    await previewIframe.locator('body').screenshot({
      path: testInfo.outputPath('preview.png'),
    });
  } finally {
    await testInfo.attach('pageErrors', {
      body: JSON.stringify(pageErrors),
      contentType: 'application/json',
    });
    await testInfo.attach('consoleErrors', {
      body: JSON.stringify(consoleErrors),
      contentType: 'application/json',
    });
  }

  expect(filterPageErrors(pageErrors)).toEqual([]);
});
