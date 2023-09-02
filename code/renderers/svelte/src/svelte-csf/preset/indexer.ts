import * as svelte from 'svelte/compiler';

import { extractStories } from '../parser/extract-stories.js';
import fs from 'fs-extra';
import { loadSvelteConfig } from '../config-loader.js';
import { storyNameFromExport, toId } from '@storybook/csf';

export async function svelteIndexer(fileName, { makeTitle }) {
  let code = (await fs.readFile(fileName, 'utf-8')).toString();
  const svelteOptions = await loadSvelteConfig();

  if (svelteOptions && svelteOptions.preprocess) {
    code = (await svelte.preprocess(code, svelteOptions.preprocess, { filename: fileName })).code;
  }

  const defs = extractStories(code);
  const meta = { ...defs.meta, title: makeTitle(defs.meta.title) };
  return {
    meta,
    stories: Object.entries(defs.stories)
      .filter(([id, story]) => !story.template)
      .map(([id, story]) => ({
        id: toId(meta.id || meta.title || id, storyNameFromExport(id)),
        name: story.name,
      })),
  };
}
