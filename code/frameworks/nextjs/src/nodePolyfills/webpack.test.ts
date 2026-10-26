import { expect, it } from 'vitest';

import type { Configuration } from 'webpack';
import webpack from 'webpack';

import { configureNodePolyfills } from './webpack.ts';

it('adds minimal node polyfills without crypto-browserify', () => {
  const config = configureNodePolyfills(
    {
      resolve: { fallback: { path: false } },
    } as Configuration,
    webpack
  );

  expect(config.plugins).toHaveLength(2);
  expect(config.plugins?.[1]).toBeInstanceOf(webpack.ProvidePlugin);
  expect(config.resolve?.fallback).toMatchObject({
    fs: false,
    path: false,
    buffer: expect.stringContaining('buffer'),
    events: expect.stringContaining('events'),
    process: expect.stringContaining('process'),
    stream: expect.stringContaining('stream-browserify'),
    util: expect.stringContaining('util'),
    zlib: expect.stringContaining('browserify-zlib'),
  });
  expect(config.resolve?.fallback).not.toHaveProperty('crypto');
});

it('lets caller fallbacks override the defaults', () => {
  const config = configureNodePolyfills(
    {
      resolve: { fallback: { crypto: '/user/crypto-browserify', stream: false } },
    } as Configuration,
    webpack
  );

  expect(config.resolve?.fallback).toMatchObject({
    crypto: '/user/crypto-browserify',
    stream: false,
  });
});

it('creates plugins from the selected compiler instance', () => {
  class CompilerProvidePlugin extends webpack.ProvidePlugin {}
  class CompilerNormalModuleReplacementPlugin extends webpack.NormalModuleReplacementPlugin {}
  const compilerWebpack = {
    ...webpack,
    ProvidePlugin: CompilerProvidePlugin,
    NormalModuleReplacementPlugin: CompilerNormalModuleReplacementPlugin,
  } as typeof webpack;

  const config = configureNodePolyfills({}, compilerWebpack);

  expect(config.plugins?.[0]).toBeInstanceOf(CompilerNormalModuleReplacementPlugin);
  expect(config.plugins?.[1]).toBeInstanceOf(CompilerProvidePlugin);
});
