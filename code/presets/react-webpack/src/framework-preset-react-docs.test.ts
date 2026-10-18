import { describe, expect, it } from 'vitest';

import ReactDocgenTypescriptPlugin from '@storybook/react-docgen-typescript-plugin';

import type { ReactDocgenPlan } from '../../../renderers/react/src/docgen/engine.ts';
import * as preset from './framework-preset-react-docs.ts';

const runWebpackFinal = (builder: ReactDocgenPlan['builder']) =>
  preset.webpackFinal?.({ plugins: [] }, {
    presets: {
      apply: async (name: string) => {
        if (name === 'internal_reactDocgenPlan') {
          return { builder };
        }
        if (name === 'typescript') {
          return { reactDocgenTypescriptOptions: {} };
        }
        return undefined;
      },
    },
  } as any);

const loaderRule = (test: RegExp) => ({
  test,
  enforce: 'pre',
  loader: expect.stringContaining('react-docgen-loader'),
  options: { debug: false },
  exclude: /(\.(stories|story)\.(js|jsx|ts|tsx))|(node_modules)/,
});

describe('framework-preset-react-docs', () => {
  it('runs the react-docgen loader on every file', async () => {
    expect(await runWebpackFinal({ reactDocgen: 'all', reactDocgenTypescript: false })).toEqual({
      plugins: [],
      module: { rules: [loaderRule(/\.(cjs|mjs|tsx?|jsx?)$/)] },
    });
  });

  it('adds react-docgen-typescript and runs the loader on JavaScript files', async () => {
    expect(await runWebpackFinal({ reactDocgen: 'js', reactDocgenTypescript: true })).toEqual({
      plugins: [expect.any(ReactDocgenTypescriptPlugin)],
      module: { rules: [loaderRule(/\.(cjs|mjs|jsx?)$/)] },
    });
  });

  it('adds react-docgen-typescript without the loader when react-docgen is missing', async () => {
    expect(await runWebpackFinal({ reactDocgen: false, reactDocgenTypescript: true })).toEqual({
      plugins: [expect.any(ReactDocgenTypescriptPlugin)],
      module: { rules: [] },
    });
  });

  it('leaves the config alone when builder docgen is off', async () => {
    expect(await runWebpackFinal({ reactDocgen: false, reactDocgenTypescript: false })).toEqual({
      plugins: [],
    });
  });
});
