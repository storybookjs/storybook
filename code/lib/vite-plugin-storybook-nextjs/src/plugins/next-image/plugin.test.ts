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

import { vitePluginNextImage } from './plugin.ts';

const VIRTUAL_IMAGE_PREFIX = '\0virtual:next-image:';
const SHORT_ID_MAX_LENGTH = VIRTUAL_IMAGE_PREFIX.length + 8;

const createContext = (resolve: PluginContext['resolve'] = vi.fn()) =>
  ({ resolve }) as PluginContext;

const passthroughConfig = {
  promise: Promise.resolve({ images: { disableStaticImages: true } } as NextConfigComplete),
  resolve: vi.fn(),
  reject: vi.fn(),
} as PromiseWithResolvers<NextConfigComplete>;

describe('vitePluginNextImage resolveId', () => {
  it('resolves relative image imports against importer', async () => {
    const plugin = vitePluginNextImage(passthroughConfig);
    const resolve = vi.fn();
    const importer = '/project/src/Component.tsx';
    const expectedPath = join(dirname(importer), './images/avatar.png');

    const id = await plugin.resolveId!.call(
      createContext(resolve),
      './images/avatar.png',
      importer
    );
    const loaded = await plugin.load!.call({} as PluginContext, id as string);

    expect(resolve).not.toHaveBeenCalled();
    expect(loaded).toContain(expectedPath);
  });

  it('uses Vite resolver for package image imports', async () => {
    const plugin = vitePluginNextImage(passthroughConfig);
    const resolvedPath = '/project/packages/assets/src/images/avatar.png';
    const resolve = vi.fn().mockResolvedValue({ id: resolvedPath });
    const id = await plugin.resolveId!.call(
      createContext(resolve),
      '@myorg/assets/images/avatar.png',
      '/project/src/Component.tsx'
    );
    const loaded = await plugin.load!.call({} as PluginContext, id as string);

    expect(resolve).toHaveBeenCalledWith(
      '@myorg/assets/images/avatar.png',
      '/project/src/Component.tsx',
      { skipSelf: true }
    );
    expect(loaded).toContain(resolvedPath);
  });

  it('falls back to require.resolve when Vite resolution fails', async () => {
    const plugin = vitePluginNextImage(passthroughConfig);
    const importer = '/project/src/Component.tsx?import';
    const resolvedPath = '/project/packages/assets/src/images/avatar.png';
    const resolve = vi.fn().mockResolvedValue(null);

    requireResolveMock.mockReturnValueOnce(resolvedPath);
    const id = await plugin.resolveId!.call(
      createContext(resolve),
      '@myorg/assets/images/avatar.png',
      importer
    );
    const loaded = await plugin.load!.call({} as PluginContext, id as string);

    expect(resolve).toHaveBeenCalled();
    expect(requireResolveMock).toHaveBeenCalledWith('@myorg/assets/images/avatar.png', {
      paths: [dirname(importer.split('?')[0])],
    });
    expect(loaded).toContain(resolvedPath);
  });

  it('keeps virtual IDs short and stable for deeply nested monorepo paths', async () => {
    const plugin = vitePluginNextImage(passthroughConfig);
    const deepDir = `/Users/x/dev/${'nested-'.repeat(30)}leaf`;
    const importer = `${deepDir}/Component.tsx`;

    const first = await plugin.resolveId!.call(createContext(), './images/avatar.png', importer);
    const second = await plugin.resolveId!.call(createContext(), './images/avatar.png', importer);

    expect(first).toMatch(/^\0virtual:next-image:[0-9a-f]+$/);
    expect((first as string).length).toBeLessThanOrEqual(SHORT_ID_MAX_LENGTH);
    expect(second).toBe(first);
  });

  it('keeps the ID safe for paths with characters Vite decodeURI would mangle', async () => {
    const plugin = vitePluginNextImage(passthroughConfig);
    const importer = '/project/src/[locale]/[slug]/Component.tsx';
    const expectedPath = join(dirname(importer), './images/avatar.png');

    const id = await plugin.resolveId!.call(createContext(), './images/avatar.png', importer);
    const loaded = await plugin.load!.call({} as PluginContext, id as string);

    expect(id as string).toMatch(/^\0virtual:next-image:[0-9a-f]+$/);
    expect(loaded).toContain(expectedPath);
  });

  it('returns distinct IDs for distinct image paths', async () => {
    const plugin = vitePluginNextImage(passthroughConfig);
    const importer = '/project/src/Component.tsx';

    const a = await plugin.resolveId!.call(createContext(), './images/a.png', importer);
    const b = await plugin.resolveId!.call(createContext(), './images/b.png', importer);

    expect(a).not.toBe(b);
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
    const id = await plugin.resolveId!.call(
      createContext(),
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
      createContext(),
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
