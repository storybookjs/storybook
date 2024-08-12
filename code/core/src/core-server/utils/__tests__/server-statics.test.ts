import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import fs from 'fs-extra';

import { onlyWindows, skipWindows } from '../../../../../vitest.helpers';
import { parseStaticDir } from '../server-statics';

vi.mock('fs-extra');
const pathExistsMock = vi.mocked(fs.pathExists);

describe('parseStaticDir', () => {
  beforeEach(() => {
    // @ts-expect-error for some reason vitest does not match the return type with one of the overloads from pathExists
    pathExistsMock.mockResolvedValue(true);
  });

  it('returns the static dir/path and default target', async () => {
    await expect(parseStaticDir('public')).resolves.toEqual({
      staticDir: './public',
      staticPath: resolve('public'),
      targetDir: './',
      targetEndpoint: '/',
    });

    await expect(parseStaticDir('foo/bar')).resolves.toEqual({
      staticDir: './foo/bar',
      staticPath: resolve('foo/bar'),
      targetDir: './',
      targetEndpoint: '/',
    });
  });

  it('returns the static dir/path and custom target', async () => {
    await expect(parseStaticDir('public:/custom-endpoint')).resolves.toEqual({
      staticDir: './public',
      staticPath: resolve('public'),
      targetDir: './custom-endpoint',
      targetEndpoint: '/custom-endpoint',
    });

    await expect(parseStaticDir('foo/bar:/custom-endpoint')).resolves.toEqual({
      staticDir: './foo/bar',
      staticPath: resolve('foo/bar'),
      targetDir: './custom-endpoint',
      targetEndpoint: '/custom-endpoint',
    });
  });

  it('pins relative endpoint at root', async () => {
    const normal = await parseStaticDir('public:relative-endpoint');
    expect(normal.targetEndpoint).toBe('/relative-endpoint');

    const windows = await parseStaticDir('C:\\public:relative-endpoint');
    expect(windows.targetEndpoint).toBe('/relative-endpoint');
  });

  it('checks that the path exists', async () => {
    // @ts-expect-error for some reason vitest does not match the return type with one of the overloads from pathExists
    pathExistsMock.mockResolvedValue(false);
    await expect(parseStaticDir('nonexistent')).rejects.toThrow(resolve('nonexistent'));
  });

  skipWindows(() => {
    it('supports absolute file paths - posix', async () => {
      await expect(parseStaticDir('/foo/bar')).resolves.toEqual({
        staticDir: '/foo/bar',
        staticPath: '/foo/bar',
        targetDir: './',
        targetEndpoint: '/',
      });
    });

    it('supports absolute file paths with custom endpoint - posix', async () => {
      await expect(parseStaticDir('/foo/bar:/custom-endpoint')).resolves.toEqual({
        staticDir: '/foo/bar',
        staticPath: '/foo/bar',
        targetDir: './custom-endpoint',
        targetEndpoint: '/custom-endpoint',
      });
    });
  });

  onlyWindows(() => {
    it('supports absolute file paths - windows', async () => {
      await expect(parseStaticDir('C:\\foo\\bar')).resolves.toEqual({
        staticDir: resolve('C:\\foo\\bar'),
        staticPath: resolve('C:\\foo\\bar'),
        targetDir: './',
        targetEndpoint: '/',
      });
    });

    it('supports absolute file paths with custom endpoint - windows', async () => {
      await expect(parseStaticDir('C:\\foo\\bar:/custom-endpoint')).resolves.toEqual({
        staticDir: expect.any(String), // can't test this properly on unix
        staticPath: resolve('C:\\foo\\bar'),
        targetDir: './custom-endpoint',
        targetEndpoint: '/custom-endpoint',
      });

      await expect(parseStaticDir('C:\\foo\\bar:\\custom-endpoint')).resolves.toEqual({
        staticDir: expect.any(String), // can't test this properly on unix
        staticPath: resolve('C:\\foo\\bar'),
        targetDir: './custom-endpoint',
        targetEndpoint: '/custom-endpoint',
      });
    });
  });
});
