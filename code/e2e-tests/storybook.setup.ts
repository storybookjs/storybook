import { expect, test } from '@playwright/test';

import { SbPage } from './util';

const STORYBOOK_READY_TIMEOUT = 200000;
const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';
const storybookReadyPath = `${storybookUrl}/?path=/story/example-button--primary`;

test.setTimeout(STORYBOOK_READY_TIMEOUT);

test('wait for Storybook manager and preview to settle', async ({ page }) => {
  const sbPage = new SbPage(page, expect);

  await expect
    .poll(
      async () => {
        const response = await page.request.get(`${storybookUrl}/index.json`);
        if (!response.ok()) {
          return undefined;
        }

        const index = await response.json();
        return index?.entries?.['example-button--primary']?.id;
      },
      {
        intervals: [250, 500, 1000, 2000],
        message: 'wait for Storybook index.json to expose the example button story',
        timeout: STORYBOOK_READY_TIMEOUT,
      }
    )
    .toBe('example-button--primary');

  await page.goto(storybookReadyPath);

  const storiesNavigation = page.getByRole('navigation', { name: 'Stories' });
  const selectedStory = storiesNavigation.locator(
    '[data-item-id="example-button--primary"][data-selected="true"]'
  );

  await expect(storiesNavigation).toBeVisible();
  await expect(selectedStory).toBeVisible();
  await sbPage.waitUntilLoaded();
});
