import type { IndexEntry, Indexer, Options } from 'storybook/internal/types';
import { toId } from 'storybook/internal/csf';

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDocgenProvider } from '../../../../renderers/svelte/src/docgen/docgen-worker.ts';
import { recordArgTypesSnapshot } from '../compare/record-argtypes-snapshot.ts';
import { BASELINE_PATH } from './baseline-path.ts';

if (BASELINE_PATH !== 'legacy') {
  throw new Error(
    'svelte-osa-baselines.test.ts gates the server recorder against the legacy runtime baselines; update the recorder or baseline-path.ts'
  );
}

// Typed locally: the preset's own declarations pull `@storybook/svelte` globals into this Vue-typed program.
const { experimental_indexers } = await vi.importActual<{
  experimental_indexers: (existing: Indexer[], options: Options) => Indexer[];
}>('@storybook/addon-svelte-csf/preset');

const [svelteCsfIndexer] = experimental_indexers([], {} as Options);

if (!svelteCsfIndexer) {
  throw new Error('@storybook/addon-svelte-csf/preset no longer contributes an indexer');
}

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

const provider = createDocgenProvider()(async () => undefined);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('svelte server-side docgen baselines (red until the provider emits payloads)', () => {
  it.fails.each(fixtureCases)('%s', async (fixtureCase) => {
    const testDir = join(fixturesDir, fixtureCase);
    vi.spyOn(process, 'cwd').mockReturnValue(testDir);

    const payload = await provider({ entry: entries.get(fixtureCase)! });

    expect(payload, `${fixtureCase}: no OSA payload recorded`).toBeDefined();
    expect(JSON.stringify(payload)).not.toContain(testDir);
    const { argTypes, ...withoutArgTypes } = payload!;
    expect(argTypes, `${fixtureCase}: no OSA argTypes recorded`).toBeDefined();

    await recordArgTypesSnapshot({
      path: join(testDir, 'osa-argtypes.snapshot'),
      label: `${fixtureCase}/osa-argtypes.snapshot`,
      candidate: argTypes!,
      extraGates: [
        {
          committed: readFileSync(join(testDir, 'argtypes.snapshot'), 'utf8'),
          label: `${fixtureCase}/argtypes.snapshot`,
          legacyBaseline: true,
        },
      ],
    });
    await expect(withoutArgTypes).toMatchFileSnapshot(join(testDir, 'osa-payload.snapshot'));
    await expect(payload?.description ?? '').toMatchFileSnapshot(
      join(testDir, 'osa-description.snapshot')
    );
  });
});
