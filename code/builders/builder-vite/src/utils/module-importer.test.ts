import { describe, expect, it } from 'vitest';

import { getPresets } from 'storybook/internal/common';
import type { Options } from 'storybook/internal/types';

import { getModuleImporters } from './module-importer.ts';

const optionsWith = (moduleImporters?: unknown) =>
  ({
    presets: { apply: async (_name: string, initial: unknown) => moduleImporters ?? initial },
  }) as unknown as Options;

describe('getModuleImporters', () => {
  it('normalizes a Windows path', async () => {
    expect(await getModuleImporters(optionsWith(['C:\\project\\importer.js']))).toEqual([
      'C:/project/importer.js',
    ]);
  });

  it('keeps a package specifier', async () => {
    expect(await getModuleImporters(optionsWith(['my-framework/importer']))).toEqual([
      'my-framework/importer',
    ]);
  });

  it('converts a file URL to a path', async () => {
    expect(await getModuleImporters(optionsWith(['file:///project/importer.js']))).toEqual([
      '/project/importer.js',
    ]);
  });

  it('keeps a module listed twice at its last place, so the main config can move it', async () => {
    expect(
      await getModuleImporters(
        optionsWith(['/framework/importer.js', '/project/importer.js', '/framework/importer.js'])
      )
    ).toEqual(['/project/importer.js', '/framework/importer.js']);
  });

  it('rejects a URL that is not a file URL', async () => {
    await expect(
      getModuleImporters(optionsWith(['https://example.com/importer.js']))
    ).rejects.toThrow('must be an absolute path, a `file:` URL or a package specifier');
  });

  it('rejects an entry that is not a string', async () => {
    await expect(getModuleImporters(optionsWith([42]))).rejects.toThrow(
      'must be an absolute path, a `file:` URL or a package specifier'
    );
  });

  it('rejects a value that is not an array', async () => {
    await expect(getModuleImporters(optionsWith('/project/importer.js'))).rejects.toThrow(
      'must be an array of module specifiers'
    );
  });

  it('rejects a relative path', async () => {
    await expect(getModuleImporters(optionsWith(['./importer.js']))).rejects.toThrow(
      'must be an absolute path, a `file:` URL or a package specifier'
    );
  });

  it('is empty without the preset', async () => {
    expect(await getModuleImporters(optionsWith())).toEqual([]);
  });
});

describe('getModuleImporters with the preset system', () => {
  // The framework's preset, then the main config, in the order Storybook loads them
  async function presetsOf(main: Record<string, unknown>) {
    const presets = await getPresets(
      [
        {
          type: 'virtual',
          name: 'framework',
          experimental_moduleImporters: (entries: string[] = []) => [
            ...entries,
            '/framework/importer.js',
          ],
        },
        { type: 'virtual', name: 'main', ...main },
      ] as any,
      { isCritical: true } as any
    );
    return { presets } as unknown as Options;
  }

  it('appends a plain array of the main config to the framework importers', async () => {
    const options = await presetsOf({ experimental_moduleImporters: ['/project/importer.js'] });

    expect(await getModuleImporters(options)).toEqual([
      '/framework/importer.js',
      '/project/importer.js',
    ]);
  });

  it('replaces the framework importers with a function of the main config', async () => {
    const options = await presetsOf({
      experimental_moduleImporters: () => ['/project/importer.js'],
    });

    expect(await getModuleImporters(options)).toEqual(['/project/importer.js']);
  });
});
