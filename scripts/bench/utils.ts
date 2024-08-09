import { ensureDir, readJSON, readdir, writeJSON } from 'fs-extra';
import { join } from 'path';
import type { Page } from 'playwright-core';

import type { BenchResults } from './types';

export const now = () => new Date().getTime();

export interface SaveBenchOptions {
  rootDir?: string;
}

export const saveBench = async (
  key: string,
  data: Partial<BenchResults>,
  options: SaveBenchOptions
) => {
  const dirName = join(options.rootDir || process.cwd(), 'bench');
  const fileName = `${key}.json`;
  const existing = await ensureDir(dirName).then(() => {
    return readJSON(join(dirName, fileName)).catch(() => ({}));
  });
  await writeJSON(join(dirName, fileName), { ...existing, ...data }, { spaces: 2 });
};

export const loadBench = async (options: SaveBenchOptions): Promise<Partial<BenchResults>> => {
  const dirName = join(options.rootDir || process.cwd(), 'bench');
  const files = await readdir(dirName);
  return files.reduce(async (acc, fileName) => {
    const data = await readJSON(join(dirName, fileName));
    return { ...(await acc), ...data };
  }, Promise.resolve({}));
  // return readJSON(join(dirname, `bench.json`));
};

export async function getPreviewPage(page: Page) {
  /**
   * Fix flakiness in preview iframe retrieval
   * Sometimes the iframe is not yet available when we try to access it,
   * even after waiting for the readyState to be complete.
   *
   * This loop will keep trying to access the iframe until it's available.
   */
  for (let i = 0; i < 10; i++) {
    // eslint-disable-next-line @typescript-eslint/no-loop-func
    await page.waitForFunction(() => {
      return document.querySelector('iframe')?.contentDocument.readyState === 'complete';
    });

    const previewPage = page.frame({ url: /iframe.html/ })?.page();
    if (previewPage) {
      return previewPage;
    }
  }

  throw new Error('The preview iframe was never found');
}
