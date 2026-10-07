import { execFile } from 'child_process';
import { type Server, createServer } from 'http';
import type { AddressInfo } from 'net';
import { join } from 'path';
import process from 'process';
import { promisify } from 'util';

import { expect, test } from '@playwright/test';

const execFileAsync = promisify(execFile);
const dispatcher = join(process.cwd(), 'core/dist/bin/dispatcher.js');
const runsAgainstDevServer = !['build', 'static'].includes(process.env.STORYBOOK_TYPE || 'dev');

const STORY_ID = 'components-badge--default';

async function getEmbedUrl() {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      dispatcher,
      'tools',
      '--attach',
      'stories',
      'embed',
      '--stories',
      JSON.stringify([{ storyId: STORY_ID }]),
    ],
    { env: { ...process.env, STORYBOOK_DISABLE_TELEMETRY: '1' }, timeout: 60_000 }
  );
  const embedUrl = stdout.split('\n').find((line) => line.includes('.localhost'));
  if (!embedUrl) {
    throw new Error(`\`stories embed\` printed no embed URL:\n${stdout}`);
  }
  return embedUrl.trim();
}

test.describe('story embeds in a sandboxed frame', () => {
  test.skip(!runsAgainstDevServer, 'Only the dev server serves an embed origin.');
  test.setTimeout(90_000);

  let host: Server;
  let frameSrc: string;

  // Agent apps serve agent-authored pages with this policy, which gives the page an opaque origin.
  test.beforeAll(async () => {
    host = createServer((_req, res) => {
      res.writeHead(200, {
        'content-type': 'text/html',
        'content-security-policy': 'sandbox allow-scripts allow-forms allow-popups',
      });
      res.end(`<iframe src="${frameSrc}" style="width:600px;height:200px"></iframe>`);
    });
    await new Promise<void>((resolve) => host.listen(0, '127.0.0.1', resolve));
  });

  test.afterAll(() => {
    host.close();
  });

  const hostUrl = () => `http://127.0.0.1:${(host.address() as AddressInfo).port}/`;

  test('renders a story through its embed URL, with working storage and fetches', async ({
    page,
  }) => {
    frameSrc = await getEmbedUrl();
    await page.goto(hostUrl());

    const story = page.frameLocator('iframe');
    await expect(story.locator('#storybook-root')).toContainText('Default');

    const frame = page.frame({ url: /\.localhost/ })!;
    expect(
      await frame.evaluate(() => {
        localStorage.setItem('embed', 'local');
        sessionStorage.setItem('embed', 'session');
        return [localStorage.getItem('embed'), sessionStorage.getItem('embed')];
      })
    ).toStrictEqual(['local', 'session']);
    expect(await frame.evaluate(() => fetch('/index.json').then((response) => response.ok))).toBe(
      true
    );
  });

  test('keeps the story blank through its normal URL', async ({ page }) => {
    const normalUrl = new URL(await getEmbedUrl());
    normalUrl.hostname = 'localhost';
    frameSrc = normalUrl.href;
    const blocked = page.waitForEvent('console', (message) =>
      message.text().includes('blocked by CORS policy')
    );
    await page.goto(hostUrl());

    await blocked;
    await expect(page.frameLocator('iframe').locator('#storybook-root')).toBeEmpty();
  });
});
