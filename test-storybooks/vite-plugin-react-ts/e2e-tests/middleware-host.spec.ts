import { readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { type DevServer, startDevServer } from './helpers/dev-server.ts';

type ChannelSocket = {
  isClosed(): boolean;
  url(): string;
};

const FIXTURE = path.resolve(import.meta.dirname, '..');
const STORY_FILE = path.join(FIXTURE, 'src/Button.stories.tsx');
const ORIGINAL_STORY_FILE = readFileSync(STORY_FILE, 'utf8');

let devServer: DevServer | undefined;

test.beforeAll(async () => {
  devServer = await startDevServer(
    [path.join(FIXTURE, 'server.mjs')],
    'http://127.0.0.1:5176/__storybook/index.json',
    { PORT: '5176' }
  );
});

test.afterAll(async () => {
  await devServer?.stop();
});

test.afterEach(async () => {
  await restoreFile(STORY_FILE, ORIGINAL_STORY_FILE);
});

test('the host app is served through the custom server', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Vite + React + Storybook plugin' })
  ).toBeVisible();
});

test('Storybook is served under the prefix', async ({ page }) => {
  await page.goto('/__storybook/?path=/story/example-button--primary');
  const preview = page.frameLocator('#storybook-preview-iframe');
  await expect(preview.getByRole('button', { name: 'Button' })).toBeVisible();
});

test("a story edit updates the preview through the host's HMR server", async ({ page }) => {
  const originalStory = await readFile(STORY_FILE, 'utf8');
  const preview = page.frameLocator('#storybook-preview-iframe');

  try {
    await page.goto('/__storybook/?path=/story/example-button--primary');
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

test('the server channel connects through the custom server', async ({ page }) => {
  const channelSockets: ChannelSocket[] = [];

  page.on('websocket', (socket) => {
    if (socket.url().includes('storybook-server-channel')) {
      channelSockets.push(socket);
    }
  });

  await page.goto('/__storybook/');
  await expect.poll(() => channelSockets.length).toBe(1);

  expect(channelSockets[0].isClosed()).toBe(false);
  await page.waitForTimeout(2_000);
  expect(channelSockets[0].isClosed()).toBe(false);
});

async function restoreFile(file: string, original: string): Promise<boolean> {
  if ((await readFile(file, 'utf8')) !== original) {
    await writeFile(file, original);
    return true;
  }

  return false;
}
