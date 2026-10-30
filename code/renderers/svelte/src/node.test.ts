// @vitest-environment node
import type { Storybook } from '@storybook/core';
import type { Indexer } from '@storybook/core/internal/types';

import { describe, expect, it } from 'vitest';

import { relative } from 'pathe';

import svelte from './node.ts';

const PACKAGE_DIR = new URL('..', import.meta.url).pathname;

type Registered = { name: string; kind?: string; fn: (value: unknown) => unknown };

/** Run the addon's setup against a recorder whose `callHook` answers from `seeds`. */
function setup(seeds: Record<string, unknown> = {}, features = {}): Registered[] {
  const hooks: Registered[] = [];
  svelte().setup({
    configDir: '/project/.storybook',
    options: { features },
    hook: (name: string, fn: Registered['fn'], kind?: string) => hooks.push({ name, kind, fn }),
    callHook: async (name: string) => seeds[name],
  } as unknown as Storybook);
  return hooks;
}

const find = (hooks: Registered[], name: string) => hooks.find((hook) => hook.name === name)!;

describe('svelte node addon', () => {
  it('registers its hooks in order', () => {
    expect(setup().map(({ name, kind }) => (kind ? `${name} (${kind})` : name)))
      .toMatchInlineSnapshot(`
        [
          "preview:annotations:collect",
          "core:import-parsers:collect",
          "index:indexers:collect (reduce)",
          "core:story-docs-provider:extend",
          "index:manifests:extend",
        ]
      `);
  });

  it.each([
    { name: 'without docs', docs: {}, expected: ['dist/entry-preview.js'] },
    {
      name: 'with docs',
      docs: { defaultName: 'Docs' },
      expected: ['dist/entry-preview.js', 'dist/entry-preview-docs.js'],
    },
  ])('preview annotations $name', async ({ docs, expected }) => {
    const entries = (await find(
      setup({ 'core:docs:extend': docs }),
      'preview:annotations:collect'
    ).fn([])) as string[];
    expect(entries.map((entry) => relative(PACKAGE_DIR, entry))).toEqual(expected);
  });

  it('adds the Svelte CSF indexer before the other indexers', async () => {
    const otherIndexer: Indexer = { test: /\.stories\.ts$/, createIndex: async () => [] };
    const indexers = (await find(setup(), 'index:indexers:collect').fn([
      otherIndexer,
    ])) as Indexer[];

    expect(indexers).toHaveLength(2);
    expect(indexers[0].test.test('Button.stories.svelte')).toBe(true);
    expect(indexers[1]).toBe(otherIndexer);
  });

  it('contributes the Svelte import parser', async () => {
    expect(await find(setup(), 'core:import-parsers:collect').fn([])).toHaveLength(1);
  });

  it.each([
    { name: 'manifests off', features: {}, expected: {} },
    {
      name: 'server docgen and manifests on',
      features: { docgenServer: true, componentsManifest: true },
      expected: {
        components: { v: 0, components: {}, meta: { docgen: 'svelte2tsx', durationMs: 0 } },
      },
    },
  ])('$name', async ({ features, expected }) => {
    expect(await find(setup({}, features), 'index:manifests:extend').fn({})).toEqual(expected);
  });
});
