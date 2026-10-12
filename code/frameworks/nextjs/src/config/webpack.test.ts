import { expect, it, vi } from 'vitest';

import type { Configuration } from 'webpack';
import webpack from 'webpack';

import { configureConfig } from './webpack.ts';

vi.mock('../utils.ts', () => ({
  addScopedAlias: vi.fn(),
  isNextVersionGte: () => true,
  resolveNextConfig: () => ({
    trailingSlash: true,
    skipTrailingSlashRedirect: false,
    experimental: {},
  }),
}));

it('creates the Next.js DefinePlugin from the selected compiler instance', async () => {
  class CompilerDefinePlugin extends webpack.DefinePlugin {}
  const compilerWebpack = { ...webpack, DefinePlugin: CompilerDefinePlugin } as typeof webpack;
  const config: Configuration = { plugins: [] };

  await configureConfig({ baseConfig: config, webpackInstance: compilerWebpack });

  expect(config.plugins?.[0]).toBeInstanceOf(CompilerDefinePlugin);
});
