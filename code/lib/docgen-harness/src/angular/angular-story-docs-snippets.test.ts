// Gates the server-generated Angular story snippets (the angular-vite story-docs provider) against
// the committed legacy runtime recordings. The recorder helpers come from snippet-recorder.ts
// rather than render-helpers.ts: this file must not load the client renderer modules.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { loadCsf } from 'storybook/internal/csf-tools';
import type { IndexEntry } from 'storybook/internal/types';

import { buildStoryDocsPayload } from '../../../../frameworks/angular-vite/src/docgen/story-docs-build.ts';
import { extractHostComponentTemplate } from '../../../../frameworks/angular-vite/src/docgen/story-docs-snippet.ts';
import { createFixtureDocgen } from './docgen-fixture.ts';
import {
  expectNoStaleSnippets,
  fixtureCases,
  fixturesDir,
  recordSnippet,
} from './snippet-recorder.ts';

// One manager for the whole suite: each fixture directory carries its own tsconfig.json, so every
// component file resolves to its own per-fixture project.
const docgen = createFixtureDocgen();

afterAll(() => {
  docgen.dispose();
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
      { getDocgenPayload: docgen.getDocgenPayload(entry), resolvePath: (path) => path }
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
        // The server snippet wraps its template in a host component; the legacy recordings are the
        // bare template, so both sides are compared as templates.
        comparable: (text) => extractHostComponentTemplate(text) ?? text,
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
