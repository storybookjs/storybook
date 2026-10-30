import { fileURLToPath } from 'node:url';

import { createStorybook } from 'storybook/internal/instance';

/** One story, as an agent needs it to open or edit the file. */
export interface StoryMatch {
  id: string;
  title: string;
  name: string;
  importPath: string;
}

/** Stories whose title or name contains `query`, case-insensitively. */
export async function findStories(query: string, configDir = '.storybook'): Promise<StoryMatch[]> {
  const storybook = createStorybook({ configDir, mode: 'headless' });
  await storybook.ready();
  try {
    const { entries } = await storybook.getIndex();
    const needle = query.toLowerCase();
    return Object.values(entries)
      .filter((entry) => entry.type === 'story')
      .filter((entry) => `${entry.title} ${entry.name}`.toLowerCase().includes(needle))
      .map(({ id, title, name, importPath }) => ({ id, title, name, importPath }));
  } finally {
    await storybook.close();
  }
}

// Run as a CLI only when executed directly, not when an agent host imports `findStories`.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await findStories(process.argv[2] ?? ''), null, 2));
}
