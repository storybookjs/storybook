// @vitest-environment node
import type { Storybook } from '@storybook/core';

import { describe, expect, it } from 'vitest';

import { relative } from 'pathe';

import webComponents from './node.ts';

const PACKAGE_DIR = new URL('..', import.meta.url).pathname;

type Registered = { name: string; kind?: string; fn: (value: unknown) => unknown };

/** Run the addon's setup against a recorder whose `callHook` answers from `seeds`. */
function setup(seeds: Record<string, unknown> = {}): Registered[] {
  const hooks: Registered[] = [];
  webComponents().setup({
    configDir: '/project/.storybook',
    options: { features: {} },
    hook: (name: string, fn: Registered['fn'], kind?: string) => hooks.push({ name, kind, fn }),
    callHook: async (name: string) => seeds[name],
  } as unknown as Storybook);
  return hooks;
}

const call = async (name: string, value: unknown, seeds?: Record<string, unknown>) =>
  setup(seeds)
    .find((hook) => hook.name === name)!
    .fn(value);

describe('web-components node addon', () => {
  it('registers its hooks in order', () => {
    expect(setup().map(({ name, kind }) => (kind ? `${name} (${kind})` : name)))
      .toMatchInlineSnapshot(`
        [
          "preview:annotations:collect",
          "core:docgen-enabled:extend",
          "core:docgen-providers:collect",
          "core:story-docs-provider:extend",
          "index:manifests:extend",
        ]
      `);
  });

  it.each([
    {
      name: 'without docs',
      docs: {},
      expected: ['dist/entry-preview.js', 'dist/entry-preview-argtypes.js'],
    },
    {
      name: 'with docs',
      docs: { defaultName: 'Docs' },
      expected: [
        'dist/entry-preview.js',
        'dist/entry-preview-argtypes.js',
        'dist/entry-preview-docs.js',
      ],
    },
  ])('preview annotations $name', async ({ docs, expected }) => {
    const entries = (await call('preview:annotations:collect', [], {
      'core:docs:extend': docs,
    })) as string[];
    expect(entries.map((entry) => relative(PACKAGE_DIR, entry))).toEqual(expected);
  });

  it('turns server docgen on by default', async () => {
    expect(await call('core:docgen-enabled:extend', undefined)).toBe(true);
  });

  it.each([
    { name: 'manifests off', features: {}, expected: {} },
    {
      name: 'server docgen and manifests on',
      features: { docgenServer: true, componentsManifest: true },
      expected: {
        components: {
          v: 0,
          components: {},
          meta: { docgen: 'custom-elements-manifest', durationMs: 0 },
        },
      },
    },
  ])('manifests with $name', async ({ features, expected }) => {
    expect(await call('index:manifests:extend', {}, { 'core:features:extend': features })).toEqual(
      expected
    );
  });
});
