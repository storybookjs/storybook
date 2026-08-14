import fs from 'node:fs';
import path from 'node:path';

import type { NextConfigComplete } from 'next/dist/server/config-shared.js';
import type { PluginContext } from 'rollup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';

const requireResolveMock = vi.hoisted(() => vi.fn());

vi.mock('node:module', () => ({
  createRequire: () => ({
    resolve: requireResolveMock,
  }),
}));

vi.mock('node:fs', { spy: true });

import { decodeBase64Url, encodeBase64Url } from '../../utils/base64-url.ts';
import { vitePluginNextImage } from './plugin.ts';

const virtualImagePrefix = '\0virtual:next-image:';
const virtualImageId = (imagePath: string) => `${virtualImagePrefix}${encodeBase64Url(imagePath)}`;
const decodeVirtualImageId = (id: string) => decodeBase64Url(id.slice(virtualImagePrefix.length));

describe('vitePluginNextImage resolveId', () => {
  const nextConfigResolver = {
    promise: Promise.resolve({} as NextConfigComplete),
    resolve: vi.fn(),
    reject: vi.fn(),
  } as PromiseWithResolvers<NextConfigComplete>;

  const createContext = (resolve: PluginContext['resolve']) => ({ resolve }) as PluginContext;

  it('resolves relative image imports against importer', async () => {
    const plugin = vitePluginNextImage(nextConfigResolver);
    const resolve = vi.fn();
    const importer = '/project/src/Component.tsx';

    const result = await plugin.resolveId!.call(
      createContext(resolve),
      './images/avatar.png',
      importer
    );

    expect(resolve).not.toHaveBeenCalled();
    expect(result).toBe(virtualImageId(path.join(path.dirname(importer), './images/avatar.png')));
  });

  it('uses Vite resolver for package image imports', async () => {
    const plugin = vitePluginNextImage(nextConfigResolver);
    const resolvedPath = '/project/packages/assets/src/images/avatar.png';
    const resolve = vi.fn().mockResolvedValue({ id: resolvedPath });
    const result = await plugin.resolveId!.call(
      createContext(resolve),
      '@myorg/assets/images/avatar.png',
      '/project/src/Component.tsx'
    );

    expect(resolve).toHaveBeenCalledWith(
      '@myorg/assets/images/avatar.png',
      '/project/src/Component.tsx',
      { skipSelf: true }
    );
    expect(result).toBe(virtualImageId(resolvedPath));
  });

  it('falls back to require.resolve when Vite resolution fails', async () => {
    const plugin = vitePluginNextImage(nextConfigResolver);
    const importer = '/project/src/Component.tsx?import';
    const resolvedPath = '/project/packages/assets/src/images/avatar.png';
    const resolve = vi.fn().mockResolvedValue(null);

    requireResolveMock.mockReturnValueOnce(resolvedPath);
    const result = await plugin.resolveId!.call(
      createContext(resolve),
      '@myorg/assets/images/avatar.png',
      importer
    );

    expect(resolve).toHaveBeenCalled();
    expect(requireResolveMock).toHaveBeenCalledWith('@myorg/assets/images/avatar.png', {
      paths: [path.dirname(importer.split('?')[0])],
    });
    expect(result).toBe(virtualImageId(resolvedPath));
  });

  it('normalizes Windows backslashes in resolved image paths', async () => {
    // On Windows, Vite's resolver returns native paths with backslashes. Those
    // must be normalized before being embedded in the virtual id, otherwise the
    // generated `import ... from "<path>"` keeps backslashes and Rollup mangles
    // them (`git\voyages` -> `gitoyages`), breaking resolution. See #35872.
    const plugin = vitePluginNextImage(nextConfigResolver);
    const windowsPath = 'C:\\Users\\me\\git\\voyages\\src\\assets\\Foo.svg';
    const resolve = vi.fn().mockResolvedValue({ id: windowsPath });

    const result = await plugin.resolveId!.call(
      createContext(resolve),
      '@myorg/assets/Foo.svg',
      'C:\\Users\\me\\git\\voyages\\src\\Component.tsx'
    );

    const decoded = decodeVirtualImageId(result as string);
    expect(decoded).toBe('C:/Users/me/git/voyages/src/assets/Foo.svg');
    expect(decoded).not.toContain('\\');
  });
});

describe('vitePluginNextImage load', () => {
  const nextConfigResolver = {
    promise: Promise.resolve({} as NextConfigComplete),
    resolve: vi.fn(),
    reject: vi.fn(),
  } as PromiseWithResolvers<NextConfigComplete>;

  const avatarPath = '/project/src/images/avatar.png';
  const brokenPath = '/project/src/images/broken.png';

  // 1x1 red PNG
  const pngFixture = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );

  beforeEach(async () => {
    vol.reset();
    const memfs = await vi.importActual<typeof import('memfs')>('memfs');

    vi.mocked(fs.promises.readFile).mockImplementation(
      memfs.fs.promises.readFile as unknown as typeof fs.promises.readFile
    );

    await memfs.fs.promises.mkdir('/project/src/images', { recursive: true });
    await memfs.fs.promises.writeFile(avatarPath, pngFixture);
    await memfs.fs.promises.writeFile(brokenPath, Buffer.alloc(64));
  });

  afterEach(() => {
    vol.reset();
  });

  it('reads dimensions from the image buffer', async () => {
    const plugin = vitePluginNextImage(nextConfigResolver);

    const result = await plugin.load!.call({} as PluginContext, virtualImageId(avatarPath));

    expect(result).toContain('width: 1');
    expect(result).toContain('height: 1');
  });

  it('does not hang on malformed image data', async () => {
    const plugin = vitePluginNextImage(nextConfigResolver);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await plugin.load!.call({} as PluginContext, virtualImageId(brokenPath));

    expect(result).toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
