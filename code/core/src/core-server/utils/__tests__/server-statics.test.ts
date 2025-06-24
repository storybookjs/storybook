import fs from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { onlyWindows, skipWindows } from '../../../../../vitest.helpers';
import { parseStaticDir } from '../server-statics';

vi.mock('node:fs');
const existsSyncMock = vi.mocked(fs.existsSync);

describe('parseStaticDir', () => {
  beforeEach(() => {
    existsSyncMock.mockReturnValue(true);
  });

  it('returns the static dir/path and default target', async () => {
    expect(parseStaticDir('public')).toEqual({
      staticDir: './public',
      staticPath: resolve('public'),
      targetDir: './',
      targetEndpoint: '/',
    });

    expect(parseStaticDir('foo/bar')).toEqual({
      staticDir: './foo/bar',
      staticPath: resolve('foo/bar'),
      targetDir: './',
      targetEndpoint: '/',
    });
  });

  it('returns the static dir/path and custom target', async () => {
    expect(parseStaticDir('public:/custom-endpoint')).toEqual({
      staticDir: './public',
      staticPath: resolve('public'),
      targetDir: './custom-endpoint',
      targetEndpoint: '/custom-endpoint',
    });

    expect(parseStaticDir('foo/bar:/custom-endpoint')).toEqual({
      staticDir: './foo/bar',
      staticPath: resolve('foo/bar'),
      targetDir: './custom-endpoint',
      targetEndpoint: '/custom-endpoint',
    });
  });

  it('pins relative endpoint at root', async () => {
    const normal = parseStaticDir('public:relative-endpoint');
    expect(normal.targetEndpoint).toBe('/relative-endpoint');

    const windows = parseStaticDir('C:\\public:relative-endpoint');
    expect(windows.targetEndpoint).toBe('/relative-endpoint');
  });

  it('checks that the path exists', async () => {
    existsSyncMock.mockReturnValueOnce(false);
    expect(() => parseStaticDir('nonexistent')).toThrow(resolve('nonexistent'));
  });

  skipWindows(() => {
    it('supports absolute file paths - posix', async () => {
      expect(parseStaticDir('/foo/bar')).toEqual({
        staticDir: '/foo/bar',
        staticPath: '/foo/bar',
        targetDir: './',
        targetEndpoint: '/',
      });
    });

    it('supports absolute file paths with custom endpoint - posix', async () => {
      expect(parseStaticDir('/foo/bar:/custom-endpoint')).toEqual({
        staticDir: '/foo/bar',
        staticPath: '/foo/bar',
        targetDir: './custom-endpoint',
        targetEndpoint: '/custom-endpoint',
      });
    });
  });

  onlyWindows(() => {
    it('supports absolute file paths - windows', async () => {
      expect(parseStaticDir('C:\\foo\\bar')).toEqual({
        staticDir: resolve('C:\\foo\\bar'),
        staticPath: resolve('C:\\foo\\bar'),
        targetDir: './',
        targetEndpoint: '/',
      });
    });

    it('supports absolute file paths with custom endpoint - windows', async () => {
      expect(parseStaticDir('C:\\foo\\bar:/custom-endpoint')).toEqual({
        staticDir: expect.any(String), // can't test this properly on unix
        staticPath: resolve('C:\\foo\\bar'),
        targetDir: './custom-endpoint',
        targetEndpoint: '/custom-endpoint',
      });

      expect(parseStaticDir('C:\\foo\\bar:\\custom-endpoint')).toEqual({
        staticDir: expect.any(String), // can't test this properly on unix
        staticPath: resolve('C:\\foo\\bar'),
        targetDir: './custom-endpoint',
        targetEndpoint: '/custom-endpoint',
      });
    });
  });
});
