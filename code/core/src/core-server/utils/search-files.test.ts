import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { InvalidSearchQueryError, searchFiles } from './search-files.ts';

describe('search-files', () => {
  it('should automatically convert static search to a dynamic glob search', async (t) => {
    const files = await searchFiles({
      searchQuery: 'ommonjs',
      cwd: join(__dirname, '__search-files-tests__'),
    });

    expect(files).toEqual(['src/commonjs-module-default.js', 'src/commonjs-module.js']);
  });

  it('should automatically convert static search to a dynamic glob search (with file extension)', async (t) => {
    const files = await searchFiles({
      searchQuery: 'module.js',
      cwd: join(__dirname, '__search-files-tests__'),
    });

    expect(files).toEqual(['src/commonjs-module.js', 'src/es-module.js']);
  });

  it('should return all files if the search query matches the parent folder', async (t) => {
    const files = await searchFiles({
      searchQuery: 'file-extensions',
      cwd: join(__dirname, '__search-files-tests__'),
    });

    expect(files).toEqual([
      'src/file-extensions/extension.cjs',
      'src/file-extensions/extension.cts',
      'src/file-extensions/extension.js',
      'src/file-extensions/extension.jsx',
      'src/file-extensions/extension.mjs',
      'src/file-extensions/extension.mts',
      'src/file-extensions/extension.ts',
      'src/file-extensions/extension.tsx',
    ]);
  });

  it('should ignore files that do not have the allowed extensions', async (t) => {
    const files = await searchFiles({
      searchQuery: 'asset',
      cwd: join(__dirname, '__search-files-tests__'),
    });

    expect(files).toEqual([]);
  });

  it('should ignore test files (*.spec.*, *.test.*)', async (t) => {
    const files = await searchFiles({
      searchQuery: 'tests',
      cwd: join(__dirname, '__search-files-tests__'),
    });

    expect(files).toEqual([]);
  });

  it('should work with glob search patterns', async (t) => {
    const files = await searchFiles({
      searchQuery: '**/commonjs-module.js',
      cwd: join(__dirname, '__search-files-tests__'),
    });

    expect(files).toEqual(['src/commonjs-module.js']);
  });

  it('should respect glob but also the allowed file extensions', async (t) => {
    const files = await searchFiles({
      searchQuery: '**/*',
      cwd: join(__dirname, '__search-files-tests__'),
    });

    expect(files).toEqual([
      'src/commonjs-module-default.js',
      'src/commonjs-module.js',
      'src/es-module.js',
      'src/no-export.js',
      'src/file-extensions/extension.cjs',
      'src/file-extensions/extension.cts',
      'src/file-extensions/extension.js',
      'src/file-extensions/extension.jsx',
      'src/file-extensions/extension.mjs',
      'src/file-extensions/extension.mts',
      'src/file-extensions/extension.ts',
      'src/file-extensions/extension.tsx',
    ]);
  });

  it('should ignore node_modules', async (t) => {
    const files = await searchFiles({
      searchQuery: 'file-in-common.js',
      cwd: join(__dirname, '__search-files-tests__'),
    });

    expect(files).toEqual([]);
  });

  it('should ignore story files', async (t) => {
    const files = await searchFiles({
      searchQuery: 'es-module.stories.js',
      cwd: join(__dirname, '__search-files-tests__'),
    });

    expect(files).toEqual([]);
  });

  it.each([
    '../**/*',
    '../../../../etc/*',
    'src/../../*',
    'src\\..\\..\\*',
    '/etc/*',
    '\\etc\\*',
    'C:\\Windows\\*',
    'C:/Windows/*',
    'c:Windows',
    '\\\\server\\share\\*',
    '//server/share/*',
    '{x,}/etc/*',
    '{x,/etc}/*',
    '{-..0}etc/*',
    '{.,}./*',
    '.{.,x}/*',
    '.../*',
    'src/.../*',
    '....\\*',
    '{.,}../*',
  ])(
    'should reject search query %s that reaches outside of the project root',
    async (searchQuery) => {
      await expect(
        searchFiles({ searchQuery, cwd: join(__dirname, '__search-files-tests__') })
      ).rejects.toThrow(new InvalidSearchQueryError());
    }
  );

  it.each([
    [
      'src/*.js',
      [
        'src/commonjs-module-default.js',
        'src/commonjs-module.js',
        'src/es-module.js',
        'src/no-export.js',
      ],
    ],
    [
      'src/file-extensions/*.{ts,tsx}',
      ['src/file-extensions/extension.ts', 'src/file-extensions/extension.tsx'],
    ],
    ['**/es-module*', ['src/es-module.js']],
    ['a..b.tsx', []],
    ['a...b.tsx', []],
  ])(
    'should allow search query %s that stays inside the project root',
    async (searchQuery, expected) => {
      const files = await searchFiles({
        searchQuery,
        cwd: join(__dirname, '__search-files-tests__'),
      });

      expect(files).toEqual(expected);
    }
  );
});
