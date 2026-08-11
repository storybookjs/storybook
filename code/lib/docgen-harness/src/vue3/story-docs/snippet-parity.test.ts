import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { storyNameFromExport } from 'storybook/internal/csf';
import { loadCsf } from 'storybook/internal/csf-tools';
import type { IndexEntry, StoryDocsPayload } from 'storybook/internal/types';
import type { DocgenPayload } from 'storybook/open-service';

import { buildStoryDocsPayload } from '../../../../../renderers/vue3/src/story-docs/build-story-docs.ts';
import { expectCurrentOrBetter } from '../../compare/expect-current-or-better.ts';
import { parseArgTypesSnapshot } from '../../compare/parse-snapshot.ts';
import { vueRepresentedNames } from '../../compare/snippets-vue3.ts';

const FIXTURES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../__testfixtures__');
const STORIES_FILE = 'input.stories.ts';

/**
 * Stories that intentionally emit no static snippet (runtime source fallback stays authoritative).
 * Shrink this set as slot support lands; an entry that starts emitting must be removed.
 */
const EXPECTED_SNIPPETLESS = new Set([
  'define-slots-literal-bindings/ScopedIconBinding',
  'slots/ScopedBindings',
  'slots/VNodeChild',
  'slots-template-only/ScopedBindings',
]);

/**
 * Args the static snippet leaves out although the runtime baseline resolves them, because their
 * source references a story-local binding a snippet cannot declare. Each is named in the story's
 * `StoryDoc.warning`, and the runtime snippet remains available for the resolved value.
 */
const EXPECTED_OMITTED_ARGS = new Map<string, readonly string[]>([
  ['props-ts-enum/PropsAsWritten', ['severity']],
]);

type BaselineComparison = {
  fixtureCase: string;
  exportName: string;
  baseline: string;
  candidate: string | undefined;
};

function fixtureCases(): string[] {
  return readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) =>
      readdirSync(resolve(FIXTURES_DIR, entry.name)).some(
        (file) => file.startsWith('snippet-') && file.endsWith('.snapshot')
      )
    )
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

function docgenForFixture(fixtureCase: string, id: string, path: string): DocgenPayload {
  const argTypesPath = resolve(FIXTURES_DIR, fixtureCase, 'cm-argtypes.snapshot');
  const argTypes = parseArgTypesSnapshot(
    readFileSync(argTypesPath, 'utf8'),
    `${fixtureCase}/cm-argtypes.snapshot`
  );

  return {
    id,
    name: componentNameForFixture(fixtureCase),
    path,
    jsDocTags: {},
    argTypes,
  };
}

function componentNameForFixture(fixtureCase: string): string {
  const sfcFile = readdirSync(resolve(FIXTURES_DIR, fixtureCase)).find((file) =>
    file.endsWith('.vue')
  );

  return sfcFile ? sfcFile.replace(/\.vue$/, '') : fixtureCase;
}

function titleForStoryFile(storyFile: string): string {
  const storyFileSource = readFileSync(storyFile, 'utf8');
  const csf = loadCsf(storyFileSource, {
    makeTitle: (title) => title ?? 'Unknown',
    fileName: storyFile,
  }).parse();

  return csf._meta?.title ?? 'Unknown';
}

async function buildPayloadForFixture(fixtureCase: string): Promise<StoryDocsPayload | undefined> {
  const importPath = resolve(FIXTURES_DIR, fixtureCase, STORIES_FILE);
  return buildStoryDocsPayload(
    {
      entry: makeStoryIndexEntry(importPath, titleForStoryFile(importPath)),
    },
    {
      readDocgen: async (id) => docgenForFixture(fixtureCase, id, importPath),
    }
  );
}

function baselineComparisons(fixtureCase: string, payload: StoryDocsPayload): BaselineComparison[] {
  const testDir = resolve(FIXTURES_DIR, fixtureCase);
  return readdirSync(testDir)
    .filter((file) => file.startsWith('snippet-') && file.endsWith('.snapshot'))
    .sort()
    .map((snapshotFile) => {
      const exportName = snapshotFile.replace(/^snippet-/, '').replace(/\.snapshot$/, '');
      const storyName = storyNameFromExport(exportName);
      return {
        fixtureCase,
        exportName,
        baseline: readFileSync(resolve(testDir, snapshotFile), 'utf8'),
        candidate: Object.values(payload.stories).find((story) => story.name === storyName)
          ?.snippet,
      };
    });
}

/**
 * Status label backed only by what the represented-name comparison can verify: added or omitted
 * arg names. Value fidelity is not compared, so other differences carry no quality claim.
 */
function snippetStatus(baseline: string, candidate: string | undefined): string {
  if (!candidate) {
    return '⏳ no snippet (runtime fallback)';
  }
  if (candidate.trim() === baseline.trim()) {
    return '✅ identical';
  }

  const baselineNames = vueRepresentedNames(baseline) ?? new Set<string>();
  const candidateNames = vueRepresentedNames(candidate) ?? new Set<string>();
  const omitted = [...baselineNames].filter((name) => !candidateNames.has(name)).sort();
  if (omitted.length > 0) {
    return `⚠️ omits ${omitted.join(', ')}`;
  }

  const added = [...candidateNames].filter((name) => !baselineNames.has(name)).sort();
  if (added.length > 0) {
    return `✨ adds ${added.join(', ')}`;
  }
  return '🔁 differs (same args)';
}

describe('vue3 story-docs static snippet parity', () => {
  it.each(fixtureCases())('%s', async (fixtureCase): Promise<void> => {
    const payload = await buildPayloadForFixture(fixtureCase);
    expect(payload, fixtureCase).toBeDefined();

    for (const { exportName, baseline, candidate } of baselineComparisons(fixtureCase, payload!)) {
      const storyKey = `${fixtureCase}/${exportName}`;

      if (!candidate) {
        expect(EXPECTED_SNIPPETLESS.has(storyKey), `${storyKey} stopped emitting a snippet`).toBe(
          true
        );
        continue;
      }

      expect(
        EXPECTED_SNIPPETLESS.has(storyKey),
        `${storyKey} now emits a snippet — remove it from EXPECTED_SNIPPETLESS`
      ).toBe(false);

      expectCurrentOrBetter({
        kind: 'snippet',
        framework: 'vue3',
        baseline,
        candidate,
        declaredOmissions: EXPECTED_OMITTED_ARGS.get(storyKey),
      });
    }
  });

  it('summarizes parity against the legacy source decorator', async () => {
    const rows: string[] = [];

    for (const fixtureCase of fixtureCases()) {
      const payload = await buildPayloadForFixture(fixtureCase);
      for (const { exportName, baseline, candidate } of baselineComparisons(
        fixtureCase,
        payload!
      )) {
        rows.push(`| ${fixtureCase} | ${exportName} | ${snippetStatus(baseline, candidate)} |`);
      }
    }

    const report = [
      '# Vue static snippets vs legacy source decorator',
      '',
      'Generated by `snippet-parity.test.ts` — regenerate with `vitest -u`.',
      '',
      '| Fixture | Story | Status |',
      '| --- | --- | --- |',
      ...rows,
      '',
    ].join('\n');

    await expect(report).toMatchFileSnapshot(join(FIXTURES_DIR, 'snippet-parity-summary.md'));
  });
});
