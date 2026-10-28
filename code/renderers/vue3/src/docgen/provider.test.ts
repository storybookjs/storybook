import { describe, expect, it } from 'vitest';

import { getDocgenProvider, getManifests } from './provider.ts';

describe('getDocgenProvider', () => {
  it('points at the renderer worker', () => {
    expect(getDocgenProvider().moduleSpecifier).toMatch(/docgen-worker\.js$/);
  });
});

describe('getManifests', () => {
  it.each([
    {
      name: 'declares the server engine',
      features: { docgenServer: true },
      expected: {
        components: { v: 0, components: {}, meta: { docgen: 'vue-component-meta', durationMs: 0 } },
      },
    },
    { name: 'contributes nothing when the docgen service is off', features: {}, expected: {} },
  ])('$name', ({ features, expected }) => {
    expect(getManifests({}, features)).toEqual(expected);
  });
});
