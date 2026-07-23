import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parse } from 'vue-docgen-api';

import { extractArgTypes } from '../../../../renderers/vue3/src/extractArgTypes.ts';
import { generateSourceCode } from '../../../../renderers/vue3/src/docs/sourceDecorator.ts';
import { expectCurrentOrBetter } from '../compare/expect-current-or-better.ts';
import { parseArgTypesSnapshot } from '../compare/parse-snapshot.ts';
import { BASELINE_PATH } from './baseline-path.ts';

if (BASELINE_PATH !== 'legacy') {
  throw new Error(
    'vue3-baselines.test.ts records the legacy vue-docgen-api path; update the recorder or baseline-path.ts'
  );
}

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

const fixtureCases = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

// Under `vitest -u` a match call may legitimately rewrite its file (an accepted improvement),
// so parsed-committed vs live divergence is the comparator's verdict there, not parser
// infidelity; the round-trip proof re-arms on the next normal run against the new text.
// Read from the worker config: `expect.getState().snapshotState` is unreachable here because
// the imported production source loads storybook/test, which replaces the global expect
// instance the runner attaches per-test state to. If the worker global ever disappears, the
// guard degrades to running the round-trip everywhere - loud under -u, never silently weaker.
const snapshotsRewriteOnMismatch = (): boolean =>
  (
    (globalThis as unknown as Record<string, unknown>).__vitest_worker__ as
      | { config?: { snapshotOptions?: { updateSnapshot?: string } } }
      | undefined
  )?.config?.snapshotOptions?.updateSnapshot === 'all';

type DocgenComponent = {
  name?: string;
  __name?: string;
  __docgenInfo?: unknown;
};

describe('vue3 legacy baselines', () => {
  it.each(fixtureCases)('%s', async (fixtureCase) => {
    const testDir = join(fixturesDir, fixtureCase);
    const sfcFiles = readdirSync(testDir).filter((file) => file.endsWith('.vue'));
    expect(sfcFiles).toHaveLength(1);

    const metaData = await parse(join(testDir, sfcFiles[0]));

    const storiesModule = await import(`./__testfixtures__/${fixtureCase}/input.stories.ts`);
    const { default: meta, ...stories } = storiesModule;

    const component: DocgenComponent = meta.component;
    component.__docgenInfo = Object.assign(
      { displayName: component.name ?? component.__name },
      JSON.parse(JSON.stringify(metaData))
    );

    // Committed baselines are read BEFORE their toMatchFileSnapshot call: under -u the
    // match call rewrites the file first, and a read placed after it would compare the
    // candidate against itself, masking regressions exactly at flip re-record time. A
    // missing file is a fresh fixture's first record and skips the comparator.
    const argTypesPath = join(testDir, 'argtypes.snapshot');
    const committedArgTypes = existsSync(argTypesPath)
      ? readFileSync(argTypesPath, 'utf8')
      : undefined;

    const argTypes = extractArgTypes(component);
    await expect(argTypes).toMatchFileSnapshot(argTypesPath);

    if (committedArgTypes !== undefined) {
      const parsed = parseArgTypesSnapshot(committedArgTypes, `${fixtureCase}/argtypes.snapshot`);
      if (!snapshotsRewriteOnMismatch()) {
        // Round-trip proof: the tokenizer must reconstruct exactly what pretty-format wrote.
        expect(parsed).toEqual(argTypes);
      }
      expectCurrentOrBetter({ kind: 'argTypes', baseline: parsed, candidate: argTypes! });
    }

    for (const [exportName, story] of Object.entries<{ args?: Record<string, unknown> }>(stories)) {
      const ctx = {
        title: meta.title,
        component,
        args: { ...meta.args, ...story.args },
      };
      const snippetPath = join(testDir, `snippet-${exportName}.snapshot`);
      const committedSnippet = existsSync(snippetPath)
        ? readFileSync(snippetPath, 'utf8')
        : undefined;
      const snippet = generateSourceCode(ctx);
      await expect(snippet).toMatchFileSnapshot(snippetPath);
      if (committedSnippet !== undefined) {
        expectCurrentOrBetter({
          kind: 'snippet',
          framework: 'vue3',
          args: ctx.args,
          baseline: committedSnippet,
          candidate: snippet,
        });
      }
    }

    // toMatchFileSnapshot files sit outside vitest's obsolete-snapshot detection, so a
    // renamed or removed story export would silently leave its old snapshot on disk
    // (and any red marker reading it would assert on stale content).
    const snippetFilesOnDisk = readdirSync(testDir)
      .filter((file) => file.startsWith('snippet-') && file.endsWith('.snapshot'))
      .sort();
    const expectedSnippetFiles = Object.keys(stories)
      .map((exportName) => `snippet-${exportName}.snapshot`)
      .sort();
    expect(snippetFilesOnDisk).toEqual(expectedSnippetFiles);
  });
});
