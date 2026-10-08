import { describe, expect, it } from 'vitest';

import { isReactFramework } from './framework-name.ts';

describe('isReactFramework', () => {
  it.each([
    '@storybook/react',
    '@storybook/react-vite',
    '@storybook/react-webpack5',
    '@storybook/nextjs',
    '@storybook/nextjs-vite',
    '@storybook/experimental-nextjs-vite',
  ])('recognizes %s as a React framework', (frameworkName) => {
    expect(isReactFramework(frameworkName)).toBe(true);
  });

  it.each(['@storybook/preact-vite', '@storybook/vue3-vite', undefined])(
    'does not recognize %s as a React framework',
    (frameworkName) => {
      expect(isReactFramework(frameworkName)).toBe(false);
    }
  );
});
