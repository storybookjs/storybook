import fs from 'node:fs';

import { dirname, join } from 'pathe';

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

import { encodeBase64Url } from '../../utils/base64-url.ts';
import { vitePluginNextImage } from './plugin.ts';

const virtualImageId = (imagePath: string) => `\0virtual:next-image:${encodeBase64Url(imagePath)}`;

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
    expect(result).toBe(virtualImageId(join(dirname(importer), './images/avatar.png')));
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
      paths: [dirname(importer.split('?')[0])],
    });
    expect(result).toBe(virtualImageId(resolvedPath));
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
