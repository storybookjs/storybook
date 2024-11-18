import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { findPagesDir } from 'next/dist/lib/find-pages-dir.js';

import {
  findNextDirectories,
  loadClosestPackageJson,
  loadSWCBindingsEagerly,
  shouldOutputCommonJs,
} from './nextjs';

// Mocking the necessary modules and functions
vi.mock('node:fs');
vi.mock('node:path');
vi.mock('next/dist/build/output/log.js');
vi.mock('@next/env');
vi.mock('next/dist/build/swc/index.js', () => ({
  loadBindings: vi.fn(),
  lockfilePatchPromise: { cur: Promise.resolve() },
}));
vi.mock('next/dist/lib/find-pages-dir.js');

describe('nextjs.ts', () => {
  describe('loadSWCBindingsEagerly', () => {
    it('should call loadBindings and lockfilePatchPromise.cur', async () => {
      const { loadBindings, lockfilePatchPromise } = await import('next/dist/build/swc/index.js');

      await loadSWCBindingsEagerly();

      expect(loadBindings).toHaveBeenCalled();
      expect(lockfilePatchPromise.cur).resolves.toBeUndefined();
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
      const readFileMock = vi.fn().mockResolvedValue('{"name": "test"}');
      fs.promises.readFile = readFileMock;

      const result = await loadClosestPackageJson('/path/to/dir');

      expect(readFileMock).toHaveBeenCalledWith(path.join('/path/to/dir', 'package.json'), 'utf8');
      expect(result).toEqual({ name: 'test' });
    });

    it('should throw an error after 5 attempts', async () => {
      const readFileMock = vi.fn().mockRejectedValue(new Error('File not found'));
      fs.promises.readFile = readFileMock;

      await expect(loadClosestPackageJson('/path/to/dir')).rejects.toThrow(
        "Can't resolve main package.json file"
      );
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
