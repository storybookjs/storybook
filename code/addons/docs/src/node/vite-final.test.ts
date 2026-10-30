import { expect, it } from 'vitest';

import type { Storybook } from '@storybook/core';

import { extendViteConfig } from './vite-final.ts';

it.each([
  {
    name: 'MDX on',
    input: {},
    expected: ['storybook:mdx-plugin', 'storybook:package-deduplication', 'plugin-csf', 'user'],
  },
  { name: 'docs.mdx false', input: { mdx: false }, expected: ['plugin-csf', 'user'] },
])('adds the docs Vite plugins with $name', async ({ input, expected }) => {
  const storybook = {
    callHook: async (_name: string, value: unknown) => value,
    options: { docs: input },
  } as unknown as Storybook;

  const config = await extendViteConfig(storybook, { plugins: [{ name: 'user' }] }, {});

  expect(config.plugins.map((plugin: { name: string }) => plugin.name)).toEqual(expected);
});
