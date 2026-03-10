import fs from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { onlyWindows, skipWindows } from '../../../../../vitest.helpers';
import { parseStaticDir, prepareNestedSvg } from '../server-statics';

vi.mock('node:fs');
const existsSyncMock = vi.mocked(fs.existsSync);
const statSyncMock = vi.mocked(fs.statSync);

describe('prepareNestedSvg', () => {
  it('should remove xml declaration and add preserveAspectRatio', () => {
    const fixedSvg = prepareNestedSvg(`
<?xml version="1.0" encoding="UTF-8"?>
<svg><g /></svg>
    `);
    expect(fixedSvg).toMatchInlineSnapshot(
      `"<svg preserveAspectRatio="xMidYMid meet"><g /></svg>"`
    );
  });

  it('should update width and height', () => {
    const fixedSvg = prepareNestedSvg(`
<svg width="64px" height="64px" viewBox="0 0 64 64" fill="none"><g /></svg>
    `);
    expect(fixedSvg).toMatchInlineSnapshot(
      `"<svg width="32px" height="32px" viewBox="0 0 64 64" fill="none" preserveAspectRatio="xMidYMid meet"><g /></svg>"`
    );
  });

  it('should add viewBox if none is present', () => {
    const fixedSvg = prepareNestedSvg(`
<svg width="64px" height="64px" fill="none"><g /></svg>
    `);
    expect(fixedSvg).toMatchInlineSnapshot(
      `"<svg width="32px" height="32px" fill="none" viewBox="0 0 64 64" preserveAspectRatio="xMidYMid meet"><g /></svg>"`
    );
  });

  it('handles a full svg', () => {
    const fixedSvg = prepareNestedSvg(`
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="none">
  <circle cx="23" cy="35" r="8" fill="#fff" />
  <circle cx="41" cy="35" r="8" fill="#fff" />
  <path fill="#9FA628"
    d="M62.6 5.8c-2.8 0-4.4-1.6-4.4-4.4 0-.8-.6-1.4-1.4-1.4-.8 0-1.4.6-1.4 1.4 0 1.6.4 3 1 4.2l-3.8 4C49.6 7.2 45.8 6 40.8 6H23.4c-5 0-8.8 1.2-11.8 3.6L7.8 5.8c.8-1.2 1-2.6 1-4.2C8.8.6 8 0 7.2 0S5.8.6 5.8 1.4c0 2.8-1.6 4.4-4.4 4.4-.8 0-1.4.6-1.4 1.4 0 .8.6 1.4 1.4 1.4 1.6 0 3-.4 4.2-1l4 3.8C7.2 14.4 6 18.2 6 23.2V48c0 5.6 4.4 10 10 10h32c5.6 0 10-4.4 10-10V23.2c0-5-1.2-8.8-3.6-11.8l3.8-3.8c1.2.8 2.6 1 4.2 1 .8 0 1.4-.6 1.4-1.4 0-.8-.4-1.4-1.2-1.4zM23 42c-3.8 0-7-3.2-7-7s3.2-7 7-7 7 3.2 7 7-3.2 7-7 7zm18 0c-3.8 0-7-3.2-7-7s3.2-7 7-7 7 3.2 7 7-3.2 7-7 7z" />
  <circle cx="23" cy="35" r="4" fill="#BF6C35" />
  <circle cx="41" cy="35" r="4" fill="#BF6C35" />
</svg>
    `);
    expect(fixedSvg).toMatchInlineSnapshot(`
      "<svg xmlns="http://www.w3.org/2000/svg" width="32px" height="32px" fill="none" viewBox="0 0 64 64" preserveAspectRatio="xMidYMid meet">
        <circle cx="23" cy="35" r="8" fill="#fff" />
        <circle cx="41" cy="35" r="8" fill="#fff" />
        <path fill="#9FA628"
          d="M62.6 5.8c-2.8 0-4.4-1.6-4.4-4.4 0-.8-.6-1.4-1.4-1.4-.8 0-1.4.6-1.4 1.4 0 1.6.4 3 1 4.2l-3.8 4C49.6 7.2 45.8 6 40.8 6H23.4c-5 0-8.8 1.2-11.8 3.6L7.8 5.8c.8-1.2 1-2.6 1-4.2C8.8.6 8 0 7.2 0S5.8.6 5.8 1.4c0 2.8-1.6 4.4-4.4 4.4-.8 0-1.4.6-1.4 1.4 0 .8.6 1.4 1.4 1.4 1.6 0 3-.4 4.2-1l4 3.8C7.2 14.4 6 18.2 6 23.2V48c0 5.6 4.4 10 10 10h32c5.6 0 10-4.4 10-10V23.2c0-5-1.2-8.8-3.6-11.8l3.8-3.8c1.2.8 2.6 1 4.2 1 .8 0 1.4-.6 1.4-1.4 0-.8-.4-1.4-1.2-1.4zM23 42c-3.8 0-7-3.2-7-7s3.2-7 7-7 7 3.2 7 7-3.2 7-7 7zm18 0c-3.8 0-7-3.2-7-7s3.2-7 7-7 7 3.2 7 7-3.2 7-7 7z" />
        <circle cx="23" cy="35" r="4" fill="#BF6C35" />
        <circle cx="41" cy="35" r="4" fill="#BF6C35" />
      </svg>"
    `);
  });
});

describe('parseStaticDir', () => {
  beforeEach(() => {
    existsSyncMock.mockReturnValue(true);
    statSyncMock.mockReturnValue({ isFile: () => false } as fs.Stats);
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
