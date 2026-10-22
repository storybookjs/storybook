import { readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { type DevServer, startDevServer, VITE_BIN } from './helpers/dev-server.ts';

const FIXTURE = path.resolve(import.meta.dirname, '..');
const STORY_FILE = path.join(FIXTURE, 'src/Button.stories.tsx');
const ORIGINAL_STORY_FILE = readFileSync(STORY_FILE, 'utf8');

let devServer: DevServer | undefined;

test.beforeAll(async () => {
  devServer = await startDevServer(
    [VITE_BIN, '--mode', 'storybook', '--host', '127.0.0.1', '--port', '5175', '--strictPort'],
    'http://127.0.0.1:5175/index.json'
  );
});

test.afterAll(async () => {
  await devServer?.stop();
});

test.afterEach(async () => {
  await restoreFile(STORY_FILE, ORIGINAL_STORY_FILE);
});

test('serves the manager at the root', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#storybook-preview-iframe')).toBeVisible();
});

test('renders a story in the preview iframe', async ({ page }) => {
  await page.goto('/?path=/story/example-button--primary');
  const preview = page.frameLocator('#storybook-preview-iframe');
  await expect(preview.getByRole('button', { name: 'Button' })).toBeVisible();
});

test('serves the preview standalone', async ({ page }) => {
  await page.goto('/iframe.html?id=example-button--secondary&viewMode=story');
  await expect(page.getByRole('button', { name: 'Button' })).toBeVisible();
});

test('serves the story index and a base-aware client', async ({ request }) => {
  const indexResponse = await request.get('/index.json');
  expect(indexResponse.ok()).toBeTruthy();
  const index = await indexResponse.json();
  expect(index.entries['example-button--primary']).toMatchObject({
    id: 'example-button--primary',
    type: 'story',
  });

  const clientResponse = await request.get('/@vite/client');
  expect(clientResponse.ok()).toBeTruthy();
  expect(await clientResponse.text()).toContain('/__storybook-hmr');
});

test('a story edit updates the preview', async ({ page }) => {
  const originalStory = await readFile(STORY_FILE, 'utf8');
  const preview = page.frameLocator('#storybook-preview-iframe');

  try {
    await page.goto('/?path=/story/example-button--primary');
    await expect(preview.getByRole('button', { name: 'Button' })).toBeVisible();

    await writeFile(STORY_FILE, originalStory.replace("label: 'Button',", "label: 'Button HMR',"));

    await expect(preview.getByRole('button', { name: 'Button HMR' })).toBeVisible({
      timeout: 15_000,
    });
  } finally {
    await restoreFile(STORY_FILE, originalStory);
    await expect(preview.getByRole('button', { name: 'Button' })).toBeVisible({
      timeout: 15_000,
    });
  }
});

async function restoreFile(file: string, original: string): Promise<boolean> {
  if ((await readFile(file, 'utf8')) !== original) {
    await writeFile(file, original);
    return true;
  }

  return false;
}
