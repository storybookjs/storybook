import fs from 'node:fs';
import path from 'node:path';

import type { NextConfigComplete } from 'next/dist/server/config-shared.js';
import type { PluginContext } from 'rollup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireResolveMock = vi.hoisted(() => vi.fn());

vi.mock('node:module', () => ({
  createRequire: () => ({
    resolve: requireResolveMock,
  }),
}));

vi.mock('node:fs', { spy: true });

import { vitePluginNextImage } from './plugin.ts';

function encodeBase64Url(str: string): string {
  const base64 = Buffer.from(str).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

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
});

describe('vitePluginNextImage load', () => {
  const nextConfigResolver = {
    promise: Promise.resolve({} as NextConfigComplete),
    resolve: vi.fn(),
    reject: vi.fn(),
  } as PromiseWithResolvers<NextConfigComplete>;

  // 1x1 red PNG
  const pngFixture = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );

  beforeEach(() => {
    vi.mocked(fs.promises.readFile).mockReset();
  });

  it('reads dimensions from the image buffer', async () => {
    const plugin = vitePluginNextImage(nextConfigResolver);
    vi.mocked(fs.promises.readFile).mockResolvedValueOnce(pngFixture);

    const result = await plugin.load!.call(
      {} as PluginContext,
      virtualImageId('/project/src/images/avatar.png')
    );

    expect(result).toContain('width: 1');
    expect(result).toContain('height: 1');
  });

  it('does not hang on malformed image data', async () => {
    const plugin = vitePluginNextImage(nextConfigResolver);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fs.promises.readFile).mockResolvedValueOnce(Buffer.alloc(64));

    const result = await plugin.load!.call(
      {} as PluginContext,
      virtualImageId('/project/src/images/broken.png')
    );

    expect(result).toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
