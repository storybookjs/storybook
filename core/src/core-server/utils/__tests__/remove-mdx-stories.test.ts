import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { normalizeStoriesEntry } from '@storybook/core/common';
import { type StoriesEntry } from '@storybook/core/types';

// eslint-disable-next-line depend/ban-dependencies
import { glob as globOriginal } from 'glob';
import slash from 'slash';

import { removeMDXEntries } from '../remove-mdx-entries';

const configDir = '/configDir/';
const workingDir = '/';

vi.mock('glob', () => ({ glob: vi.fn() }));
const glob = vi.mocked(globOriginal);

const createList = (list: { entry: StoriesEntry; result: string[] }[]) => {
  return list.reduce<Record<string, { result: string[]; entry: StoriesEntry }>>(
    (acc, { entry, result }) => {
      const { directory, files } = normalizeStoriesEntry(entry, {
        configDir,
        workingDir,
      });
      acc[slash(join('/', directory, files))] = { result, entry };
      return acc;
    },
    {}
  );
};

const createGlobMock = (input: ReturnType<typeof createList>) => {
  return async (k: string | string[]) => {
    if (Array.isArray(k)) {
      throw new Error('do not pass an array to glob during tests');
    }
    if (input[slash(k)]) {
      return input[slash(k)]?.result;
    }

    throw new Error('can not find key in input');
  };
};

describe('remove-mdx-stories', () => {
  it('empty', async () => {
    const list = createList([]);
    glob.mockImplementation(createGlobMock(list));

    await expect(() => removeMDXEntries(Object.keys(list), { configDir })).rejects
      .toThrowErrorMatchingInlineSnapshot(`
    [SB_CORE-COMMON_0004 (InvalidStoriesEntryError): Storybook could not index your stories.
Your main configuration somehow does not contain a 'stories' field, or it resolved to an empty array.

Please check your main configuration file and make sure it exports a 'stories' field that is not an empty array.

More info: https://storybook.js.org/docs/faq#can-i-have-a-storybook-with-no-local-stories
]
`);
  });

  it('minimal', async () => {
    const list = createList([{ entry: '*.js', result: [] }]);
    glob.mockImplementation(createGlobMock(list));

    const result = await removeMDXEntries(
      Object.values(list).map((e) => e.entry),
      { configDir }
    );

    expect(result).toMatchInlineSnapshot(`
    [
      {
        "directory": ".",
        "files": "*.js",
        "titlePrefix": "",
      },
    ]
  `);
  });

  it('multiple', async () => {
    const list = createList([
      { entry: '*.ts', result: [] },
      { entry: '*.js', result: [] },
    ]);
    glob.mockImplementation(createGlobMock(list));

    const result = await removeMDXEntries(
      Object.values(list).map((e) => e.entry),
      { configDir }
    );

    expect(result).toMatchInlineSnapshot(`
    [
      {
        "directory": ".",
        "files": "*.ts",
        "titlePrefix": "",
      },
      {
        "directory": ".",
        "files": "*.js",
        "titlePrefix": "",
      },
    ]
  `);
  });

  it('mdx but not matching any files', async () => {
    const list = createList([
      { entry: '*.mdx', result: [] },
      { entry: '*.js', result: [] },
    ]);
    glob.mockImplementation(createGlobMock(list));

    const result = await removeMDXEntries(
      Object.values(list).map((e) => e.entry),
      { configDir }
    );

    expect(result).toMatchInlineSnapshot(`
    [
      {
        "directory": ".",
        "files": "*.mdx",
        "titlePrefix": "",
      },
      {
        "directory": ".",
        "files": "*.js",
        "titlePrefix": "",
      },
    ]
  `);
  });

  it('removes entries that only yield mdx files', async () => {
    const list = createList([
      { entry: '*.mdx', result: ['/configDir/my-file.mdx'] },
      { entry: '*.js', result: [] },
    ]);
    glob.mockImplementation(createGlobMock(list));

    const result = await removeMDXEntries(
      Object.values(list).map((e) => e.entry),
      { configDir }
    );

    expect(result).toMatchInlineSnapshot(`
    [
      {
        "directory": ".",
        "files": "*.js",
        "titlePrefix": "",
      },
    ]
  `);
  });

  it('expands entries that only yield mixed files', async () => {
    const list = createList([
      { entry: '*.@(mdx|ts)', result: ['/configDir/my-file.mdx', '/configDir/my-file.ts'] },
      { entry: '*.js', result: [] },
    ]);
    glob.mockImplementation(createGlobMock(list));

    const result = await removeMDXEntries(
      Object.values(list).map((e) => e.entry),
      { configDir }
    );

    expect(result).toMatchInlineSnapshot(`
    [
      {
        "directory": ".",
        "files": "**/my-file.ts",
        "titlePrefix": "",
      },
      {
        "directory": ".",
        "files": "*.js",
        "titlePrefix": "",
      },
    ]
  `);
  });

  it('passes titlePrefix', async () => {
    const list = createList([
      {
        entry: { files: '*.@(mdx|ts)', directory: '.', titlePrefix: 'foo' },
        result: ['/configDir/my-file.mdx', '/configDir/my-file.ts'],
      },
    ]);
    glob.mockImplementation(createGlobMock(list));

    const result = await removeMDXEntries(
      Object.values(list).map((e) => e.entry),
      { configDir }
    );

    expect(result).toMatchInlineSnapshot(`
    [
      {
        "directory": ".",
        "files": "**/my-file.ts",
        "titlePrefix": "foo",
      },
    ]
  `);
  });

  it('expands to multiple entries', async () => {
    const list = createList([
      {
        entry: { files: '*.@(mdx|ts)', directory: '.', titlePrefix: 'foo' },
        result: [
          '/configDir/my-file.mdx',
          '/configDir/my-file1.ts',
          '/configDir/my-file2.ts',
          '/configDir/my-file3.ts',
        ],
      },
    ]);
    glob.mockImplementation(createGlobMock(list));

    const result = await removeMDXEntries(
      Object.values(list).map((e) => e.entry),
      { configDir }
    );

    expect(result).toMatchInlineSnapshot(`
    [
      {
        "directory": ".",
        "files": "**/my-file1.ts",
        "titlePrefix": "foo",
      },
      {
        "directory": ".",
        "files": "**/my-file2.ts",
        "titlePrefix": "foo",
      },
      {
        "directory": ".",
        "files": "**/my-file3.ts",
        "titlePrefix": "foo",
      },
    ]
  `);
  });
});
