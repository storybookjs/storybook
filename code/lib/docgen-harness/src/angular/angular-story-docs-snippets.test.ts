// Gates the server-generated Angular story snippets (the angular-vite story-docs provider) against
// the committed legacy runtime recordings. The recorder helpers come from snippet-recorder.ts
// rather than render-helpers.ts: this file must not load the client renderer modules.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import ts from 'typescript';

import { loadCsf } from 'storybook/internal/csf-tools';
import type { IndexEntry } from 'storybook/internal/types';

import { AngularComponentMetaManager } from '@storybook/angular-cm';
import type { AngularComponentMetaQuerySource } from '../../../../frameworks/angular-vite/src/docgen/story-docs-build.ts';
import { buildStoryDocsPayload } from '../../../../frameworks/angular-vite/src/docgen/story-docs-build.ts';
import {
  expectNoStaleSnippets,
  fixtureCases,
  fixturesDir,
  recordSnippet,
} from './snippet-recorder.ts';

// One manager for the whole suite: each fixture directory carries its own tsconfig.json, so every
// component file resolves to its own per-fixture project.
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

describe('angular story-docs server snippets', () => {
  it.each(fixtureCases)('%s', async (fixtureCase) => {
    const testDir = join(fixturesDir, fixtureCase);
    const storyPath = join(testDir, 'input.stories.ts');
    const title = `AngularFixtures/${fixtureCase}`;

    // The same parse the builder runs, used here only to map story ids back to export names.
    const csf = loadCsf(readFileSync(storyPath, 'utf8'), { makeTitle: () => title }).parse();
    const storyExports = Object.entries(csf._stories);
    expect(storyExports.length).toBeGreaterThan(0);

    const entry: IndexEntry = {
      id: storyExports[0][1].id,
      name: storyExports[0][1].name ?? storyExports[0][0],
      title,
      type: 'story',
      subtype: 'story',
      importPath: storyPath,
    };
    const payload = await buildStoryDocsPayload(
      { entry },
      { manager: querySource, resolvePath: (path) => path }
    );
    expect(payload).toBeDefined();

    for (const [exportName, story] of storyExports) {
      const storyDoc = payload!.stories[story.id];
      expect(storyDoc?.error, `${exportName} produced an error`).toBeUndefined();
      expect(storyDoc?.snippet, `${exportName} produced no snippet`).toBeDefined();

      await recordSnippet({
        testDir,
        prefix: 'server-snippet-',
        exportName,
        snippet: storyDoc!.snippet!,
        legacyParity: true,
      });
    }

    expectNoStaleSnippets(
      testDir,
      'server-snippet-',
      storyExports.map(([exportName]) => exportName)
    );
  });
});
