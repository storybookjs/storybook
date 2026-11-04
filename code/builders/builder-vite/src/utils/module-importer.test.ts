import { describe, expect, it } from 'vitest';

import type { Options } from 'storybook/internal/types';

import { getModuleImporter } from './module-importer.ts';

const optionsWith = (moduleImporter?: unknown) =>
  ({ presets: { apply: async () => moduleImporter } }) as unknown as Options;

describe('getModuleImporter', () => {
  it('normalizes a Windows path', async () => {
    expect(await getModuleImporter(optionsWith('C:\\project\\importer.js'))).toBe(
      'C:/project/importer.js'
    );
  });

  it('keeps a package specifier', async () => {
    expect(await getModuleImporter(optionsWith('my-framework/importer'))).toBe(
      'my-framework/importer'
    );
  });

  it('converts a file URL to a path', async () => {
    expect(await getModuleImporter(optionsWith('file:///project/importer.js'))).toBe(
      '/project/importer.js'
    );
    expect(await getModuleImporter(optionsWith(new URL('file:///project/importer.js')))).toBe(
      '/project/importer.js'
    );
  });

  it('rejects a value that is not a string', async () => {
    await expect(getModuleImporter(optionsWith(42))).rejects.toThrow(
      'must be an absolute path or a package specifier'
    );
  });

  it('rejects a relative path', async () => {
    await expect(getModuleImporter(optionsWith('./importer.js'))).rejects.toThrow(
      'must be an absolute path or a package specifier'
    );
  });

  it('is undefined without the preset', async () => {
    expect(await getModuleImporter(optionsWith())).toBeUndefined();
  });
});
