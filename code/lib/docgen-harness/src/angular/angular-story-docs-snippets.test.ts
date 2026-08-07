// Gates the server-generated Angular story snippets (the angular-vite story-docs provider) against
// the committed legacy runtime recordings (snippet-*.snapshot), and records its own
// server-snippet-*.snapshot files next to them for value-fidelity review. Paths are derived
// locally rather than imported from render-helpers: this recorder must not load the client
// renderer modules that file pulls in.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import ts from 'typescript';

import { loadCsf } from 'storybook/internal/csf-tools';
import type { IndexEntry } from 'storybook/internal/types';

import { AngularComponentMetaManager } from '@storybook/angular-cm';
import { buildStoryDocsPayload } from '../../../../frameworks/angular-vite/src/docgen/story-docs-build.ts';
import { expectCurrentOrBetter } from '../compare/expect-current-or-better.ts';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

const fixtureCases = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const readCommitted = (path: string): string | undefined =>
  existsSync(path) ? readFileSync(path, 'utf8') : undefined;

// One manager for the whole suite: each fixture directory carries its own tsconfig.json, so every
// component file resolves to its own per-fixture project.
const manager = new AngularComponentMetaManager(ts);

afterAll(() => {
  manager.dispose();
});

describe('angular story-docs server snippets', () => {
  it.each(fixtureCases)('%s', async (fixtureCase) => {
    const testDir = join(fixturesDir, fixtureCase);
    const storyPath = join(testDir, 'input.stories.ts');
    expect(existsSync(storyPath)).toBe(true);

    // The same parse the builder runs, used here only to map story ids back to export names.
    const csf = loadCsf(readFileSync(storyPath, 'utf8'), {
      makeTitle: () => `AngularFixtures/${fixtureCase}`,
    }).parse();
    const storyExports = Object.entries(csf._stories);
    expect(storyExports.length).toBeGreaterThan(0);

    const entry: IndexEntry = {
      id: storyExports[0][1].id,
      name: storyExports[0][1].name ?? storyExports[0][0],
      title: `AngularFixtures/${fixtureCase}`,
      type: 'story',
      subtype: 'story',
      importPath: storyPath,
    };
    const payload = buildStoryDocsPayload({ entry }, { manager, resolvePath: (path) => path });
    expect(payload).toBeDefined();

    for (const [exportName, story] of storyExports) {
      const storyDoc = payload!.stories[story.id];
      expect(storyDoc?.error, `${exportName} produced an error`).toBeUndefined();
      expect(storyDoc?.snippet, `${exportName} produced no snippet`).toBeDefined();
      const snippet = storyDoc!.snippet!;

      const snippetPath = join(testDir, `server-snippet-${exportName}.snapshot`);
      const committedServerSnippet = readCommitted(snippetPath);

      // Both gates run BEFORE the snapshot call: under `-u` that call queues the rewrite, so a
      // gate placed after it would turn the run red while still persisting the regressed
      // recording.
      // Ratchet: never regress against this recorder's own previous recording.
      if (committedServerSnippet !== undefined) {
        expectCurrentOrBetter({
          kind: 'snippet',
          framework: 'angular',
          baseline: committedServerSnippet,
          candidate: snippet,
        });
      }

      // Parity gate: the server snippet must represent every binding the legacy runtime
      // recording (JIT-rendered `computesTemplateSourceFromComponent`) represents.
      const committedLegacySnippet = readCommitted(join(testDir, `snippet-${exportName}.snapshot`));
      expect(committedLegacySnippet, `missing legacy snippet-${exportName}.snapshot`).toBeDefined();
      expectCurrentOrBetter({
        kind: 'snippet',
        framework: 'angular',
        baseline: committedLegacySnippet!,
        candidate: snippet,
      });

      await expect(snippet).toMatchFileSnapshot(snippetPath);
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
