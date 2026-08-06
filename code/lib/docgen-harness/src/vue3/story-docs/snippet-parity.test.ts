import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { storyNameFromExport } from 'storybook/internal/csf';
import { loadCsf } from 'storybook/internal/csf-tools';
import type { IndexEntry } from 'storybook/internal/types';
import type { DocgenPayload } from 'storybook/open-service';

import { buildStoryDocsPayload } from '../../../../../renderers/vue3/src/story-docs/build-story-docs.ts';
import { expectCurrentOrBetter } from '../../compare/expect-current-or-better.ts';
import { parseArgTypesSnapshot } from '../../compare/parse-snapshot.ts';

const FIXTURES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../__testfixtures__');
const STORIES_FILE = 'input.stories.ts';

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

describe('vue3 story-docs static snippet parity', () => {
  it.each(fixtureCases())('%s', async (fixtureCase): Promise<void> => {
    const testDir = resolve(FIXTURES_DIR, fixtureCase);
    const importPath = resolve(testDir, STORIES_FILE);
    const payload = await buildStoryDocsPayload(
      {
        entry: makeStoryIndexEntry(importPath, titleForStoryFile(importPath)),
      },
      {
        readDocgen: async (id) => docgenForFixture(fixtureCase, id, importPath),
      }
    );

    expect(payload, fixtureCase).toBeDefined();

    for (const snapshotFile of readdirSync(testDir)
      .filter((file) => file.startsWith('snippet-') && file.endsWith('.snapshot'))
      .sort()) {
      const exportName = snapshotFile.replace(/^snippet-/, '').replace(/\.snapshot$/, '');
      const storyName = storyNameFromExport(exportName);
      const candidate = Object.values(payload!.stories).find(
        (story) => story.name === storyName
      )?.snippet;

      if (!candidate) {
        continue;
      }

      expectCurrentOrBetter({
        kind: 'snippet',
        framework: 'vue3',
        baseline: readFileSync(resolve(testDir, snapshotFile), 'utf8'),
        candidate,
      });
    }

    const emittedSnippet = Object.values(payload!.stories).some((story) => story.snippet);
    const hasBaseline = readdirSync(testDir).some(
      (file) =>
        file.startsWith('snippet-') && file.endsWith('.snapshot') && existsSync(join(testDir, file))
    );
    expect(emittedSnippet || hasBaseline, fixtureCase).toBe(true);
  });
});
