import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import ts from 'typescript';

import type { IndexEntry } from 'storybook/internal/types';

import { AngularComponentMetaManager } from '@storybook/angular-cm';
import type { AngularDocgenPayload } from '../../../../../frameworks/angular-vite/src/docgen/build-docgen.ts';
import {
  parseStoryFile,
  resolveComponentOf,
} from '../../../../../frameworks/angular-vite/src/docgen/resolve-component.ts';
import { buildStoryDocsPayload } from '../../../../../frameworks/angular-vite/src/docgen/story-docs-build.ts';
import { listFixtureCases } from '../snippet-recorder.ts';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

// One manager for the whole suite; the fixtures share a single tsconfig.json at the tree root.
const manager = new AngularComponentMetaManager(ts);

// Stands in for the `core/docgen` service query `getDocgenPayload` hits in production: resolve the
// same component `buildStoryDocsPayload` would, then extract straight off the manager.
const buildGetDocgenPayload =
  (storyPath: string, title: string) => async (): Promise<AngularDocgenPayload | undefined> => {
    const parsed = parseStoryFile(storyPath, title);
    if (!parsed) {
      return undefined;
    }
    const resolution = resolveComponentOf(parsed.csf, storyPath);
    const component = 'reason' in resolution ? undefined : resolution.component;
    if (!component?.path) {
      return undefined;
    }
    const meta = manager.extractComponentMeta(component.path, {
      exportName: component.exportName,
      localName: component.localName,
    });
    if (!meta) {
      return undefined;
    }
    return {
      id: 'fixture',
      name: meta.entry.name,
      path: storyPath,
      jsDocTags: {},
      angularComponentMeta: meta.entry,
      angularComponentEnums: meta.json.miscellaneous?.enumerations ?? [],
    };
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
    const storyPath = join(testDir, 'input.stories.ts');
    const title = `StoryDocs/${fixtureCase}`;
    const payload = await buildStoryDocsPayload(
      { entry: makeEntry(storyPath, title) },
      { getDocgenPayload: buildGetDocgenPayload(storyPath, title), resolvePath: (path) => path }
    );

    await expect(payload && { ...payload, path: '__PATH__' }).toMatchFileSnapshot(
      join(testDir, 'story-docs.payload.snapshot')
    );
  });
});
