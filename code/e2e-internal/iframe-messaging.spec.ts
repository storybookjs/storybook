import { expect, type Frame, type Page, test } from '@playwright/test';
import process from 'process';

import { waitForPreviewReady } from './helpers.ts';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';
const runsAgainstDevServer = !['build', 'static'].includes(process.env.STORYBOOK_TYPE || 'dev');

const STORY_PATH = '/story/core-basics--basic';

// Playwright answers every request to this host, which gives the tests a page on another origin.
const FOREIGN_URL = 'http://foreign.test/';
const FOREIGN_PAGE = `<!doctype html><script>
  window.received = [];
  addEventListener('message', (event) => window.received.push(String(event.data)));
</script>`;

declare global {
  interface Window {
    __STORYBOOK_ADDONS_CHANNEL__: {
      emit: (type: string, ...args: unknown[]) => void;
      on: (type: string, listener: (...args: unknown[]) => void) => void;
    };
    received: string[];
  }
}

const getIframeContent = async (page: Page, selector: string): Promise<Frame> => {
  const frame = await (await page.locator(selector).elementHandle())?.contentFrame();
  if (!frame) {
    throw new Error(`${selector} has no content frame`);
  }
  return frame;
};

test.describe('iframe messaging', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`${FOREIGN_URL}**`, (route) =>
      route.fulfill({ contentType: 'text/html', body: FOREIGN_PAGE })
    );
    await page.goto(`${storybookUrl}/?path=${STORY_PATH}`);
    await waitForPreviewReady(page);
  });

  test('the manager ignores channel messages from a window it did not render', async ({ page }) => {
    await page.evaluate((url) => {
      window.received = [];
      window.__STORYBOOK_ADDONS_CHANNEL__.on('e2e-probe', (from: unknown) =>
        window.received.push(String(from))
      );

      const iframe = document.createElement('iframe');
      iframe.id = 'e2e-foreign-iframe';
      iframe.src = url;
      document.body.append(iframe);
    }, FOREIGN_URL);
    const foreignFrame = await getIframeContent(page, '#e2e-foreign-iframe');
    await foreignFrame.waitForURL(FOREIGN_URL);

    const rejection = page.waitForEvent('console', {
      predicate: (message) => message.text().includes('not a registered preview iframe'),
      timeout: 5000,
    });
    await foreignFrame.evaluate(() =>
      window.parent.postMessage(
        JSON.stringify({
          key: 'storybook-channel',
          event: { type: 'e2e-probe', args: ['foreign'] },
        }),
        '*'
      )
    );
    await rejection;

    const previewFrame = await getIframeContent(page, '#storybook-preview-iframe');
    await previewFrame.evaluate(() =>
      window.__STORYBOOK_ADDONS_CHANNEL__.emit('e2e-probe', 'preview')
    );

    await expect.poll(() => page.evaluate(() => window.received)).toStrictEqual(['preview']);
  });

  test('a preview iframe that navigated to another origin stops receiving manager events', async ({
    page,
  }) => {
    test.skip(!runsAgainstDevServer, 'A built manager addresses its messages to any origin');

    const previewFrame = await getIframeContent(page, '#storybook-preview-iframe');
    await previewFrame.evaluate(() => {
      window.received = [];
      window.__STORYBOOK_ADDONS_CHANNEL__.on('e2e-probe', (value: unknown) =>
        window.received.push(String(value))
      );
    });
    await page.evaluate(() => window.__STORYBOOK_ADDONS_CHANNEL__.emit('e2e-probe', 'before'));
    await expect.poll(() => previewFrame.evaluate(() => window.received)).toStrictEqual(['before']);

    // Like a link clicked inside a story, this leaves the iframe's src attribute unchanged.
    await previewFrame.goto(FOREIGN_URL);

    await page.evaluate(() => {
      window.__STORYBOOK_ADDONS_CHANNEL__.emit('e2e-probe', 'after');
      // Messages between two windows arrive in order, so the probe would have arrived first.
      document
        .querySelector<HTMLIFrameElement>('#storybook-preview-iframe')
        ?.contentWindow?.postMessage('sentinel', '*');
    });

    await expect.poll(() => previewFrame.evaluate(() => window.received)).toContain('sentinel');
    const received = await previewFrame.evaluate(() => window.received);
    expect(received.filter((message) => message.includes('storybook-channel'))).toStrictEqual([]);
  });
});
