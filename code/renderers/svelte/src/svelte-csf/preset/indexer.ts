import fs from 'node:fs/promises';

import { storyNameFromExport, toId } from '@storybook/csf';
import type { IndexInput, IndexedCSFFile, IndexerOptions } from '@storybook/types';
import * as svelte from 'svelte/compiler';

import { extractStories } from '../parser/extract-stories.js';
import { loadSvelteConfig } from '../config-loader.js';

export async function readStories(fileName: string) {
  let code = (await fs.readFile(fileName, 'utf-8')).toString();
  const loadedSvelteOptions = await loadSvelteConfig()

  /**
   * loadedSvelteOptions can be {default: {...}, configFile: '...path'}
   */
  const svelteOptions = loadedSvelteOptions.default ? loadedSvelteOptions.default : loadedSvelteOptions;

  if (svelteOptions && svelteOptions.preprocess) {
    code = (await svelte.preprocess(code, svelteOptions.preprocess, { filename: fileName })).code;
  }

  return extractStories(code);
}

/**
 * Indexer for Storybook < 7.4
 */
export async function svelteIndexer(
  fileName: string,
  { makeTitle }: IndexerOptions
): Promise<IndexedCSFFile> {
  const defs = await readStories(fileName);

  const meta = { ...defs.meta, title: makeTitle(defs.meta.title) };

  return {
    meta,
    stories: Object.entries(defs.stories)
      .filter(([, story]) => !story.template)
      .map(([id, story]) => ({
        id: toId(meta.id || meta.title || id, storyNameFromExport(id)),
        name: story.name,
      })),
  };
}

/**
 * Indexer for Storybook >= 7.4
 */
export async function createIndex(
  fileName: string,
  { makeTitle }: IndexerOptions
): Promise<IndexInput[]> {
  const defs = await readStories(fileName);

  return Object.entries(defs.stories)
    .filter(([, story]) => !story.template)
    .map(([id, story]) => ({
      type: 'story',
      importPath: fileName,
      exportName: id,
      name: story.name,
      title: makeTitle(defs.meta.title),
      tags: defs.meta.tags,
      metaTags: defs.meta.tags,
    }));
}
