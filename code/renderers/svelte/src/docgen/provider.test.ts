// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { getDocgenProvider, withSvelteManifests } from './provider.ts';

describe('getDocgenProvider', () => {
  it('points at the Svelte docgen worker', () => {
    expect(getDocgenProvider()).toEqual({
      moduleSpecifier: expect.stringMatching(/svelte[\\/]dist[\\/]docgen[\\/]docgen-worker\.js$/),
    });
  });
});

describe('withSvelteManifests', () => {
  it.each([
    { name: 'docgen server off', features: { componentsManifest: true }, expected: {} },
    { name: 'components manifest off', features: { docgenServer: true }, expected: {} },
    {
      name: 'both on',
      features: { docgenServer: true, componentsManifest: true },
      expected: {
        components: { v: 0, components: {}, meta: { docgen: 'svelte2tsx', durationMs: 0 } },
      },
    },
  ])('$name', ({ features, expected }) => {
    expect(withSvelteManifests({}, features)).toEqual(expected);
  });
});
