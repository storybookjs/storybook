import { expect, it } from 'vitest';

import type { Configuration } from 'webpack';
import { ProvidePlugin } from 'webpack';

import { configureNodePolyfills } from './webpack.ts';

it('adds minimal node polyfills without crypto-browserify', () => {
  const config = configureNodePolyfills({
    resolve: { fallback: { path: false } },
  } as Configuration);

  expect(config.plugins).toHaveLength(2);
  expect(config.plugins?.[1]).toBeInstanceOf(ProvidePlugin);
  expect(config.resolve?.fallback).toMatchObject({
    assert: false,
    crypto: false,
    fs: false,
    path: false,
    buffer: expect.stringContaining('buffer'),
    process: expect.stringContaining('process'),
    stream: expect.stringContaining('stream-browserify'),
    util: expect.stringContaining('util'),
    zlib: expect.stringContaining('browserify-zlib'),
  });
});
