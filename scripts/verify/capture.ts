// Playwright-based story capture for the PR verify harness.

import { chromium, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { SbPage } from '../../code/e2e-tests/util.ts';
import type { CaptureResult, RunPaths } from './core.ts';

export async function capture(opts: {
  baseURL: string;
  storyId: string;
  runPaths: RunPaths;
  controller?: AbortController;
}): Promise<CaptureResult> {
  const { baseURL, storyId, runPaths, controller } = opts;

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  // Listeners MUST be registered before goto.
  page.on('pageerror', (err) => pageErrors.push(err.stack || err.message || String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  let errorDisplayHidden = true;
  let previewHasChildren = false;

  try {
    if (controller?.signal.aborted) throw new DOMException('Aborted', 'AbortError');

    await page.goto(`${baseURL}/?path=/story/${storyId}`);

    if (controller?.signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const sbPage = new SbPage(page, expect);
    await sbPage.waitUntilLoaded();

    if (controller?.signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const errEl = page.locator('#sb-errordisplay');
    errorDisplayHidden = (await errEl.count()) === 0 || !(await errEl.isVisible());

    const previewIframe = page.frameLocator('#storybook-preview-iframe');
    previewHasChildren =
      (await previewIframe.locator('#storybook-root > *, #root > *').count()) > 0;

    if (controller?.signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const iframe = page.locator('#storybook-preview-iframe');
    await iframe.screenshot({ path: runPaths.screenshotManager });
  } finally {
    await context.close();
    await browser.close();
  }

  await writeFile(
    runPaths.consoleLog,
    JSON.stringify({ pageErrors, consoleErrors }, null, 2) + '\n'
  );

  return {
    pageErrors,
    consoleErrors,
    errorDisplayHidden,
    previewHasChildren,
    screenshotPath: runPaths.screenshotManager,
  };
}
