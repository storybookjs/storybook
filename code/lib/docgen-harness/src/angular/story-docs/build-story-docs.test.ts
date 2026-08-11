import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import type { IndexEntry } from 'storybook/internal/types';

import { buildStoryDocsPayload } from '../../../../../frameworks/angular-vite/src/docgen/story-docs-build.ts';
import { createFixtureDocgen } from '../docgen-fixture.ts';
import { listFixtureCases } from '../snippet-recorder.ts';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

// One manager for the whole suite; the fixtures share a single tsconfig.json at the tree root.
const docgen = createFixtureDocgen();

afterAll(() => {
  docgen.dispose();
});

const makeEntry = (storyPath: string, title: string): IndexEntry => ({
  id: `${title.split('/').at(-1)!.toLowerCase()}--primary`,
  name: 'Primary',
  title,
  type: 'story',
  subtype: 'story',
  importPath: storyPath,
});

describe('angular story-docs payload baselines', () => {
  it.each(listFixtureCases(FIXTURES_DIR))('%s', async (fixtureCase) => {
    const testDir = join(FIXTURES_DIR, fixtureCase);
    const storyPath = join(testDir, 'input.stories.ts');
    const title = `StoryDocs/${fixtureCase}`;
    const entry = makeEntry(storyPath, title);
    const payload = await buildStoryDocsPayload(
      { entry },
      { getDocgenPayload: docgen.getDocgenPayload(entry), resolvePath: (path) => path }
    );

    await expect(payload && { ...payload, path: '__PATH__' }).toMatchFileSnapshot(
      join(testDir, 'story-docs.payload.snapshot')
    );
  });
});
