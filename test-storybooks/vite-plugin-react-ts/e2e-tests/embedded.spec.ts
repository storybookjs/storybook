import { readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';

type ChannelSocket = {
  isClosed(): boolean;
  url(): string;
  waitForEvent(event: 'close', options?: { timeout?: number }): Promise<unknown>;
};

type ProbeWindow = Window & { __probe?: string };

const FIXTURE = path.resolve(import.meta.dirname, '..');
const STORY_FILE = path.join(FIXTURE, 'src/Button.stories.tsx');
const PREVIEW_FILE = path.join(FIXTURE, '.storybook/preview.ts');
const VITE_CONFIG_FILE = path.join(FIXTURE, 'vite.config.ts');

const ORIGINAL_STORY_FILE = readFileSync(STORY_FILE, 'utf8');
const ORIGINAL_PREVIEW_FILE = readFileSync(PREVIEW_FILE, 'utf8');
const ORIGINAL_VITE_CONFIG_FILE = readFileSync(VITE_CONFIG_FILE, 'utf8');

test.afterEach(async ({ request }) => {
  await restoreFile(STORY_FILE, ORIGINAL_STORY_FILE);
  await restoreFile(PREVIEW_FILE, ORIGINAL_PREVIEW_FILE);
  await restoreFile(VITE_CONFIG_FILE, ORIGINAL_VITE_CONFIG_FILE);

  await expect
    .poll(
      async () => {
        try {
          const response = await request.get('/__storybook/index.json');
          return response.ok();
        } catch {
          return false;
        }
      },
      { timeout: 30_000 }
    )
    .toBe(true);
});

test('the app itself is served at the root', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Vite + React + Storybook plugin' })
  ).toBeVisible();
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

test('a story edit updates the preview without reloading the app tab', async ({ context }) => {
  const originalStory = await readFile(STORY_FILE, 'utf8');
  const originalPreview = await readFile(PREVIEW_FILE, 'utf8');

  const appPage = await context.newPage();
  const managerPage = await context.newPage();
  const preview = managerPage.frameLocator('#storybook-preview-iframe');

  try {
    await appPage.goto('/');
    await appPage.evaluate(() => {
      (window as ProbeWindow).__probe = 'alive';
    });

    await managerPage.goto('/__storybook/?path=/story/example-button--primary');
    await expect(preview.getByRole('button', { name: 'Button' })).toBeVisible();
    await managerPage.waitForTimeout(500);

    await writeFile(STORY_FILE, originalStory.replace("label: 'Button',", "label: 'Button HMR',"));

    await expect(preview.getByRole('button', { name: 'Button HMR' })).toBeVisible({
      timeout: 15_000,
    });
    await expect
      .poll(async () => appPage.evaluate(() => (window as ProbeWindow).__probe))
      .toBe('alive');

    await writeFile(PREVIEW_FILE, `${originalPreview}\n// hmr probe\n`);
    await managerPage.waitForTimeout(1_500);
    await expect
      .poll(async () => appPage.evaluate(() => (window as ProbeWindow).__probe))
      .toBe('alive');
  } finally {
    await restoreFile(STORY_FILE, originalStory);
    await restoreFile(PREVIEW_FILE, originalPreview);
    await expect(preview.getByRole('button', { name: 'Button' })).toBeVisible({
      timeout: 15_000,
    });
  }
});

test('a syntax error in a story shows the overlay in the preview only', async ({ context }) => {
  const originalStory = await readFile(STORY_FILE, 'utf8');

  const managerPage = await context.newPage();
  const appPage = await context.newPage();
  const preview = managerPage.frameLocator('#storybook-preview-iframe');

  try {
    await managerPage.goto('/__storybook/?path=/story/example-button--primary');
    await expect(preview.getByRole('button', { name: 'Button' })).toBeVisible();

    await appPage.goto('/');
    await appPage.evaluate(() => {
      (window as ProbeWindow).__probe = 'alive';
    });

    await writeFile(STORY_FILE, `${originalStory}\nexport const = ;\n`);

    await expect(preview.locator('vite-error-overlay')).toBeVisible({ timeout: 15_000 });
    await expect(appPage.locator('vite-error-overlay')).toHaveCount(0);
    await expect
      .poll(async () => appPage.evaluate(() => (window as ProbeWindow).__probe))
      .toBe('alive');
  } finally {
    await restoreFile(STORY_FILE, originalStory);
    await expect(preview.locator('vite-error-overlay')).toHaveCount(0, { timeout: 15_000 });
    await expect(preview.getByRole('button', { name: 'Button' })).toBeVisible({
      timeout: 15_000,
    });
  }
});

test('served modules carry sourcemaps and unknown modules are not the host page', async ({
  request,
}) => {
  const storyResponse = await request.get('/__storybook/src/Button.stories.tsx');
  expect(storyResponse.ok()).toBeTruthy();
  expect(await storyResponse.text()).toContain('//# sourceMappingURL=');

  const missingResponse = await request.get('/__storybook/src/does-not-exist.ts');
  expect(missingResponse.status()).toBe(404);

  const clientResponse = await request.get('/__storybook/@vite/client');
  expect(clientResponse.ok()).toBeTruthy();
  const clientBody = await clientResponse.text();
  expect(clientBody).toContain('"/__storybook/"');
  expect(clientBody).toContain('__storybook-hmr');

  const iframeResponse = await request.get('/__storybook/iframe.html');
  expect(iframeResponse.ok()).toBeTruthy();
  const iframeBody = await iframeResponse.text();
  expect(iframeBody).toContain(
    'src="/__storybook/@id/__x00__virtual:/@storybook/builder-vite/vite-app.js"'
  );
  expect(iframeBody).toContain('src="/__storybook/vite-inject-mocker-entry.js"');
  expect(iframeBody).toContain('@react-refresh');
});

test('the plugin survives a host server restart', async ({ page, request }) => {
  const originalStory = await readFile(STORY_FILE, 'utf8');
  const originalViteConfig = await readFile(VITE_CONFIG_FILE, 'utf8');
  const channelSockets: ChannelSocket[] = [];

  page.on('websocket', (socket) => {
    if (socket.url().includes('storybook-server-channel')) {
      channelSockets.push(socket);
    }
  });

  try {
    await page.goto('/__storybook/?path=/story/example-button--primary');
    const preview = page.frameLocator('#storybook-preview-iframe');
    await expect(preview.getByRole('button', { name: 'Button' })).toBeVisible();
    await expect
      .poll(() => channelSockets.filter((socket) => !socket.isClosed()).length)
      .toBeGreaterThan(0);
    const openBeforeRestart = channelSockets.filter((socket) => !socket.isClosed());
    const countBeforeRestart = channelSockets.length;

    await writeFile(VITE_CONFIG_FILE, `${originalViteConfig}\n`);
    await Promise.all(openBeforeRestart.map((socket) => socket.waitForEvent('close')));

    await expect
      .poll(
        async () => {
          try {
            const response = await request.get('/__storybook/index.json');
            return response.ok();
          } catch {
            return false;
          }
        },
        { timeout: 30_000 }
      )
      .toBe(true);

    await page.reload();
    await expect(preview.getByRole('button', { name: 'Button' })).toBeVisible({
      timeout: 15_000,
    });
    await expect.poll(() => channelSockets.length).toBeGreaterThan(countBeforeRestart);

    const restarted = channelSockets[channelSockets.length - 1];
    expect(restarted.isClosed()).toBe(false);
    await page.waitForTimeout(2_000);
    expect(restarted.isClosed()).toBe(false);

    await writeFile(
      STORY_FILE,
      originalStory.replace("label: 'Button',", "label: 'Button after restart',")
    );
    await expect(preview.getByRole('button', { name: 'Button after restart' })).toBeVisible({
      timeout: 15_000,
    });
  } finally {
    await restoreFile(STORY_FILE, originalStory);
    const restoredViteConfig = await restoreFile(VITE_CONFIG_FILE, originalViteConfig);

    if (restoredViteConfig) {
      await Promise.all(
        channelSockets
          .filter((socket) => !socket.isClosed())
          .map((socket) => socket.waitForEvent('close', { timeout: 30_000 }))
      );

      await expect
        .poll(
          async () => {
            try {
              const response = await request.get('/__storybook/index.json');
              return response.ok();
            } catch {
              return false;
            }
          },
          { timeout: 30_000 }
        )
        .toBe(true);
    }
  }
});

async function restoreFile(file: string, original: string): Promise<boolean> {
  if ((await readFile(file, 'utf8')) !== original) {
    await writeFile(file, original);
    return true;
  }

  return false;
}
