import fs from 'fs-extra';
import * as svelte from 'svelte/compiler';
import { extractStories } from '../parser/extract-stories';
import { loadSvelteConfig } from '../config-loader';

export async function svelteIndexer(fileName, { makeTitle }) {
  let code = (await fs.readFile(fileName, 'utf-8')).toString();
  const svelteOptions = await loadSvelteConfig();

  if (svelteOptions && svelteOptions.preprocess) {
    code = (await svelte.preprocess(code, svelteOptions.preprocess, { filename: fileName })).code;
  }

  const defs = extractStories(code);

  return {
    meta: { title: makeTitle(defs.meta.title) },
    stories: Object.entries(defs.stories)
      .filter(([id, story]) => !story.template)
      .map(([id, story]) => ({
        id: story.storyId,
        name: story.name,
      })),
  };
}
