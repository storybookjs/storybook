import { describe, expect, it } from 'vitest';

import { filterPresetsConfig } from './presets';

describe('filterPresetsConfig', () => {
  it('string config', () => {
    expect(filterPresetsConfig(['@storybook/preset-scss', '@storybook/preset-typescript'])).toEqual(
      ['@storybook/preset-scss']
    );
  });

  it('windows paths', () => {
    expect(filterPresetsConfig(['a', '@storybook\\preset-typescript'])).toEqual(['a']);
  });

  it('object config', () => {
    const tsConfig = {
      name: '@storybook/preset-typescript',
      options: { foo: 1 },
    };
    expect(filterPresetsConfig([tsConfig, 'a'])).toEqual(['a']);
  });
});
