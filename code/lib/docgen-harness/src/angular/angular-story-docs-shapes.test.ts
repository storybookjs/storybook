// Gates the server-generated snippets for stories that supply their own markup. These fixtures
// live in their own tree (`__storyshapes__`): the `__testfixtures__` recorders JIT-mount their
// stories and gate against legacy runtime recordings, neither of which exists for template-shaped
// stories - the correct baseline here is the authored markup itself, so snapshots gate
// byte-for-byte. A story whose markup cannot be read statically falls back to component-derived
// bindings and carries a `warning` naming what could not be read; the warning is recorded with the
// snippet so a silently disappearing caveat can never hide behind an unchanged recording.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { loadCsf } from 'storybook/internal/csf-tools';
import type { IndexEntry } from 'storybook/internal/types';

import { buildStoryDocsPayload } from '../../../../frameworks/angular-vite/src/docgen/story-docs-build.ts';
import { createFixtureDocgen } from './docgen-fixture.ts';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__storyshapes__');

const fixtureCases = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const NO_SNIPPET_SENTINEL = '(no snippet: the runtime source fallback stays authoritative)';

// One manager for the whole suite: each fixture directory carries its own tsconfig.json, so every
// component file resolves to its own per-fixture project.
const docgen = createFixtureDocgen();

afterAll(() => {
  docgen.dispose();
});

describe('angular story-docs snippets for stories that supply their own markup', () => {
  it.each(fixtureCases)('%s', async (fixtureCase) => {
    const testDir = join(fixturesDir, fixtureCase);
    const storyPath = join(testDir, 'input.stories.ts');
    expect(existsSync(storyPath)).toBe(true);

    // The same parse the builder runs, used here only to map story ids back to export names.
    const csf = loadCsf(readFileSync(storyPath, 'utf8'), {
      makeTitle: () => `AngularShapes/${fixtureCase}`,
    }).parse();
    const storyExports = Object.entries(csf._stories);
    expect(storyExports.length).toBeGreaterThan(0);

    const entry: IndexEntry = {
      id: storyExports[0][1].id,
      name: storyExports[0][1].name ?? storyExports[0][0],
      title: `AngularShapes/${fixtureCase}`,
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
      expect(storyDoc, `${exportName} missing from payload`).toBeDefined();
      expect(storyDoc?.error, `${exportName} produced an error`).toBeUndefined();
      const recorded = [
        storyDoc?.snippet ?? NO_SNIPPET_SENTINEL,
        ...(storyDoc?.warning === undefined ? [] : [`warning: ${storyDoc.warning}`]),
      ].join('\n\n');
      await expect(recorded).toMatchFileSnapshot(
        join(testDir, `server-snippet-${exportName}.snapshot`)
      );
    }

    // toMatchFileSnapshot files sit outside vitest's obsolete-snapshot detection, so a renamed or
    // removed story export would silently leave its old recording behind.
    const snippetFilesOnDisk = readdirSync(testDir)
      .filter((file) => file.startsWith('server-snippet-') && file.endsWith('.snapshot'))
      .sort();
    const expectedSnippetFiles = storyExports
      .map(([exportName]) => `server-snippet-${exportName}.snapshot`)
      .sort();
    expect(snippetFilesOnDisk).toEqual(expectedSnippetFiles);
  });
});
