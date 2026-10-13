import type { DocgenPayload, IndexEntry } from 'storybook/internal/types';
import { toId } from 'storybook/internal/csf';

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDocgenProvider } from '../../../../renderers/svelte/src/docgen/docgen-worker.ts';
import { createIndexer } from '../../../../renderers/svelte/src/svelte-csf/indexer/index.ts';
import { expectCurrentOrBetter } from '../compare/expect-current-or-better.ts';
import { parseArgTypesSnapshot } from '../compare/parse-snapshot.ts';
import { recordArgTypesSnapshot } from '../compare/record-argtypes-snapshot.ts';
import { BASELINE_PATH } from './baseline-path.ts';

if (BASELINE_PATH !== 'legacy') {
  throw new Error(
    'svelte-osa-baselines.test.ts gates the server recorder against the legacy runtime baselines; update the recorder or baseline-path.ts'
  );
}

const svelteCsfIndexer = createIndexer();

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

const fixtureCases = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const entryForFixture = async (fixtureCase: string): Promise<IndexEntry> => {
  const [first] = await svelteCsfIndexer.createIndex(
    join(fixturesDir, fixtureCase, 'input.stories.svelte'),
    { makeTitle: (title) => title ?? fixtureCase }
  );
  if (!first?.title || !first.exportName) {
    throw new Error(
      `${fixtureCase}: input.stories.svelte must declare a title and at least one story`
    );
  }
  return {
    id: toId(first.title, first.exportName),
    name: first.name ?? first.exportName,
    title: first.title,
    type: 'story',
    subtype: 'story',
    importPath: './input.stories.svelte',
    tags: first.tags,
  };
};

const entries = new Map(
  await Promise.all(
    fixtureCases.map(
      async (fixtureCase) => [fixtureCase, await entryForFixture(fixtureCase)] as const
    )
  )
);

const LEGACY_PARITY = new Set(fixtureCases);

const provider = createDocgenProvider()(async () => undefined);

const withoutArgTypes = (
  payload: DocgenPayload | undefined
): Omit<DocgenPayload, 'argTypes'> | undefined => {
  if (!payload) {
    return payload;
  }
  const { argTypes: _argTypes, ...rest } = payload;
  return rest;
};

const readFixtureFile = (fixtureCase: string, fileName: string): string =>
  readFileSync(join(fixturesDir, fixtureCase, fileName), 'utf8');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('svelte server-side docgen baselines', () => {
  it.each(fixtureCases)('%s', async (fixtureCase) => {
    const testDir = join(fixturesDir, fixtureCase);
    vi.spyOn(process, 'cwd').mockReturnValue(testDir);

    const payload = await provider({ entry: entries.get(fixtureCase)! });

    if (fixtureCase === 'runes-basic-props') {
      expect(payload?.description).toContain('Panel with string, number and boolean props.');
    }
    if (fixtureCase === 'runes-union-literal') {
      expect(payload?.argTypes?.size).toMatchObject({
        type: { name: 'enum', value: ['small', 'medium', 'large'] },
        control: { type: 'radio' },
      });
    }
    if (fixtureCase === 'runes-snippets') {
      expect(payload?.argTypes?.header).toMatchObject({
        control: false,
        table: { category: 'slots', type: { summary: 'Snippet<[title: string]>' } },
      });
    }
    if (fixtureCase === 'runes-jsdoc-tags') {
      expect(payload?.jsDocTags).toMatchObject({ deprecated: ['Use another fixture.'] });
      expect(payload?.argTypes?.label?.table?.jsDocTags).toMatchObject({
        default: ['Current label'],
      });
      expect(payload?.argTypes?.oldLabel?.table?.jsDocTags).toMatchObject({
        deprecated: ['Use label instead.'],
      });
    }
    expect(JSON.stringify(payload ?? null)).not.toContain(testDir);
    await recordArgTypesSnapshot({
      path: join(testDir, 'osa-argtypes.snapshot'),
      label: `${fixtureCase}/osa-argtypes.snapshot`,
      candidate: payload?.argTypes ?? {},
      extraGates: LEGACY_PARITY.has(fixtureCase)
        ? [
            {
              committed: readFixtureFile(fixtureCase, 'argtypes.snapshot'),
              label: `${fixtureCase}/argtypes.snapshot`,
              legacyBaseline: true,
            },
          ]
        : [],
    });
    await expect(withoutArgTypes(payload)).toMatchFileSnapshot(
      join(testDir, 'osa-payload.snapshot')
    );
    await expect(payload?.description ?? '').toMatchFileSnapshot(
      join(testDir, 'osa-description.snapshot')
    );
  });
});

it.each(['runes-basic-props', 'runes-callbacks', 'runes-component-props-indexed'])(
  '%s resolves the same component from plain CSF and Svelte CSF',
  async (fixtureCase) => {
    vi.spyOn(process, 'cwd').mockReturnValue(join(fixturesDir, fixtureCase));
    const entry = entries.get(fixtureCase)!;
    const sveltePayload = await provider({ entry });
    const plainPayload = await provider({
      entry: { ...entry, importPath: './input.stories.ts' },
    });
    expect(plainPayload?.argTypes).toEqual(sveltePayload?.argTypes);
    expect(plainPayload?.name).toEqual(sveltePayload?.name);
    expect(plainPayload?.error).toBeUndefined();
  }
);

it('every parity marker has its legacy and server argTypes baselines', () => {
  for (const fixtureCase of fixtureCases) {
    for (const fileName of ['argtypes.snapshot', 'osa-argtypes.snapshot']) {
      expect(
        existsSync(join(fixturesDir, fixtureCase, fileName)),
        `${fixtureCase}/${fileName}`
      ).toBe(true);
    }
  }
});

describe('svelte server-side argTypes hold the legacy baseline', () => {
  for (const fixtureCase of fixtureCases) {
    (LEGACY_PARITY.has(fixtureCase) ? it : it.fails)(fixtureCase, () => {
      expectCurrentOrBetter({
        kind: 'argTypes',
        baseline: parseArgTypesSnapshot(
          readFixtureFile(fixtureCase, 'argtypes.snapshot'),
          `${fixtureCase}/argtypes.snapshot`
        ),
        candidate: parseArgTypesSnapshot(
          readFixtureFile(fixtureCase, 'osa-argtypes.snapshot'),
          `${fixtureCase}/osa-argtypes.snapshot`
        ),
        legacyBaseline: true,
      });
    });
  }
});
