import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import process from 'process';

import { PREVIEW_STORY_TIMEOUT, waitForPreviewReady } from './helpers.ts';

/**
 * "Open in isolation mode" must carry every args pair of the manager's address into the link it
 * opens, including an arg set to the empty string (`label:`). Regression coverage for #36356 (fixed
 * in #36973 at the unit level, `parseSerializedParam`); these tests cover the same contract through
 * the UI a person uses.
 */

const storybookUrl = (process.env.STORYBOOK_URL || 'http://localhost:6006').replace(/\/+$/, '');

/** Example/Button Primary, args `primary: true, label: 'Button'`. */
const STORY_ID = 'example-button--primary';

const OPENED_TAB_TIMEOUT = 10_000;

/** The args part of a URL as a sorted list of `name:value` pairs. Throws on a URL it cannot parse. */
function argsPairs(url: string): string[] {
  const args = new URL(url).searchParams.get('args');
  return args ? args.split(';').sort() : [];
}

/** Opens the story with `addressArgs` in the manager's address and waits until the manager keeps it. */
async function openStoryWithArgs(page: Page, addressArgs: string): Promise<void> {
  await page.goto(
    `${storybookUrl}/?path=/story/${STORY_ID}${addressArgs ? `&args=${addressArgs}` : ''}`
  );
  await waitForPreviewReady(page);
  await expect(page.getByRole('button', { name: 'Open in isolation mode' })).toBeVisible({
    timeout: PREVIEW_STORY_TIMEOUT,
  });
  await expect
    .poll(() => argsPairs(page.url()), { timeout: PREVIEW_STORY_TIMEOUT })
    .toEqual(addressArgs ? addressArgs.split(';').sort() : []);
}

/** Records each href passed to window.open instead of opening a tab. */
async function recordWindowOpen(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as any).__openedHrefs = [];
    (window as any).open = (href?: string) => {
      (window as any).__openedHrefs.push(String(href ?? ''));
      return null;
    };
  });
}

async function hrefOfIsolationModeClick(page: Page): Promise<string> {
  const before = await page.evaluate(() => (window as any).__openedHrefs.length);
  await page.getByRole('button', { name: 'Open in isolation mode' }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__openedHrefs.length))
    .toBeGreaterThan(before);
  return page.evaluate(() => (window as any).__openedHrefs.at(-1));
}

async function openInIsolationMode(page: Page, context: BrowserContext): Promise<Page> {
  const [opened] = await Promise.all([
    context.waitForEvent('page', { timeout: OPENED_TAB_TIMEOUT }),
    page.getByRole('button', { name: 'Open in isolation mode' }).click(),
  ]);
  await expect.poll(() => opened.url(), { timeout: OPENED_TAB_TIMEOUT }).toContain(`id=${STORY_ID}`);
  return opened;
}

test.describe('open in isolation mode', () => {
  test.setTimeout(120_000);

  test('carries every args pair of the address into the link, empty values included', async ({
    page,
  }) => {
    const cases = [
      '', // no args: the link has no args part
      'label:', // the Label control cleared
      'label:Ship',
      'primary:!false',
      'label:;primary:!false', // an empty value next to a non-empty one
      'backgroundColor:red;label:',
    ];
    await recordWindowOpen(page);

    const dropped: string[] = [];
    for (const addressArgs of cases) {
      await openStoryWithArgs(page, addressArgs);
      const href = await hrefOfIsolationModeClick(page);
      const missing = argsPairs(page.url()).filter((pair) => !argsPairs(href).includes(pair));
      if (missing.length > 0) {
        dropped.push(`${addressArgs}: dropped ${missing.join(';')} from ${href}`);
      }
      if (addressArgs === '' && new URL(href).searchParams.has('args')) {
        dropped.push(`(no args): link has an args part: ${href}`);
      }
    }

    // One assertion for all cases, so a failure names every pair that was lost.
    expect(dropped).toEqual([]);
  });

  test('a cleared Label renders as an empty button in the opened tab', async ({
    page,
    context,
  }) => {
    await openStoryWithArgs(page, 'label:');

    const opened = await openInIsolationMode(page, context);

    expect(argsPairs(opened.url())).toContain('label:');
    const button = opened.getByRole('button').first();
    await expect(button).toBeVisible({ timeout: OPENED_TAB_TIMEOUT });
    await expect(button).toHaveText('');
  });

  test('a non-empty Label still renders in the opened tab', async ({ page, context }) => {
    await openStoryWithArgs(page, 'label:Ship');

    const opened = await openInIsolationMode(page, context);

    expect(argsPairs(opened.url())).toContain('label:Ship');
    await expect(opened.getByRole('button', { name: 'Ship', exact: true })).toBeVisible({
      timeout: OPENED_TAB_TIMEOUT,
    });
  });
});
