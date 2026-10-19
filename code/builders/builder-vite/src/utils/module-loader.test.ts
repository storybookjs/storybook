import { describe, expect, it } from 'vitest';

import type { Options } from 'storybook/internal/types';

import { getModuleLoader } from './module-loader.ts';

const optionsWith = (moduleLoader?: string) =>
  ({ presets: { apply: async () => moduleLoader } }) as unknown as Options;

describe('getModuleLoader', () => {
  it('normalizes a Windows path', async () => {
    expect(await getModuleLoader(optionsWith('C:\\project\\loader.js'))).toBe(
      'C:/project/loader.js'
    );
  });

  it('keeps a package specifier', async () => {
    expect(await getModuleLoader(optionsWith('my-framework/loader'))).toBe('my-framework/loader');
  });

  it('is undefined without the preset', async () => {
    expect(await getModuleLoader(optionsWith())).toBeUndefined();
  });
});
