import { beforeEach, expect, it, vi } from 'vitest';

import type { Configuration } from 'webpack';
import webpack from 'webpack';

import { addScopedAlias, isNextVersionGte, resolveNextConfig } from '../utils.ts';

vi.mock('../utils.ts', { spy: true });

beforeEach(() => {
  vi.mocked(addScopedAlias).mockImplementation(() => {});
  vi.mocked(isNextVersionGte).mockReturnValue(true);
  vi.mocked(resolveNextConfig).mockResolvedValue({
    trailingSlash: true,
    skipTrailingSlashRedirect: false,
    experimental: {},
  });
});

it('creates the Next.js DefinePlugin from the selected compiler instance', async () => {
  const { configureConfig } = await import('./webpack.ts');
  class CompilerDefinePlugin extends webpack.DefinePlugin {}
  const compilerWebpack = { ...webpack, DefinePlugin: CompilerDefinePlugin } as typeof webpack;
  const config: Configuration = { plugins: [] };

  await configureConfig({ baseConfig: config, webpackInstance: compilerWebpack });

  expect(config.plugins?.[0]).toBeInstanceOf(CompilerDefinePlugin);
});
