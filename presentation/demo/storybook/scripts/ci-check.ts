import { readdir } from 'node:fs/promises';

import { createStorybook } from 'storybook/internal/instance';

/** Component files under `src/` that no story renders as its `component`. */
export async function findUnstoriedComponents(configDir: string): Promise<string[]> {
  const storybook = createStorybook({ configDir, mode: 'headless' });
  await storybook.ready();
  try {
    const { entries } = await storybook.getIndex();
    const covered = new Set(
      Object.values(entries).map((entry) =>
        entry.type === 'story' ? entry.componentPath : undefined
      )
    );
    const files = await readdir('src');
    return files
      .filter((file) => file.endsWith('.tsx') && !file.endsWith('.stories.tsx'))
      .map((file) => `./src/${file}`)
      .filter((path) => !covered.has(path));
  } finally {
    await storybook.close();
  }
}

const missing = await findUnstoriedComponents('.storybook');
if (missing.length > 0) {
  console.log(`Components without a story:\n${missing.map((path) => `  - ${path}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Every component in src/ has a story.');
}
