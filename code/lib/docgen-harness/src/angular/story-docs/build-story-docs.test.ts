import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import ts from 'typescript';

import type { IndexEntry } from 'storybook/internal/types';

import { AngularComponentMetaManager } from '@storybook/angular-cm';
import type { AngularComponentMetaQuerySource } from '../../../../../frameworks/angular-vite/src/docgen/story-docs-build.ts';
import { buildStoryDocsPayload } from '../../../../../frameworks/angular-vite/src/docgen/story-docs-build.ts';
import { listFixtureCases } from '../snippet-recorder.ts';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

// One manager for the whole suite; the fixtures share a single tsconfig.json at the tree root.
const manager = new AngularComponentMetaManager(ts);

// `buildStoryDocsPayload` expects a Promise-returning source (it queries the shared docgen worker
// in production); the real manager resolves synchronously, so wrap it to match the interface.
const querySource: AngularComponentMetaQuerySource = {
  extractComponentMeta: async (componentPath, names) =>
    manager.extractComponentMeta(componentPath, names),
};

afterAll(() => {
  manager.dispose();
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
    const payload = await buildStoryDocsPayload(
      { entry: makeEntry(join(testDir, 'input.stories.ts'), `StoryDocs/${fixtureCase}`) },
      { manager: querySource, resolvePath: (path) => path }
    );

    await expect(payload && { ...payload, path: '__PATH__' }).toMatchFileSnapshot(
      join(testDir, 'story-docs.payload.snapshot')
    );
  });
});
