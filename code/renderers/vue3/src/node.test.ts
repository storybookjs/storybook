// @vitest-environment node
import type { Storybook } from '@storybook/core';

import { describe, expect, it } from 'vitest';

import { relative } from 'pathe';

import vue from './node.ts';

const PACKAGE_DIR = new URL('..', import.meta.url).pathname;

type Registered = { name: string; kind?: string; fn: (value: unknown) => unknown };

/** Run the addon's setup against a recorder whose `callHook` answers from `seeds`. */
function setup(seeds: Record<string, unknown> = {}, features = {}): Registered[] {
  const hooks: Registered[] = [];
  vue().setup({
    configDir: '/project/.storybook',
    options: { features },
    hook: (name: string, fn: Registered['fn'], kind?: string) => hooks.push({ name, kind, fn }),
    callHook: async (name: string) => seeds[name],
  } as unknown as Storybook);
  return hooks;
}

const call = async (name: string, value: unknown, seeds?: Record<string, unknown>) =>
  JSON.parse(
    JSON.stringify(
      await setup(seeds)
        .find((hook) => hook.name === name)!
        .fn(value),
      (_key, item) =>
        typeof item === 'string' && item.startsWith(PACKAGE_DIR)
          ? `<pkg>/${relative(PACKAGE_DIR, item)}`
          : item
    )
  );

describe('vue3 node addon', () => {
  it('registers its hooks in order', () => {
    expect(setup().map(({ name, kind }) => (kind ? `${name} (${kind})` : name)))
      .toMatchInlineSnapshot(`
        [
          "preview:annotations:collect",
          "core:docgen-enabled:extend",
          "core:docgen-providers:collect",
          "core:story-docs-provider:extend",
          "index:manifests:extend",
          "core:import-parsers:collect",
          "legacy:experimental_vueDocgenEngine:extend (reduce)",
        ]
      `);
  });

  it.each<{ name: string; hook: string; input: unknown; seeds?: object; expected: unknown }>([
    {
      name: 'preview annotations without docs',
      hook: 'preview:annotations:collect',
      input: [],
      seeds: { 'core:docs:extend': {} },
      expected: ['<pkg>/dist/entry-preview.js'],
    },
    {
      name: 'preview annotations with docs',
      hook: 'preview:annotations:collect',
      input: [],
      seeds: { 'core:docs:extend': { defaultName: 'Docs' } },
      expected: ['<pkg>/dist/entry-preview.js', '<pkg>/dist/entry-preview-docs.js'],
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
  ])('$name', async ({ hook, input, seeds, expected }) => {
    expect(await call(hook, input, seeds as Record<string, unknown>)).toEqual(expected);
  });

  it('turns component manifests on before setup', () => {
    expect(vue().features).toEqual({ componentsManifest: true });
  });

  it('declares component manifests only with the docgen server', async () => {
    const inputs = { 'docgen server on': { docgenServer: true }, 'docgen server off': {} };
    const outputs: Record<string, unknown> = {};
    for (const [name, features] of Object.entries(inputs)) {
      outputs[name] = await setup({}, features)
        .find((hook) => hook.name === 'index:manifests:extend')!
        .fn({ existing: true });
    }
    expect(outputs).toMatchInlineSnapshot(`
      {
        "docgen server off": {
          "existing": true,
        },
        "docgen server on": {
          "components": {
            "components": {},
            "meta": {
              "docgen": "vue-component-meta",
              "durationMs": 0,
            },
            "v": 0,
          },
          "existing": true,
        },
      }
    `);
  });

  it('contributes the Vue import parser', async () => {
    const parsers = (await setup()
      .find((hook) => hook.name === 'core:import-parsers:collect')!
      .fn([])) as unknown[];
    expect(parsers).toHaveLength(1);
  });
});
