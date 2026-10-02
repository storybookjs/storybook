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
  const config = configureNodePolyfills({
    resolve: { fallback: { crypto: '/user/crypto-browserify', stream: false } },
  } as Configuration);

  expect(config.resolve?.fallback).toMatchObject({
    crypto: '/user/crypto-browserify',
    stream: false,
  });
});
