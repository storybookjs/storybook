import { describe, expect, it } from 'vitest';

import { normalizeStoriesEntry } from 'storybook/internal/common';

import { webpackIncludeRegexp } from './to-importFn';

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
