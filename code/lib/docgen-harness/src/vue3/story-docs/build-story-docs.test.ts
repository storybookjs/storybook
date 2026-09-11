import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { IndexEntry } from 'storybook/internal/types';
import type { DocgenPayload } from 'storybook/open-service';

import { buildStoryDocsPayload } from '../../../../../renderers/vue3/src/story-docs/build-story-docs.ts';
import { parseArgTypesSnapshot } from '../../compare/parse-snapshot.ts';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');
const DOCGEN_FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '__testfixtures__');
const STORIES_FILE = 'input.stories.ts';

type FixtureCase = {
  label: string;
  name: string;
  testDir: string;
  tree: 'story-docs' | 'docgen';
};
type FixtureArgTypes = NonNullable<DocgenPayload['argTypes']>;

/** A directory is a fixture only if it holds a story file, so stray tooling dirs stay out. */
function fixtureCases(fixturesDir: string): string[] {
  return readdirSync(fixturesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(fixturesDir, name, STORIES_FILE)))
    .sort();
}

function storyDocsFixtureCases(): FixtureCase[] {
  return fixtureCases(FIXTURES_DIR).map((name) => ({
    label: name,
    name,
    testDir: resolve(FIXTURES_DIR, name),
    tree: 'story-docs' as const,
  }));
}

function docgenFixtureCases(): FixtureCase[] {
  return fixtureCases(DOCGEN_FIXTURES_DIR).map((name) => ({
    label: `docgen/${name}`,
    name,
    testDir: resolve(DOCGEN_FIXTURES_DIR, name),
    tree: 'docgen' as const,
  }));
}

function docgenForFixture(
  fixtureCase: string,
  id: string,
  path: string
): DocgenPayload | undefined {
  if (fixtureCase === 'docgen-unavailable' || fixtureCase === 'no-component') {
    return undefined;
  }

  const argTypesByFixture: Record<string, FixtureArgTypes> = {
    'event-listener': {
      default: argType('default', 'slots'),
      formatter: argType('formatter', 'props'),
      label: argType('label', 'props'),
      submit: argType('submit', 'events'),
    },
    'function-slot': {
      default: argType('default', 'slots'),
    },
    'function-slot-bail': {
      default: argType('default', 'slots'),
      footer: argType('footer', 'slots'),
    },
    'h-args-expression': {
      count: argType('count', 'props'),
      label: argType('label', 'props'),
    },
    'prop-slot-collision': {
      default: argType('default', 'props'),
      icon: argType('icon', 'props'),
    },
    'setup-computed': {
      hint: argType('hint', 'props'),
      label: argType('label', 'props'),
    },
    'setup-local-helper-bail': {
      badge: argType('badge', 'props'),
      label: argType('label', 'props'),
    },
    'setup-ref-plus-handler': {
      count: argType('count', 'props'),
      increment: argType('increment', 'events'),
      label: argType('label', 'props'),
    },
    'setup-renamed-args': {
      label: argType('label', 'props'),
      title: argType('title', 'props'),
    },
    'slot-scoped': {
      item: argType('item', 'slots'),
    },
    slots: {
      default: argType('default', 'slots'),
      header: argType('header', 'slots'),
    },
    'template-escaped-interpolation': {
      label: argType('label', 'props'),
    },
    'template-unset-args': {
      clear: argType('clear', 'events'),
      hint: argType('hint', 'props'),
      id: argType('id', 'props'),
      label: argType('label', 'props'),
      modelValue: argType('modelValue', 'props'),
      'update:modelValue': argType('update:modelValue', 'events'),
    },
    'template-v-model-expansion': {
      label: argType('label', 'props'),
      'update:modelValue': argType('update:modelValue', 'events'),
    },
    'v-model': {
      'update:checked': argType('update:checked', 'events'),
      'update:modelValue': argType('update:modelValue', 'events'),
    },
  };
  // Deliberately empty: vue-component-meta does not surface component-level tags, so the
  // `import-override` fixture has to earn its snapshot from the `@import` tag on its CSF meta.
  return {
    id,
    name: componentNameFromFixture(fixtureCase),
    path,
    jsDocTags: {},
    argTypes: argTypesByFixture[fixtureCase] ?? {},
  };
}

function argType(name: string, category: string): FixtureArgTypes[string] {
  return {
    name,
    table: {
      category,
    },
    type: {
      name: 'other',
      value: 'unknown',
    },
  };
}

/** Feed the real extracted argTypes so docgen-tree baselines exercise snippet synthesis. */
function docgenFromArgTypesSnapshot(
  testDir: string,
  id: string,
  path: string
): DocgenPayload | undefined {
  const argTypesPath = join(testDir, 'cm-argtypes.snapshot');
  if (!existsSync(argTypesPath)) {
    return undefined;
  }

  const sfcFile = readdirSync(testDir).find((file) => file.endsWith('.vue'));
  return {
    id,
    name: sfcFile ? sfcFile.replace(/\.vue$/, '') : id,
    path,
    jsDocTags: {},
    argTypes: parseArgTypesSnapshot(readFileSync(argTypesPath, 'utf8'), argTypesPath),
  };
}

function componentNameFromFixture(fixtureCase: string): string {
  return fixtureCase
    .split('-')
    .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
    .join('');
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

async function expectPayloadSnapshot({ name, testDir, tree }: FixtureCase): Promise<void> {
  const importPath = resolve(testDir, STORIES_FILE);
  const payload = await buildStoryDocsPayload(
    {
      entry: makeStoryIndexEntry(importPath, `Forms/${name}`),
    },
    {
      readDocgen: async (id) =>
        tree === 'story-docs'
          ? docgenForFixture(name, id, importPath)
          : docgenFromArgTypesSnapshot(testDir, id, importPath),
    }
  );

  await expect(payload ? { ...payload, path: '__PATH__' } : payload).toMatchFileSnapshot(
    join(testDir, 'story-docs.payload.snapshot')
  );
}

describe('vue3 story-docs payload baselines', () => {
  it.each([...storyDocsFixtureCases(), ...docgenFixtureCases()])('$label', expectPayloadSnapshot);
});
