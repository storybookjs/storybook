import { extractStories } from '../parser/extract-stories';
import fs from 'fs-extra';

export async function svelteIndexer(fileName, { makeTitle }) {
  let code = (await fs.readFile(fileName, 'utf-8')).toString();

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
