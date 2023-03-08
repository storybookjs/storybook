import * as svelte from 'svelte/compiler';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import { extractStories } from '../parser/extract-stories';

export async function svelteIndexer(fileName, { makeTitle }) {
  let code = (await fs.readFile(fileName, 'utf-8')).toString();
  const optionsPath = await findUp('svelte.config.js');

  if (optionsPath) {
    const { default: svelteOptions } = await import(`file:///${optionsPath}`);
    if (svelteOptions && svelteOptions.preprocess) {
      code = (await svelte.preprocess(code, svelteOptions.preprocess, { filename: fileName })).code;
    }
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

async function findUp(name) {
  const importPath = fileURLToPath(import.meta.url);
  const chunks = path.dirname(importPath).split(path.sep);

  while (chunks.length) {
    const filePath = path.resolve(chunks.join(path.posix), `../${name}`);
    const pathExist = fs.pathExists(filePath, name);

    if (pathExist) {
      return filePath;
    }

    chunks.pop();
  }

  return '';
}
