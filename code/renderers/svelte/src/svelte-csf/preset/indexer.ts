import fs from 'node:fs/promises';
<<<<<<< Updated upstream

import { storyNameFromExport, toId } from '@storybook/csf';
import type { IndexInput, IndexedCSFFile, IndexerOptions } from '@storybook/types';
import * as svelte from 'svelte/compiler';

import { extractStories } from '../parser/extract-stories.js';
import { loadSvelteConfig } from '../config-loader.js';
=======

import { storyNameFromExport, toId } from '@storybook/csf';
import type { IndexInput, IndexedCSFFile, IndexerOptions } from '@storybook/types';
import { preprocess } from 'svelte/compiler';

import { loadSvelteConfig } from '../config-loader.js';
import { extractStories } from '../parser/extract-stories.js';

import type { StoriesFileMeta } from 'src/parser/types.js';

export async function readStories(fileName: string): Promise<StoriesFileMeta> {
  let code = (await fs.readFile(fileName, { encoding: 'utf8' })).toString();
>>>>>>> Stashed changes

  const svelteOptions = await loadSvelteConfig();

  if (svelteOptions && svelteOptions.preprocess) {
    code = (
      await preprocess(code, svelteOptions.preprocess, {
        filename: fileName,
      })
    ).code;
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
  const storiesFileMeta = await readStories(fileName);
  const { stories } = storiesFileMeta;

  return {
    meta: {
      id: storiesFileMeta.id,
      title: makeTitle(storiesFileMeta.title),
      tags: storiesFileMeta.tags,
    },
    stories: Object.entries(stories).map(([storyId, storyMeta]) => {
      return {
        id: toId(
          storiesFileMeta.id || storiesFileMeta.title || storyId,
          storyNameFromExport(storiesFileMeta?.id || storyId)
        ),
        name: storyMeta.name,
      };
    }),
  };
}

/**
 * Indexer for Storybook >= 7.4
 */
export async function createIndex(
  fileName: string,
  { makeTitle }: IndexerOptions
): Promise<IndexInput[]> {
  const storiesFileMeta = await readStories(fileName);
  const { stories } = storiesFileMeta;

  return Object.entries(stories).map(([storyId, storyMeta]) => {
    return {
      type: 'story',
      importPath: fileName,
      exportName: storyId,
      name: storyMeta.name,
      title: makeTitle(storiesFileMeta.title),
      tags: storiesFileMeta.tags,
      metaTags: storiesFileMeta.tags,
    };
  });
}
