// @vitest-environment node
import type { Storybook } from '@storybook/core';

import { describe, expect, it } from 'vitest';

import { relative } from 'pathe';

import preact from './node.ts';

const PACKAGE_DIR = new URL('..', import.meta.url).pathname;

type Registered = { name: string; kind?: string; fn: (value: unknown) => unknown };

/** Run the addon's setup against a recorder whose `callHook` answers from `seeds`. */
function setup(seeds: Record<string, unknown> = {}): Registered[] {
  const hooks: Registered[] = [];
  preact().setup({
    configDir: '/project/.storybook',
    hook: (name: string, fn: Registered['fn'], kind?: string) => hooks.push({ name, kind, fn }),
    callHook: async (name: string) => seeds[name],
  } as unknown as Storybook);
  return hooks;
}

const call = async (name: string, value: unknown, seeds?: Record<string, unknown>) =>
  setup(seeds)
    .find((hook) => hook.name === name)!
    .fn(value);

describe('preact node addon', () => {
  it('registers its hooks in order', () => {
    expect(setup().map(({ name, kind }) => (kind ? `${name} (${kind})` : name)))
      .toMatchInlineSnapshot(`
        [
          "preview:annotations:collect",
          "legacy:resolvedReact:extend (reduce)",
          "builder:vite-deps:collect (collect)",
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
    const entries = (await call('preview:annotations:collect', [], {
      'core:docs:extend': docs,
    })) as string[];
    expect(entries.map((entry) => relative(PACKAGE_DIR, entry))).toEqual(expected);
  });

  it.each<{ name: string; hook: string; input: unknown; expected: unknown }>([
    {
      name: 'aliases React to preact/compat',
      hook: 'legacy:resolvedReact:extend',
      input: { other: 'kept', react: '/project/node_modules/react' },
      expected: { other: 'kept', react: 'preact/compat', reactDom: 'preact/compat' },
    },
    {
      name: 'pre-bundles the compat JSX runtime',
      hook: 'builder:vite-deps:collect',
      input: [],
      expected: ['preact/compat/jsx-runtime'],
    },
  ])('$name', async ({ hook, input, expected }) => {
    expect(await call(hook, input)).toEqual(expected);
  });
});
