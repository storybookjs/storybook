import { basename } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import type { Configuration } from 'webpack';

import { withReactDocgen } from './react-docgen.ts';

vi.mock('@storybook/core/internal/node-logger', () => ({ deprecate: vi.fn() }));

type Summary = {
  rules: { test: string; loader: string; enforce: unknown; options: unknown }[];
  plugins: string[];
};

type Input = {
  features: Record<string, unknown>;
  typescript: Record<string, unknown>;
  loglevel?: string;
};

async function summarize({ features, typescript, loglevel }: Input): Promise<Summary> {
  const config = await withReactDocgen({} as Configuration, {
    features,
    typescript,
    debug: loglevel === 'debug',
  });

  return {
    rules: ((config.module?.rules ?? []) as any[]).map((rule) => ({
      test: String(rule.test),
      loader: basename(rule.loader),
      enforce: rule.enforce,
      options: rule.options,
    })),
    plugins: (config.plugins ?? []).map((plugin) => String(plugin?.constructor.name)),
  };
}

describe('withReactDocgen', () => {
  it.each<{ name: string; input: Input; expected: Summary }>([
    {
      name: 'adds the docgen loader for react-docgen',
      input: { features: {}, typescript: { reactDocgen: 'react-docgen' } },
      expected: {
        rules: [
          {
            test: String(/\.(cjs|mjs|tsx?|jsx?)$/),
            loader: 'react-docgen-loader.js',
            enforce: 'pre',
            options: { debug: false },
          },
        ],
        plugins: [],
      },
    },
    {
      name: 'passes debug to the loader with the debug loglevel',
      input: { features: {}, typescript: { reactDocgen: 'react-docgen' }, loglevel: 'debug' },
      expected: {
        rules: [
          {
            test: String(/\.(cjs|mjs|tsx?|jsx?)$/),
            loader: 'react-docgen-loader.js',
            enforce: 'pre',
            options: { debug: true },
          },
        ],
        plugins: [],
      },
    },
    {
      name: 'adds the loader and plugin for react-docgen-typescript',
      input: { features: {}, typescript: { reactDocgen: 'react-docgen-typescript' } },
      expected: {
        rules: [
          {
            test: String(/\.(cjs|mjs|jsx?)$/),
            loader: 'react-docgen-loader.js',
            enforce: 'pre',
            options: { debug: false },
          },
        ],
        plugins: ['DocgenPlugin'],
      },
    },
    {
      name: 'does nothing when reactDocgen is false',
      input: { features: {}, typescript: { reactDocgen: false } },
      expected: { rules: [], plugins: [] },
    },
    {
      name: 'does nothing when the docgen server owns extraction',
      input: { features: { docgenServer: true }, typescript: { reactDocgen: 'react-docgen' } },
      expected: { rules: [], plugins: [] },
    },
  ])('$name', async ({ input, expected }) => {
    expect(await summarize(input)).toEqual(expected);
  });
});
