/// <reference lib="dom" />
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

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
  await mkdir(dirName, { recursive: true });

  const filePath = join(dirName, fileName);
  const existing = await readFile(filePath, 'utf8')
    .then((txt) => JSON.parse(txt))
    .catch(() => ({}));

  const merged = { ...existing, ...data };
  await writeFile(filePath, JSON.stringify(merged, null, 2), 'utf8');
};

export const loadBench = async (options: SaveBenchOptions): Promise<Partial<BenchResults>> => {
  const dirName = join(options.rootDir || process.cwd(), 'bench');
  const files = await readdir(dirName);
  return files.reduce(async (acc, fileName) => {
    const content = await readFile(join(dirName, fileName), 'utf8');
    const data = JSON.parse(content);
    return { ...(await acc), ...data };
  }, Promise.resolve({}));
  // return readJSON(join(dirname, `bench.json`));
};

export async function getPreviewPage(page: Page) {
  /**
   * Fix flakiness in preview iframe retrieval Sometimes the iframe is not yet available when we try
   * to access it, even after waiting for the readyState to be complete.
   *
   * This loop will keep trying to access the iframe until it's available.
   */
  for (let i = 0; i < 10; i++) {
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
