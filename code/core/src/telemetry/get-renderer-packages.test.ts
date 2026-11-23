import { describe, expect, it } from 'vitest';

import { getRendererPackages } from './get-renderer-packages.ts';

describe('getRendererPackages', () => {
  it('returns the runtime packages of a renderer', () => {
    expect(getRendererPackages('@storybook/react')).toEqual(['react', 'react-dom']);
  });

  it('returns the runtime packages of a community renderer', () => {
    expect(getRendererPackages('@storybook-astro/renderer')).toEqual(['astro']);
  });

  it('returns nothing for an unknown renderer', () => {
    expect(getRendererPackages('@acme/renderer')).toEqual([]);
  });
});
