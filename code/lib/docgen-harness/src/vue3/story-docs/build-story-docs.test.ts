import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { IndexEntry } from 'storybook/internal/types';

import { buildStoryDocsPayload } from '../../../../../renderers/vue3/src/story-docs/build-story-docs.ts';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');
const STORIES_FILE = 'input.stories.ts';

function fixtureCases(): string[] {
  return readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function makeStoryIndexEntry(importPath: string, title: string): IndexEntry {
  const componentId = title.split('/').at(-1)!.replace(/\s+/g, '').toLowerCase();
  return {
    id: `${componentId}--primary`,
    name: 'Primary',
    title,
    type: 'story',
    subtype: 'story',
    importPath,
  };
}

describe('vue3 story-docs payload baselines', () => {
  it.each(fixtureCases())('%s', async (fixtureCase): Promise<void> => {
    const testDir = resolve(FIXTURES_DIR, fixtureCase);
    const importPath = resolve(testDir, STORIES_FILE);
    const payload = await buildStoryDocsPayload({
      entry: makeStoryIndexEntry(importPath, `Forms/${fixtureCase}`),
    });

    await expect(payload ? { ...payload, path: '__PATH__' } : payload).toMatchFileSnapshot(
      join(testDir, 'payload.snapshot')
    );
  });
});
