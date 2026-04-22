import { expect, it } from 'vitest';

import type { Configuration } from 'webpack';

import { configureNodePolyfills } from './webpack.ts';

it('adds the next-compatible node polyfills without enabling assert', () => {
  const config = configureNodePolyfills({ resolve: { fallback: { path: false } } } as Configuration);

  expect(config.plugins).toHaveLength(2);
  expect(config.resolve?.fallback).toMatchObject({
    assert: false,
    fs: false,
    path: false,
    process: expect.stringContaining('process'),
    zlib: expect.stringContaining('browserify-zlib'),
  });
});
