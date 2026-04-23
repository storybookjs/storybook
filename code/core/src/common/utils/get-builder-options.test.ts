import { describe, expect, it } from 'vitest';

import { extractBuilderOptions } from './get-builder-options.ts';

describe('extractBuilderOptions', () => {
  it('returns empty object for string framework', () => {
    expect(extractBuilderOptions('@storybook/react-vite')).toEqual({});
  });

  it('returns empty object when framework has no options', () => {
    expect(extractBuilderOptions({ name: '@storybook/react-vite' })).toEqual({});
  });

  it('returns empty object when framework options has no builder', () => {
    expect(extractBuilderOptions({ name: '@storybook/react-vite', options: {} })).toEqual({});
  });

  it('returns builder options from framework object', () => {
    const builderOptions = { fsCache: true, lazyCompilation: false };
    expect(
      extractBuilderOptions({ name: '@storybook/nextjs', options: { builder: builderOptions } })
    ).toEqual(builderOptions);
  });
});
