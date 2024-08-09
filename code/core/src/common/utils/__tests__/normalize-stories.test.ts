/// <reference types="@testing-library/jest-dom" />;
import { sep } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { InvalidStoriesEntryError } from '@storybook/core/server-errors';

import {
  getDirectoryFromWorkingDir,
  normalizeStories,
  normalizeStoriesEntry,
} from '../normalize-stories';

expect.addSnapshotSerializer({
  print: (val: any) => JSON.stringify(val, null, 2),
  test: (val) => typeof val !== 'string',
});

vi.mock('node:fs', () => {
  const mockStat = (
    path: string,
    options: Record<string, any>,
    cb: (error?: Error, stats?: Record<string, any>) => void
  ) => {
    cb(undefined, {
      isDirectory: () => !path.match(/\.[a-z]+$/),
    });
  };

  return {
    access: (path: string, mode: number, cb: (err?: Error) => void): void => undefined,
    lstatSync: (path: string) => ({
      isDirectory: () => !path.match(/\.[a-z]+$/),
    }),
    stat: mockStat,
    lstat: mockStat,
  };
});

const options = {
  configDir: '/path/to/project/.storybook',
  workingDir: '/path/to/project',
};

describe('normalizeStoriesEntry', () => {
  it('direct file path', () => {
    const specifier = normalizeStoriesEntry('../path/to/file.stories.jsx', options);
    expect(specifier).toMatchInlineSnapshot(`
      {
        "titlePrefix": "",
        "directory": "./path/to",
        "files": "file.stories.jsx",
        "importPathMatcher": {}
      }
    `);

    expect(specifier.importPathMatcher).toMatchPaths(['./path/to/file.stories.jsx']);
    expect(specifier.importPathMatcher).not.toMatchPaths([
      './path/to/file.stories.js',
      './file.stories.jsx',
      '../file.stories.jsx',
    ]);
  });

  it('story in config dir', () => {
    const specifier = normalizeStoriesEntry('./file.stories.jsx', options);
    expect(specifier).toMatchInlineSnapshot(`
      {
        "titlePrefix": "",
        "directory": "./.storybook",
        "files": "file.stories.jsx",
        "importPathMatcher": {}
      }
    `);

    expect(specifier.importPathMatcher).toMatchPaths(['./.storybook/file.stories.jsx']);
    expect(specifier.importPathMatcher).not.toMatchPaths([
      '.storybook/file.stories.jsx',
      './file.stories.jsx',
      '../file.stories.jsx',
    ]);
  });

  it('non-recursive files glob', () => {
    const specifier = normalizeStoriesEntry('../*/*.stories.jsx', options);
    expect(specifier).toMatchInlineSnapshot(`
      {
        "titlePrefix": "",
        "directory": ".",
        "files": "*/*.stories.jsx",
        "importPathMatcher": {}
      }
    `);

    expect(specifier.importPathMatcher).toMatchPaths([
      './path/file.stories.jsx',
      './second-path/file.stories.jsx',
    ]);
    expect(specifier.importPathMatcher).not.toMatchPaths([
      './path/file.stories.js',
      './path/to/file.stories.jsx',
      './file.stories.jsx',
      '../file.stories.jsx',
    ]);
  });

  it('double non-recursive directory/files glob', () => {
    const specifier = normalizeStoriesEntry('../*/*/*.stories.jsx', options);
    expect(specifier).toMatchInlineSnapshot(`
      {
        "titlePrefix": "",
        "directory": ".",
        "files": "*/*/*.stories.jsx",
        "importPathMatcher": {}
      }
    `);

    expect(specifier.importPathMatcher).toMatchPaths([
      './path/to/file.stories.jsx',
      './second-path/to/file.stories.jsx',
    ]);
    expect(specifier.importPathMatcher).not.toMatchPaths([
      './file.stories.jsx',
      './path/file.stories.jsx',
      './path/to/third/file.stories.jsx',
      './path/to/file.stories.js',
      '../file.stories.jsx',
    ]);
  });

  it('directory/files glob', () => {
    const specifier = normalizeStoriesEntry('../**/*.stories.jsx', options);
    expect(specifier).toMatchInlineSnapshot(`
      {
        "titlePrefix": "",
        "directory": ".",
        "files": "**/*.stories.jsx",
        "importPathMatcher": {}
      }
    `);
    expect(specifier.importPathMatcher).toMatchPaths([
      './file.stories.jsx',
      './path/file.stories.jsx',
      './path/to/file.stories.jsx',
      './path/to/third/file.stories.jsx',
    ]);
    expect(specifier.importPathMatcher).not.toMatchPaths([
      './file.stories.js',
      '../file.stories.jsx',
    ]);
  });

  it('double stars glob', () => {
    const specifier = normalizeStoriesEntry('../**/foo/**/*.stories.jsx', options);
    expect(specifier).toMatchInlineSnapshot(`
      {
        "titlePrefix": "",
        "directory": ".",
        "files": "**/foo/**/*.stories.jsx",
        "importPathMatcher": {}
      }
    `);

    expect(specifier.importPathMatcher).toMatchPaths([
      './foo/file.stories.jsx',
      './path/to/foo/file.stories.jsx',
      './path/to/foo/third/fourth/file.stories.jsx',
    ]);
    expect(specifier.importPathMatcher).not.toMatchPaths([
      './file.stories.jsx',
      './file.stories.js',
      '../file.stories.jsx',
    ]);
  });

  it('intermediate directory glob', () => {
    const specifier = normalizeStoriesEntry('../**/foo/*.stories.jsx', options);
    expect(specifier).toMatchInlineSnapshot(`
      {
        "titlePrefix": "",
        "directory": ".",
        "files": "**/foo/*.stories.jsx",
        "importPathMatcher": {}
      }
    `);

    expect(specifier.importPathMatcher).toMatchPaths([
      './path/to/foo/file.stories.jsx',
      './foo/file.stories.jsx',
    ]);
    expect(specifier.importPathMatcher).not.toMatchPaths([
      './file.stories.jsx',
      './file.stories.js',
      './path/to/foo/third/fourth/file.stories.jsx',
      '../file.stories.jsx',
    ]);
  });

  it('directory outside of working dir', () => {
    const specifier = normalizeStoriesEntry('../../src/*.stories.jsx', options);
    expect(specifier).toMatchInlineSnapshot(`
      {
        "titlePrefix": "",
        "directory": "../src",
        "files": "*.stories.jsx",
        "importPathMatcher": {}
      }
    `);

    expect(specifier.importPathMatcher).toMatchPaths(['../src/file.stories.jsx']);
    expect(specifier.importPathMatcher).not.toMatchPaths([
      './src/file.stories.jsx',
      '../src/file.stories.js',
    ]);
  });

  it('directory', () => {
    const specifier = normalizeStoriesEntry('..', options);
    expect(specifier).toMatchInlineSnapshot(`
      {
        "titlePrefix": "",
        "directory": ".",
        "files": "**/*.@(mdx|stories.@(js|jsx|mjs|ts|tsx))",
        "importPathMatcher": {}
      }
    `);
  });

  it('directory specifier', () => {
    const specifier = normalizeStoriesEntry({ directory: '..' }, options);
    expect(specifier).toMatchInlineSnapshot(`
      {
        "titlePrefix": "",
        "files": "**/*.@(mdx|stories.@(js|jsx|mjs|ts|tsx))",
        "directory": ".",
        "importPathMatcher": {}
      }
    `);
  });

  it('directory/files specifier', () => {
    const specifier = normalizeStoriesEntry({ directory: '..', files: '*.stories.jsx' }, options);
    expect(specifier).toMatchInlineSnapshot(`
      {
        "titlePrefix": "",
        "files": "*.stories.jsx",
        "directory": ".",
        "importPathMatcher": {}
      }
    `);
  });

  it('directory/titlePrefix specifier', () => {
    const specifier = normalizeStoriesEntry({ directory: '..', titlePrefix: 'atoms' }, options);
    expect(specifier).toMatchInlineSnapshot(`
      {
        "titlePrefix": "atoms",
        "files": "**/*.@(mdx|stories.@(js|jsx|mjs|ts|tsx))",
        "directory": ".",
        "importPathMatcher": {}
      }
    `);
  });

  it('directory/titlePrefix/files specifier', () => {
    const specifier = normalizeStoriesEntry(
      { directory: '..', titlePrefix: 'atoms', files: '*.stories.jsx' },
      options
    );
    expect(specifier).toMatchInlineSnapshot(`
      {
        "titlePrefix": "atoms",
        "files": "*.stories.jsx",
        "directory": ".",
        "importPathMatcher": {}
      }
    `);
  });

  it('globs with negation', () => {
    const specifier = normalizeStoriesEntry('../!(negation)/*.stories.jsx', options);
    expect(specifier).toMatchInlineSnapshot(`
      {
        "titlePrefix": "",
        "directory": ".",
        "files": "!(negation)/*.stories.jsx",
        "importPathMatcher": {}
      }
    `);

    expect(specifier.importPathMatcher).toMatchPaths([
      './path/file.stories.jsx',
      './second-path/file.stories.jsx',
    ]);
    expect(specifier.importPathMatcher).not.toMatchPaths([
      './path/file.stories.js',
      './path/to/file.stories.jsx',
      './file.stories.jsx',
      '../file.stories.jsx',
    ]);
  });
});

describe('getDirectoryFromWorkingDir', () => {
  it('should return normalized story path', () => {
    const normalizedPath = getDirectoryFromWorkingDir({
      configDir: '/path/to/project/.storybook',
      workingDir: '/path/to/project',
      directory: '/path/to/project/src',
    });
    expect(normalizedPath).toBe(`.${sep}src`);
  });
});

describe('normalizeStories', () => {
  it('should throw InvalidStoriesEntryError for empty entries', () => {
    expect(() => normalizeStories([], options)).toThrow(InvalidStoriesEntryError);
  });
});
