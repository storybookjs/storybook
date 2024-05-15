import fs from 'node:fs/promises';

import type { IndexInput, IndexerOptions } from '@storybook/types';
import { preprocess } from 'svelte/compiler';

import { loadSvelteConfig } from './svelte/config-loader.js';
import type { StoriesFileMeta } from '../parser/types.js';
import { extractStories } from '../parser/extract-stories.js';

export async function readStories(fileName: string): Promise<StoriesFileMeta> {
  let code = (await fs.readFile(fileName, { encoding: 'utf8' })).toString();

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

// FIXME: Still want to support it?
/**
 * Indexer for Storybook < 7.4
 */
// export async function svelteIndexer(
// 	fileName: string,
// 	{ makeTitle }: IndexerOptions,
// ): Promise<IndexedCSFFile> {
// 	const storiesFileMeta = await readStories(fileName);
// 	const { fragment, module } = storiesFileMeta;
// 	const { stories } = fragment;
//
// 	return {
// 		meta: {
// 			id: module.id,
// 			title: makeTitle(module.title),
// 			tags: module.tags,
// 		},
// 		stories: Object.entries(stories).map(([storyId, storyMeta]) => {
// 			return {
// 				id: toId(
// 					module.id || module.title || storyId,
// 					storyNameFromExport(module?.id || storyId),
// 				),
// 				name: storyMeta.name,
// 			};
// 		}),
// 	};
// }
