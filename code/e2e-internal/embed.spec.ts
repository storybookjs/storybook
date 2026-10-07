import { type Server, createServer } from 'http';
import type { AddressInfo } from 'net';
import process from 'process';

import { expect, test } from '@playwright/test';

import { runTools, runsAgainstDevServer } from './helpers.ts';

const STORY_ID = 'components-badge--default';
const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';

test.describe('story embeds in a sandboxed frame', () => {
  test.skip(!runsAgainstDevServer, 'Only the dev server serves an embed origin.');
  test.setTimeout(90_000);

  let host: Server;

  // Agent apps serve agent-authored pages with this policy, which gives the page an opaque origin.
  test.beforeAll(async () => {
    host = createServer((req, res) => {
      const src = new URL(req.url!, 'http://host').searchParams.get('src');
      res.writeHead(200, {
        'content-type': 'text/html',
        'content-security-policy': 'sandbox allow-scripts allow-forms allow-popups',
      });
      res.end(`<iframe src="${src}" style="width:600px;height:200px"></iframe>`);
    });
    await new Promise<void>((resolve) => host.listen(0, '127.0.0.1', resolve));
  });

  test.afterAll(() => {
    host.close();
  });

  const sandboxedPage = (src: string) =>
    `http://127.0.0.1:${(host.address() as AddressInfo).port}/?src=${encodeURIComponent(src)}`;

  test('renders a story through its embed URL, with working storage and fetches', async ({
    page,
  }) => {
    const { output } = await runTools([
      '--attach',
      'stories',
      'embed',
      '--stories',
      JSON.stringify([{ storyId: STORY_ID }]),
    ]);
    const embedUrl = output.split('\n').find((line) => line.includes('.localhost'));
    await page.goto(sandboxedPage(embedUrl!));

    const story = page.frameLocator('iframe');
    await expect(story.locator('#storybook-root')).toContainText('Default');

    expect(
      await story.locator('body').evaluate(async () => {
        localStorage.setItem('embed', 'local');
        sessionStorage.setItem('embed', 'session');
        document.cookie = 'embed=cookie';
        return {
          localStorage: localStorage.getItem('embed'),
          sessionStorage: sessionStorage.getItem('embed'),
          cookie: document.cookie,
          fetchOk: (await fetch('/index.json')).ok,
        };
      })
    ).toStrictEqual({
      localStorage: 'local',
      sessionStorage: 'session',
      cookie: '',
      fetchOk: true,
    });
  });

  test('keeps the story blank through its normal URL', async ({ page }) => {
    const blocked = page.waitForEvent('console', (message) =>
      message.text().includes('blocked by CORS policy')
    );
    await page.goto(sandboxedPage(`${storybookUrl}/iframe.html?id=${STORY_ID}&viewMode=story`));

    await blocked;
    await expect(page.frameLocator('iframe').locator('#storybook-root')).toBeEmpty();
  });
});
