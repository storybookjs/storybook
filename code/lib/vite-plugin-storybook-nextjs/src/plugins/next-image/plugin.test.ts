import { createHash } from 'node:crypto';
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

import { vitePluginNextImage } from './plugin.ts';

const VIRTUAL_IMAGE_PREFIX = '\0virtual:next-image:';
const MAX_EXPECTED_ID_LENGTH = 50;

function expectedId(absolutePath: string): string {
  const hash = createHash('sha256').update(absolutePath).digest('hex').slice(0, 8);
  return `${VIRTUAL_IMAGE_PREFIX}${hash}`;
}

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
    expect(result).toBe(expectedId(path.join(path.dirname(importer), './images/avatar.png')));
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
    expect(result).toBe(expectedId(resolvedPath));
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
    expect(result).toBe(expectedId(resolvedPath));
  });

  it('keeps virtual IDs short for deeply nested monorepo paths', async () => {
    const plugin = vitePluginNextImage(nextConfigResolver);
    const deepDir = `/Users/x/dev/${'nested-'.repeat(30)}leaf`;
    const importer = `${deepDir}/Component.tsx`;
    const resolve = vi.fn();
    const expectedImagePath = path.join(deepDir, './images/avatar.png');

    const result = await plugin.resolveId!.call(
      createContext(resolve),
      './images/avatar.png',
      importer
    );

    expect(result).toBe(expectedId(expectedImagePath));
    expect((result as string).length).toBeLessThanOrEqual(MAX_EXPECTED_ID_LENGTH);

    const second = await plugin.resolveId!.call(
      createContext(resolve),
      './images/avatar.png',
      importer
    );
    expect(second).toBe(result);
  });

  it('keeps the ID safe for paths with characters Vite decodeURI would mangle', async () => {
    const plugin = vitePluginNextImage(nextConfigResolver);
    const importer = '/project/src/[locale]/[slug]/Component.tsx';
    const resolve = vi.fn();
    const expectedImagePath = path.join(path.dirname(importer), './images/avatar.png');

    const result = await plugin.resolveId!.call(
      createContext(resolve),
      './images/avatar.png',
      importer
    );

    expect(result).toBe(expectedId(expectedImagePath));
    expect(result as string).toMatch(/^\0virtual:next-image:[0-9a-f]+$/);
  });

  it('returns distinct IDs for distinct image paths', async () => {
    const plugin = vitePluginNextImage(nextConfigResolver);
    const importer = '/project/src/Component.tsx';
    const resolve = vi.fn();

    const a = await plugin.resolveId!.call(createContext(resolve), './images/a.png', importer);
    const b = await plugin.resolveId!.call(createContext(resolve), './images/b.png', importer);

    expect(a).not.toBe(b);
  });
});

describe('vitePluginNextImage load', () => {
  const nextConfigResolver = {
    promise: Promise.resolve({} as NextConfigComplete),
    resolve: vi.fn(),
    reject: vi.fn(),
  } as PromiseWithResolvers<NextConfigComplete>;

  const createContext = (resolve: PluginContext['resolve']) => ({ resolve }) as PluginContext;

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
    const id = await plugin.resolveId!.call(
      createContext(vi.fn()),
      avatarPath,
      '/project/src/Component.tsx'
    );

    const result = await plugin.load!.call({} as PluginContext, id as string);

    expect(result).toContain('width: 1');
    expect(result).toContain('height: 1');
  });

  it('does not hang on malformed image data', async () => {
    const plugin = vitePluginNextImage(nextConfigResolver);
    const id = await plugin.resolveId!.call(
      createContext(vi.fn()),
      brokenPath,
      '/project/src/Component.tsx'
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await plugin.load!.call({} as PluginContext, id as string);

    expect(result).toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
