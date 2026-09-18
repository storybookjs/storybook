import { expect, test } from '@playwright/test';

test('the app itself is served at the root', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Vite + React + Storybook plugin' })).toBeVisible();
});

test('/__storybook redirects to /__storybook/ and serves the manager', async ({ page }) => {
  await page.goto('/__storybook');
  await expect(page).toHaveURL(/\/__storybook\//);
  await expect(page.locator('#storybook-preview-iframe')).toBeVisible();
});

test('the manager sidebar lists and renders a story', async ({ page }) => {
  await page.goto('/__storybook/?path=/story/example-button--primary');
  const preview = page.frameLocator('#storybook-preview-iframe');
  await expect(preview.getByRole('button', { name: 'Button' })).toBeVisible();
});

test('the preview iframe renders a story standalone', async ({ page }) => {
  await page.goto('/__storybook/iframe.html?id=example-button--secondary&viewMode=story');
  await expect(page.getByRole('button', { name: 'Button' })).toBeVisible();
});

test('the story index is served under /__storybook', async ({ request }) => {
  const response = await request.get('/__storybook/index.json');
  expect(response.ok()).toBeTruthy();
  const index = await response.json();
  expect(index.entries['example-button--primary']).toMatchObject({
    id: 'example-button--primary',
    type: 'story',
  });
});
