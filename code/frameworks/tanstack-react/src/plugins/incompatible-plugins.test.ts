import { describe, expect, it } from 'vitest';

import { isCloudflareVitePlugin, isTanStackStartPlugin } from './incompatible-plugins.ts';

describe('isTanStackStartPlugin', () => {
  it.each(['tanstack-start', 'tanstack-start:config', 'vite-plugin-rsc:transform'])(
    'matches %s',
    (name) => {
      expect(isTanStackStartPlugin({ name })).toBe(true);
    }
  );

  it('matches nested plugin arrays', () => {
    expect(isTanStackStartPlugin([{ name: 'other' }, [{ name: 'tanstack-start:core' }]])).toBe(
      true
    );
  });

  it.each([{ name: 'vite-plugin-react' }, null, undefined, 'tanstack-start', []])(
    'does not match %o',
    (plugin) => {
      expect(isTanStackStartPlugin(plugin)).toBe(false);
    }
  );
});

describe('isCloudflareVitePlugin', () => {
  it('matches the main plugin', () => {
    expect(isCloudflareVitePlugin({ name: 'vite-plugin-cloudflare' })).toBe(true);
  });

  it.each([
    'vite-plugin-cloudflare:config',
    'vite-plugin-cloudflare:dev',
    'vite-plugin-cloudflare:virtual-modules',
  ])('matches the %s sub-plugin', (name) => {
    expect(isCloudflareVitePlugin({ name })).toBe(true);
  });

  it('matches nested plugin arrays as returned by cloudflare()', () => {
    expect(
      isCloudflareVitePlugin([
        { name: 'vite-plugin-cloudflare' },
        { name: 'vite-plugin-cloudflare:dev' },
      ])
    ).toBe(true);
  });

  it.each([
    { name: 'vite-plugin-cloudflare-lookalike' },
    { name: 'cloudflare' },
    null,
    undefined,
    [],
  ])('does not match %o', (plugin) => {
    expect(isCloudflareVitePlugin(plugin)).toBe(false);
  });
});
