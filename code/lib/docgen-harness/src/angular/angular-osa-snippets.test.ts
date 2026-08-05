import type { IndexEntry } from 'storybook/internal/types';

import { loadCsf } from 'storybook/internal/csf-tools';

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildStoryDocsPayload } from '../../../../frameworks/angular-vite/src/docgen/build-story-docs.ts';
import { expectCurrentOrBetter } from '../compare/expect-current-or-better.ts';
import { BASELINE_PATH } from './baseline-path.ts';

// A second recorder alongside the legacy one, following the vue3 `cm-` precedent: the committed
// `snippet-*.snapshot` files stay the oracle this path is measured against instead of being
// overwritten by it, so `BASELINE_PATH` is deliberately untouched.
if (BASELINE_PATH !== 'legacy') {
  throw new Error(
    'angular-osa-snippets.test.ts compares the OSA snippets against the legacy baselines; update the recorder or baseline-path.ts'
  );
}

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

const fixtureCases = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const silentLogger = { warn: () => {}, debug: () => {} };

describe('angular OSA snippet baselines', () => {
  it.each(fixtureCases)('%s', async (fixtureCase) => {
    const testDir = join(fixturesDir, fixtureCase);
    const title = `AngularFixtures/${fixtureCase}`;
    const storySource = readFileSync(join(testDir, 'input.stories.ts'), 'utf8');
    const compodocJson = JSON.parse(readFileSync(join(testDir, 'compodoc-input.json'), 'utf8'));

    // The fixtures ship Compodoc's capture as `compodoc-input.json`; production reads the same
    // shape from `documentation.json` in the resolved output directory.
    const payload = buildStoryDocsPayload(
      {
        entry: {
          type: 'story',
          subtype: 'story',
          id: `${fixtureCase}--recorder`,
          name: 'recorder',
          title,
          importPath: './input.stories.ts',
        } as IndexEntry,
      },
      {
        workspaceRoot: testDir,
        outputDir: testDir,
        readDocumentationJson: () => compodocJson,
        logger: silentLogger,
      }
    );

    expect(payload).toBeDefined();

    const csf = loadCsf(storySource, { makeTitle: () => title }).parse();
    const storyExports = Object.keys(csf._stories);
    expect(storyExports.length).toBeGreaterThan(0);

    for (const exportName of storyExports) {
      const doc = payload!.stories[csf._stories[exportName].id];
      expect(doc?.error).toBeUndefined();

      const snippet = doc!.snippet!;
      await expect(snippet).toMatchFileSnapshot(
        join(testDir, `osa-snippet-${exportName}.snapshot`)
      );

      // The legacy recorder synthesizes an action arg for every output before generating, which is
      // what the runtime actions enhancer does, so the committed baselines carry an event binding
      // per output. Losing one here is a regression, not a formatting difference.
      expectCurrentOrBetter({
        kind: 'snippet',
        framework: 'angular',
        baseline: readFileSync(join(testDir, `snippet-${exportName}.snapshot`), 'utf8'),
        candidate: snippet,
      });
    }

    // toMatchFileSnapshot files sit outside vitest's obsolete-snapshot detection, so a renamed or
    // removed story export would silently leave its old snapshot on disk.
    const snippetFilesOnDisk = readdirSync(testDir)
      .filter((file) => file.startsWith('osa-snippet-') && file.endsWith('.snapshot'))
      .sort();
    expect(snippetFilesOnDisk).toEqual(
      storyExports.map((exportName) => `osa-snippet-${exportName}.snapshot`).sort()
    );
  });
});
