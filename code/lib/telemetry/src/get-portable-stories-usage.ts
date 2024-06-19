import { readFile } from 'fs/promises';
import { join } from 'path';
import { glob } from 'glob';

import { createFileSystemCache, resolvePathInStorybookCache } from '@storybook/core-common';

const cache = createFileSystemCache({
  basePath: resolvePathInStorybookCache('portable-stories'),
  ns: 'storybook',
  ttl: 24 * 60 * 60 * 1000,
});

export const containsPortableStories = async (filename: string) => {
  if (/sb\-preview\/runtime.m?js$/i.test(filename)) return null;

  const fileContent = await readFile(filename, 'utf-8');
  const contains = /composeStor[y|ies]/g.test(fileContent);
  return contains ? filename : null;
};

export const getPortableStoriesFiles = async (base: string) => {
  const files = await glob('**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}', {
    ignore: ['**/node_modules/**', '**/storybook-static/**', '**/dist/**'],
    dot: true,
    cwd: base,
  });

  const hits = [];
  const chunkSize = 10;
  for (let i = 0; i < files.length; i += chunkSize) {
    const chunk = files.slice(i, i + chunkSize);
    const results = (
      await Promise.all(chunk.map((f: string) => containsPortableStories(join(base, f))))
    ).filter(Boolean);
    if (results.length > 0) {
      hits.push(...results);
    }
  }
  return hits as string[];
};

const CACHE_KEY = 'portableStories';
export const getPortableStoriesFileCount = async () => {
  let cached = await cache.get(CACHE_KEY);
  if (!cached) {
    const files = await getPortableStoriesFiles(process.cwd());
    cached = { usage: files.length };
    await cache.set(CACHE_KEY, cached);
  }
  return cached.usage;
};
