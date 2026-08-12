import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { IndexEntry } from 'storybook/internal/types';

import { buildStoryDocsPayload } from '../../../../../renderers/vue3/src/story-docs/build-story-docs.ts';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');
const DOCGEN_FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '__testfixtures__');
const STORIES_FILE = 'input.stories.ts';

type FixtureCase = {
  label: string;
  name: string;
  testDir: string;
};

function fixtureCases(fixturesDir: string): string[] {
  return readdirSync(fixturesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function makeFixtureCase(fixturesDir: string, name: string, label = name): FixtureCase {
  return {
    label,
    name,
    testDir: resolve(fixturesDir, name),
  };
}

function storyDocsFixtureCases(): FixtureCase[] {
  return fixtureCases(FIXTURES_DIR).map((fixtureCase) =>
    makeFixtureCase(FIXTURES_DIR, fixtureCase)
  );
}

function docgenFixtureCases(): FixtureCase[] {
  return fixtureCases(DOCGEN_FIXTURES_DIR)
    .filter((fixtureCase) => existsSync(join(DOCGEN_FIXTURES_DIR, fixtureCase, STORIES_FILE)))
    .map((fixtureCase) =>
      makeFixtureCase(DOCGEN_FIXTURES_DIR, fixtureCase, `docgen/${fixtureCase}`)
    );
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

async function expectPayloadSnapshot({ name, testDir }: FixtureCase): Promise<void> {
  const importPath = resolve(testDir, STORIES_FILE);
  const payload = await buildStoryDocsPayload({
    entry: makeStoryIndexEntry(importPath, `Forms/${name}`),
  });

  await expect(payload ? { ...payload, path: '__PATH__' } : payload).toMatchFileSnapshot(
    join(testDir, 'story-docs.payload.snapshot')
  );
}

describe('vue3 story-docs payload baselines', () => {
  it.each([...storyDocsFixtureCases(), ...docgenFixtureCases()])('$label', expectPayloadSnapshot);
});
