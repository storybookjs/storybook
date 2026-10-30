import type { Storybook } from '@storybook/core';

import { describe, expect, it } from 'vitest';

import { relative } from 'pathe';

import react from './node.ts';

const PACKAGE_DIR = new URL('..', import.meta.url).pathname;

type Registered = { name: string; kind?: string; fn: (value: unknown) => unknown };

/** Run the addon's setup against a recorder whose `callHook` answers from `seeds`. */
function setup(seeds: Record<string, unknown> = {}): Registered[] {
  const hooks: Registered[] = [];
  react().setup({
    configDir: '/project/.storybook',
    options: { features: {} },
    hook: (name: string, fn: Registered['fn'], kind?: string) => hooks.push({ name, kind, fn }),
    callHook: async (name: string) => seeds[name],
  } as unknown as Storybook);
  return hooks;
}

async function call(name: string, value: unknown, seeds?: Record<string, unknown>) {
  const result = await setup(seeds)
    .find((hook) => hook.name === name)!
    .fn(value);
  return JSON.parse(
    JSON.stringify(result, (_key, item) =>
      typeof item === 'string' && item.startsWith(PACKAGE_DIR)
        ? `<pkg>/${relative(PACKAGE_DIR, item)}`
        : item
    )
  );
}

describe('react node addon', () => {
  it('turns component manifests on before setup', () => {
    expect(react().features).toEqual({ componentsManifest: true });
  });

  it('registers its hooks in order', () => {
    expect(setup().map(({ name, kind }) => (kind ? `${name} (${kind})` : name)))
      .toMatchInlineSnapshot(`
        [
          "preview:annotations:collect",
          "core:docgen-enabled:extend",
          "core:docgen-providers:collect",
          "core:story-docs-provider:extend",
          "index:manifests:extend",
          "legacy:experimental_enrichCsf:extend (reduce)",
          "legacy:resolvedReact:extend (reduce)",
          "legacy:internal_getArgTypesData:extend (reduce)",
          "builder:vite-deps:collect (collect)",
          "core:instance:close",
        ]
      `);
  });

  it.each<{ name: string; hook: string; input: unknown; seeds?: object; expected: unknown }>([
    {
      name: 'preview annotations without docs',
      hook: 'preview:annotations:collect',
      input: [],
      seeds: { 'core:docs:extend': {}, 'core:features:extend': {} },
      expected: ['<pkg>/dist/entry-preview.js', '<pkg>/dist/entry-preview-argtypes.js'],
    },
    {
      name: 'preview annotations with docs and RSC',
      hook: 'preview:annotations:collect',
      input: [],
      seeds: {
        'core:docs:extend': { defaultName: 'Docs' },
        'core:features:extend': { experimentalRSC: true },
      },
      expected: [
        '<pkg>/dist/entry-preview.js',
        '<pkg>/dist/entry-preview-argtypes.js',
        '<pkg>/dist/entry-preview-docs.js',
        '<pkg>/dist/entry-preview-rsc.js',
      ],
    },
    {
      name: 'docgen enabled with typescript installed',
      hook: 'core:docgen-enabled:extend',
      input: undefined,
      expected: true,
    },
    {
      name: 'docgen providers',
      hook: 'core:docgen-providers:collect',
      input: [],
      expected: [{ moduleSpecifier: '<pkg>/dist/docgen/docgen-worker.js' }],
    },
    {
      name: 'vite deps',
      hook: 'builder:vite-deps:collect',
      input: [],
      expected: ['react', 'react-dom/client', 'react-dom/test-utils', 'react/jsx-runtime'],
    },
    {
      name: 'project React aliases',
      hook: 'legacy:resolvedReact:extend',
      input: { other: 'kept' },
      expected: {
        other: 'kept',
        react: expect.stringMatching(/node_modules\/react$/),
        reactDom: expect.stringMatching(/node_modules\/react-dom$/),
      },
    },
  ])('$name', async ({ hook, input, seeds, expected }) => {
    expect(await call(hook, input, seeds as Record<string, unknown>)).toEqual(expected);
  });

  it('adds an empty components manifest beside earlier ones when nothing is indexed', async () => {
    expect(
      await call('index:manifests:extend', { existing: true }, { 'core:typescript:extend': {} })
    ).toMatchInlineSnapshot(`
      {
        "components": {
          "components": {},
          "meta": {
            "docgen": "react-docgen",
            "durationMs": 0,
          },
          "v": 0,
        },
        "existing": true,
      }
    `);
  });
});
