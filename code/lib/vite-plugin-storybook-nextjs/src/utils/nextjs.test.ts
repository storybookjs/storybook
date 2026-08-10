import fs from 'node:fs';

import { findPagesDir } from 'next/dist/lib/find-pages-dir.js';
import path from 'pathe';
import { describe, expect, it, vi } from 'vitest';

import {
  findNextDirectories,
  loadClosestPackageJson,
  loadSWCBindingsEagerly,
  shouldOutputCommonJs,
} from './nextjs.ts';

vi.mock('node:fs', { spy: true });
vi.mock('next/dist/build/output/log.js');
vi.mock('@next/env');
vi.mock('next/dist/build/swc/index.js', () => ({
  loadBindings: vi.fn(),
  lockfilePatchPromise: { cur: Promise.resolve() },
}));
vi.mock('next/dist/lib/find-pages-dir.js', { spy: true });

describe('nextjs.ts', () => {
  describe('loadSWCBindingsEagerly', () => {
    it('should call loadBindings and lockfilePatchPromise.cur', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { loadBindings, lockfilePatchPromise } = await import('next/dist/build/swc/index.js');

      await loadSWCBindingsEagerly();

      expect(loadBindings).toHaveBeenCalled();
      await expect(lockfilePatchPromise.cur).resolves.toBeUndefined();
      warn.mockRestore();
    });
  });

  describe('shouldOutputCommonJs', () => {
    it('should return true for .cjs files', () => {
      expect(shouldOutputCommonJs('file.cjs')).toBe(true);
    });

    it('should return true for next/dist paths', () => {
      expect(shouldOutputCommonJs('next/dist/shared/lib/somefile.js')).toBe(true);
    });

    it('should return false for other files', () => {
      expect(shouldOutputCommonJs('file.js')).toBe(false);
    });
  });

  describe('loadClosestPackageJson', () => {
    it('should load the closest package.json file', async () => {
      const readFileMock = vi.spyOn(fs.promises, 'readFile').mockResolvedValue('{"name": "test"}');

      const result = await loadClosestPackageJson('/path/to/dir');

      expect(readFileMock).toHaveBeenCalledWith(path.join('/path/to/dir', 'package.json'), 'utf8');
      expect(result).toEqual({ name: 'test' });
      readFileMock.mockRestore();
    });

    it('should load package.json from the parent directory on the second attempt', async () => {
      const readFileMock = vi
        .spyOn(fs.promises, 'readFile')
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce('{"name": "parent"}');

      const result = await loadClosestPackageJson('/path/to/dir');

      expect(readFileMock).toHaveBeenNthCalledWith(
        2,
        path.join('/path/to', 'package.json'),
        'utf8'
      );
      expect(result).toEqual({ name: 'parent' });
      readFileMock.mockRestore();
    });

    it('should throw an error after 5 attempts', async () => {
      const readFileMock = vi
        .spyOn(fs.promises, 'readFile')
        .mockRejectedValue(new Error('File not found'));

      await expect(loadClosestPackageJson('/path/to/dir')).rejects.toThrow(
        "Can't resolve main package.json file"
      );
      readFileMock.mockRestore();
    });
  });

  describe('findNextDirectories', () => {
    it('should return directories from findPagesDir', () => {
      vi.mocked(findPagesDir).mockReturnValue({
        appDir: '/path/to/app',
        pagesDir: '/path/to/pages',
      });

      const result = findNextDirectories('/path/to/dir');

      expect(result).toEqual({
        appDir: '/path/to/app',
        pagesDir: '/path/to/pages',
      });
    });

    it('should return default directories if findPagesDir throws an error', () => {
      vi.mocked(findPagesDir).mockImplementation(() => {
        throw new Error('Not found');
      });

      const result = findNextDirectories('/path/to/dir');

      expect(result).toEqual({
        appDir: path.join('/path/to/dir', 'app'),
        pagesDir: path.join('/path/to/dir', 'pages'),
      });
    });
  });
});
