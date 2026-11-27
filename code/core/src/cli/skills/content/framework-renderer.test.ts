import { describe, expect, it } from 'vitest';

import { frameworkToRendererMap } from './framework-renderer.ts';

describe('frameworkToRendererMap', () => {
  it.each([
    ['@storybook/react-vite', '@storybook/react'],
    ['@storybook/tanstack-react', '@storybook/react'],
    ['storybook-react-rsbuild', '@storybook/react'],
    ['@storybook-vue/nuxt', '@storybook/vue3'],
    ['@storybook-astro/framework', '@storybook-astro/renderer'],
  ])('maps %s to %s', (framework, renderer) => {
    expect(frameworkToRendererMap[framework]).toBe(renderer);
  });
});
