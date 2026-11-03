import { describe, expect, it } from 'vitest';

import { normalizeStoriesEntry } from 'storybook/internal/common';

import { toImportFn, webpackIncludeRegexp } from './to-importFn.ts';

const testCases: [string, string[], string[]][] = [
  [
    '**/*.stories.tsx',
    [
      '/Users/user/code/.storybook/Icon.stories.tsx',
      '/Users/user/code/.storybook/stories/Icon.stories.tsx',
      '/Users/user/code/.storybook/stories/components/Icon.stories.tsx',
    ],
    [
      '/Users/user/code/.storybook/stories.tsx',
      '/Users/user/code/.storybook/Icon.stories.ts',
      '/Users/user/code/.storybook/Icon.stories.js',
      '/Users/user/code/.storybook/src/components/stories.tsx',
      '/Users/user/code/.storybook/src/components/Icon.stories/stories.tsx',
      '/Users/user/code/.storybook/src/components/Icon.stories.ts',
      '/Users/user/code/.storybook/src/components/Icon.stories.js',
      '/Users/user/code/src/components/Icon.stories.tsx',
    ],
  ],
  [
    './**/*.stories.tsx',
    [
      '/Users/user/code/.storybook/Icon.stories.tsx',
      '/Users/user/code/.storybook/stories/Icon.stories.tsx',
      '/Users/user/code/.storybook/stories/components/Icon.stories.tsx',
    ],
    [
      '/Users/user/code/.storybook/stories.tsx',
      '/Users/user/code/.storybook/Icon.stories.ts',
      '/Users/user/code/.storybook/Icon.stories.js',
      '/Users/user/code/.storybook/src/components/stories.tsx',
      '/Users/user/code/.storybook/src/components/Icon.stories/stories.tsx',
      '/Users/user/code/.storybook/src/components/Icon.stories.ts',
      '/Users/user/code/.storybook/src/components/Icon.stories.js',
      '/Users/user/code/src/components/Icon.stories.tsx',
    ],
  ],
  [
    '../**/*.stories.tsx',
    [
      '/Users/user/code/.storybook/Icon.stories.tsx',
      '/Users/user/code/Icon.stories.tsx',
      '/Users/user/code/src/Icon.stories.tsx',
      '/Users/user/code/src/components/Icon.stories.tsx',
      '/Users/user/code/src/components/Icon.stories/Icon.stories.tsx',
    ],
    [
      '/Users/user/code/.storybook/stories.tsx',
      '/Users/user/code/stories.tsx',
      '/Users/user/code/Icon.stories.ts',
      '/Users/user/code/Icon.stories.js',
      '/Users/user/code/src/components/stories.tsx',
      '/Users/user/code/src/components/Icon.stories/stories.tsx',
      '/Users/user/code/src/components/Icon.stories.ts',
      '/Users/user/code/src/components/Icon.stories.js',
    ],
  ],
  [
    '../src',
    [],
    [
      '/Users/user/code/Icon.stories.tsx',
      '/Users/user/code/src/Icon.stories.tsx',
      '/Users/user/code/src/components/Icon.stories.tsx',
      '/Users/user/code/src/components/Icon.stories/Icon.stories.tsx',
      '/Users/user/code/stories.tsx',
      '/Users/user/code/Icon.stories.ts',
      '/Users/user/code/Icon.stories.js',
      '/Users/user/code/src/components/stories.tsx',
      '/Users/user/code/src/components/Icon.stories/stories.tsx',
      '/Users/user/code/src/components/Icon.stories.ts',
      '/Users/user/code/src/components/Icon.stories.js',
    ],
  ],
  [
    '../src/*',
    ['/Users/user/code/src/Icon.stories.tsx'],
    [
      '/Users/user/code/Icon.stories.tsx',
      '/Users/user/code/src/components/Icon.stories.tsx',
      '/Users/user/code/src/components/Icon.stories/Icon.stories.tsx',
      '/Users/user/code/stories.tsx',
      '/Users/user/code/Icon.stories.ts',
      '/Users/user/code/Icon.stories.js',
      '/Users/user/code/src/components/stories.tsx',
      '/Users/user/code/src/components/Icon.stories/stories.tsx',
      '/Users/user/code/src/components/Icon.stories.ts',
      '/Users/user/code/src/components/Icon.stories.js',
    ],
  ],
  [
    './stories/**/*.stories.tsx',
    [
      '/Users/user/code/.storybook/stories/Icon.stories.tsx',
      '/Users/user/code/.storybook/stories/components/Icon.stories.tsx',
      '/Users/user/code/.storybook/stories/components/Icon.stories/Icon.stories.tsx',
    ],
    [
      '/Users/user/code/Icon.stories.tsx',
      '/Users/user/code/stories.tsx',
      '/Users/user/code/Icon.stories.ts',
      '/Users/user/code/Icon.stories.js',
      '/Users/user/code/stories/components/stories.tsx',
      '/Users/user/code/stories/components/Icon.stories/stories.tsx',
      '/Users/user/code/stories/components/Icon.stories.ts',
      '/Users/user/code/stories/components/Icon.stories.js',
    ],
  ],
  [
    '../src/**/*.stories.tsx',
    [
      '/Users/user/code/src/Icon.stories.tsx',
      '/Users/user/code/src/components/Icon.stories.tsx',
      '/Users/user/code/src/components/Icon.stories/Icon.stories.tsx',
    ],
    [
      '/Users/user/code/.storybook/Icon.stories.tsx',
      // Although it would make sense for these three files to fail to match the `importFn()`,
      // because we are limited to matching on the RHS of the path (from 'src' onwards, basically)
      // we cannot avoid matching things inside the config dir in such situations.
      // '/Users/user/code/.storybook/src/Icon.stories.tsx',
      // '/Users/user/code/.storybook/src/components/Icon.stories.tsx',
      // '/Users/user/code/.storybook/src/components/Icon.stories/Icon.stories.tsx',
      '/Users/user/code/Icon.stories.tsx',
      '/Users/user/code/stories.tsx',
      '/Users/user/code/Icon.stories.ts',
      '/Users/user/code/Icon.stories.js',
      '/Users/user/code/src/components/stories.tsx',
      '/Users/user/code/src/components/Icon.stories/stories.tsx',
      '/Users/user/code/src/components/Icon.stories.ts',
      '/Users/user/code/src/components/Icon.stories.js',
    ],
  ],
  [
    '../../src/**/*.stories.tsx',
    [
      '/Users/user/code/src/Icon.stories.tsx',
      '/Users/user/code/src/components/Icon.stories.tsx',
      '/Users/user/code/src/components/Icon.stories/Icon.stories.tsx',
    ],
    [
      '/Users/user/code/Icon.stories.tsx',
      '/Users/user/code/stories.tsx',
      '/Users/user/code/Icon.stories.ts',
      '/Users/user/code/Icon.stories.js',
      '/Users/user/code/src/components/stories.tsx',
      '/Users/user/code/src/components/Icon.stories/stories.tsx',
      '/Users/user/code/src/components/Icon.stories.ts',
      '/Users/user/code/src/components/Icon.stories.js',
    ],
  ],
  [
    './../../src/**/*.stories.tsx',
    [
      '/Users/user/code/src/Icon.stories.tsx',
      '/Users/user/code/src/components/Icon.stories.tsx',
      '/Users/user/code/src/components/Icon.stories/Icon.stories.tsx',
    ],
    [
      '/Users/user/code/Icon.stories.tsx',
      '/Users/user/code/stories.tsx',
      '/Users/user/code/Icon.stories.ts',
      '/Users/user/code/Icon.stories.js',
      '/Users/user/code/src/components/stories.tsx',
      '/Users/user/code/src/components/Icon.stories/stories.tsx',
      '/Users/user/code/src/components/Icon.stories.ts',
      '/Users/user/code/src/components/Icon.stories.js',
    ],
  ],
  [
    './Introduction.stories.tsx',
    ['/Users/user/code/.storybook/Introduction.stories.tsx'],
    [
      '/Users/user/code/Introduction.stories.tsx',
      '/Users/user/code/src/Introduction.stories.tsx',
      '/Users/user/code/src/Introduction.tsx',
    ],
  ],
  [
    'Introduction.stories.tsx',
    ['/Users/user/code/.storybook/Introduction.stories.tsx'],
    [
      '/Users/user/code/Introduction.stories.tsx',
      '/Users/user/code/src/Introduction.stories.tsx',
      '/Users/user/code/src/Introduction.tsx',
    ],
  ],
];

describe('toImportFn - webpackIncludeRegexp', () => {
  it.each(testCases)('matches only suitable paths - %s', (glob, validPaths, invalidPaths) => {
    const regex = webpackIncludeRegexp(
      normalizeStoriesEntry(glob, {
        configDir: '/Users/user/code/.storybook',
        workingDir: '/Users/user/code/',
      })
    );

    const isNotMatchedForValidPaths = validPaths.filter(
      (absolutePath) => !regex.test(absolutePath)
    );
    const isMatchedForInvalidPaths = invalidPaths.filter(
      (absolutePath) => !!regex.test(absolutePath)
    );

    expect(isNotMatchedForValidPaths).toEqual([]);
    expect(isMatchedForInvalidPaths).toEqual([]);
  });
});

describe('toImportFn - generated code', () => {
  const stories = [
    normalizeStoriesEntry('../src/**/*.stories.tsx', {
      configDir: '/Users/user/code/.storybook',
      workingDir: '/Users/user/code/',
    }),
  ];

  it('generates code with direct import when needPipelinedImport is false', () => {
    const generated = toImportFn(stories, { needPipelinedImport: false });

    // Should use identity pipeline (x) => x()
    expect(generated).toContain('const pipeline = (x) => x();');
    expect(generated).not.toContain('importPipeline');
    expect(generated).toContain('const moduleExports = await pipeline(() => importers[i](path));');
  });

  it('generates code with identity pipeline when needPipelinedImport is omitted', () => {
    const generated = toImportFn(stories);

    // Should default to identity pipeline
    expect(generated).toContain('const pipeline = (x) => x();');
    expect(generated).not.toContain('importPipeline');
  });

  it('generates code with importPipeline when needPipelinedImport is true', () => {
    const generated = toImportFn(stories, { needPipelinedImport: true });

    // Should include the full importPipeline implementation
    expect(generated).toContain('const importPipeline = ');
    expect(generated).toContain('const pipeline = importPipeline();');
    expect(generated).toContain('const moduleExports = await pipeline(() => importers[i](path));');
  });

  it('generated importFn loops through importers', () => {
    const generated = toImportFn(stories);

    expect(generated).toContain('export async function importFn(path)');
    expect(generated).toContain('for (let i = 0; i < importers.length; i++)');
    expect(generated).toContain('const moduleExports = await pipeline(() => importers[i](path));');
    expect(generated).toContain('if (moduleExports)');
    expect(generated).toContain('return moduleExports;');
  });

  it('generates multiple importers for multiple stories', () => {
    const multipleStories = [
      normalizeStoriesEntry('../src/**/*.stories.tsx', {
        configDir: '/Users/user/code/.storybook',
        workingDir: '/Users/user/code/',
      }),
      normalizeStoriesEntry('../components/**/*.stories.tsx', {
        configDir: '/Users/user/code/.storybook',
        workingDir: '/Users/user/code/',
      }),
    ];
    const generated = toImportFn(multipleStories);

    // Should have multiple async functions in the importers array
    expect(generated).toContain('const importers = [');
    expect(generated.match(/async \(path\) =>/g)?.length).toBe(2);
  });
});

describe('toImportFn - working dir inside the specifier directory', () => {
  const configDir = '/repo/.storybook';

  const loadImportFn = (code: string) =>
    new Function(
      'request',
      code
        .replace('export async function importFn', 'return async function importFn')
        .replaceAll('import(', 'request(')
    )((request: string) => request) as (path: string) => Promise<string | undefined>;

  it.each([
    [
      '../src/**/*.stories.ts',
      '/repo',
      './src/Button.stories.ts',
      './src/Button.stories.ts',
      '/repo/src/Button.stories.ts',
    ],
    [
      '../packages/@(core|other)/src/**/*.stories.ts',
      '/repo/packages/core',
      './src/Button.stories.ts',
      '../core/src/Button.stories.ts',
      '/repo/packages/core/src/Button.stories.ts',
    ],
    [
      '../packages/@(core|other)/src/**/*.stories.ts',
      '/repo/packages/core',
      '../other/src/Card.stories.ts',
      '../other/src/Card.stories.ts',
      '/repo/packages/other/src/Card.stories.ts',
    ],
    [
      '../**/*.stories.ts',
      '/repo/packages/core',
      './src/Button.stories.ts',
      '../../packages/core/src/Button.stories.ts',
      '/repo/packages/core/src/Button.stories.ts',
    ],
    [
      '../**/*.stories.ts',
      '/repo/packages/core',
      '../other/src/Card.stories.ts',
      '../../packages/other/src/Card.stories.ts',
      '/repo/packages/other/src/Card.stories.ts',
    ],
  ])('%s from %s: imports %s as %s', async (glob, workingDir, importPath, request, file) => {
    const specifier = normalizeStoriesEntry(glob, { configDir, workingDir });
    const importFn = loadImportFn(toImportFn([specifier], { workingDir }));

    await expect(importFn(importPath)).resolves.toBe(request);
    expect(webpackIncludeRegexp(specifier).test(file)).toBe(true);
  });

  it('skips import paths outside the specifier', async () => {
    const workingDir = '/repo/packages/core';
    const specifier = normalizeStoriesEntry('../packages/@(core|other)/src/**/*.stories.ts', {
      configDir,
      workingDir,
    });
    const importFn = loadImportFn(toImportFn([specifier], { workingDir }));

    await expect(importFn('./lib/Button.stories.ts')).resolves.toBeUndefined();
  });
});
