import { describe, expect, it } from 'vitest';

import { normalizeStoriesEntry } from 'storybook/internal/common';

import { webpackIncludeRegexp } from './to-importFn';

const testCases: [string, string[], string[]][] = [
  [
    '**/*.stories.tsx',
    [
      '/Users/user/.storybook/Icon.stories.tsx',
      '/Users/user/.storybook/stories/Icon.stories.tsx',
      '/Users/user/.storybook/stories/components/Icon.stories.tsx',
    ],
    [
      '/Users/user/.storybook/stories.tsx',
      '/Users/user/.storybook/Icon.stories.ts',
      '/Users/user/.storybook/Icon.stories.js',
      '/Users/user/.storybook/src/components/stories.tsx',
      '/Users/user/.storybook/src/components/Icon.stories/stories.tsx',
      '/Users/user/.storybook/src/components/Icon.stories.ts',
      '/Users/user/.storybook/src/components/Icon.stories.js',
      '/Users/user/src/components/Icon.stories.tsx',
    ],
  ],
  [
    './**/*.stories.tsx',
    [
      '/Users/user/.storybook/Icon.stories.tsx',
      '/Users/user/.storybook/stories/Icon.stories.tsx',
      '/Users/user/.storybook/stories/components/Icon.stories.tsx',
    ],
    [
      '/Users/user/.storybook/stories.tsx',
      '/Users/user/.storybook/Icon.stories.ts',
      '/Users/user/.storybook/Icon.stories.js',
      '/Users/user/.storybook/src/components/stories.tsx',
      '/Users/user/.storybook/src/components/Icon.stories/stories.tsx',
      '/Users/user/.storybook/src/components/Icon.stories.ts',
      '/Users/user/.storybook/src/components/Icon.stories.js',
      '/Users/user/src/components/Icon.stories.tsx',
    ],
  ],
  [
    '../**/*.stories.tsx',
    [
      '/Users/user/.storybook/Icon.stories.tsx',
      '/Users/user/Icon.stories.tsx',
      '/Users/user/src/Icon.stories.tsx',
      '/Users/user/src/components/Icon.stories.tsx',
      '/Users/user/src/components/Icon.stories/Icon.stories.tsx',
    ],
    [
      '/Users/user/.storybook/stories.tsx',
      '/Users/user/stories.tsx',
      '/Users/user/Icon.stories.ts',
      '/Users/user/Icon.stories.js',
      '/Users/user/src/components/stories.tsx',
      '/Users/user/src/components/Icon.stories/stories.tsx',
      '/Users/user/src/components/Icon.stories.ts',
      '/Users/user/src/components/Icon.stories.js',
    ],
  ],
  [
    '../src',
    [],
    [
      '/Users/user/Icon.stories.tsx',
      '/Users/user/src/Icon.stories.tsx',
      '/Users/user/src/components/Icon.stories.tsx',
      '/Users/user/src/components/Icon.stories/Icon.stories.tsx',
      '/Users/user/stories.tsx',
      '/Users/user/Icon.stories.ts',
      '/Users/user/Icon.stories.js',
      '/Users/user/src/components/stories.tsx',
      '/Users/user/src/components/Icon.stories/stories.tsx',
      '/Users/user/src/components/Icon.stories.ts',
      '/Users/user/src/components/Icon.stories.js',
    ],
  ],
  [
    '../src/*',
    ['/Users/user/src/Icon.stories.tsx'],
    [
      '/Users/user/Icon.stories.tsx',
      '/Users/user/src/components/Icon.stories.tsx',
      '/Users/user/src/components/Icon.stories/Icon.stories.tsx',
      '/Users/user/stories.tsx',
      '/Users/user/Icon.stories.ts',
      '/Users/user/Icon.stories.js',
      '/Users/user/src/components/stories.tsx',
      '/Users/user/src/components/Icon.stories/stories.tsx',
      '/Users/user/src/components/Icon.stories.ts',
      '/Users/user/src/components/Icon.stories.js',
    ],
  ],
  [
    './stories/**/*.stories.tsx',
    [
      '/Users/user/.storybook/stories/Icon.stories.tsx',
      '/Users/user/.storybook/stories/components/Icon.stories.tsx',
      '/Users/user/.storybook/stories/components/Icon.stories/Icon.stories.tsx',
    ],
    [
      '/Users/user/Icon.stories.tsx',
      '/Users/user/stories.tsx',
      '/Users/user/Icon.stories.ts',
      '/Users/user/Icon.stories.js',
      '/Users/user/stories/components/stories.tsx',
      '/Users/user/stories/components/Icon.stories/stories.tsx',
      '/Users/user/stories/components/Icon.stories.ts',
      '/Users/user/stories/components/Icon.stories.js',
    ],
  ],
  [
    '../src/**/*.stories.tsx',
    [
      '/Users/user/src/Icon.stories.tsx',
      '/Users/user/src/components/Icon.stories.tsx',
      '/Users/user/src/components/Icon.stories/Icon.stories.tsx',
    ],
    [
      '/Users/user/.storybook/Icon.stories.tsx',
      // Although it would make sense for these three files to fail to match the `importFn()`,
      // because we are limited to matching on the RHS of the path (from 'src' onwards, basically)
      // we cannot avoid matching things inside the config dir in such situations.
      // '/Users/user/.storybook/src/Icon.stories.tsx',
      // '/Users/user/.storybook/src/components/Icon.stories.tsx',
      // '/Users/user/.storybook/src/components/Icon.stories/Icon.stories.tsx',
      '/Users/user/Icon.stories.tsx',
      '/Users/user/stories.tsx',
      '/Users/user/Icon.stories.ts',
      '/Users/user/Icon.stories.js',
      '/Users/user/src/components/stories.tsx',
      '/Users/user/src/components/Icon.stories/stories.tsx',
      '/Users/user/src/components/Icon.stories.ts',
      '/Users/user/src/components/Icon.stories.js',
    ],
  ],
  [
    '../../src/**/*.stories.tsx',
    [
      '/Users/user/src/Icon.stories.tsx',
      '/Users/user/src/components/Icon.stories.tsx',
      '/Users/user/src/components/Icon.stories/Icon.stories.tsx',
    ],
    [
      '/Users/user/Icon.stories.tsx',
      '/Users/user/stories.tsx',
      '/Users/user/Icon.stories.ts',
      '/Users/user/Icon.stories.js',
      '/Users/user/src/components/stories.tsx',
      '/Users/user/src/components/Icon.stories/stories.tsx',
      '/Users/user/src/components/Icon.stories.ts',
      '/Users/user/src/components/Icon.stories.js',
    ],
  ],
  [
    './../../src/**/*.stories.tsx',
    [
      '/Users/user/src/Icon.stories.tsx',
      '/Users/user/src/components/Icon.stories.tsx',
      '/Users/user/src/components/Icon.stories/Icon.stories.tsx',
    ],
    [
      '/Users/user/Icon.stories.tsx',
      '/Users/user/stories.tsx',
      '/Users/user/Icon.stories.ts',
      '/Users/user/Icon.stories.js',
      '/Users/user/src/components/stories.tsx',
      '/Users/user/src/components/Icon.stories/stories.tsx',
      '/Users/user/src/components/Icon.stories.ts',
      '/Users/user/src/components/Icon.stories.js',
    ],
  ],
  [
    './Introduction.stories.tsx',
    ['/Users/user/.storybook/Introduction.stories.tsx'],
    [
      '/Users/user/Introduction.stories.tsx',
      '/Users/user/src/Introduction.stories.tsx',
      '/Users/user/src/Introduction.tsx',
    ],
  ],
  [
    'Introduction.stories.tsx',
    ['/Users/user/.storybook/Introduction.stories.tsx'],
    [
      '/Users/user/Introduction.stories.tsx',
      '/Users/user/src/Introduction.stories.tsx',
      '/Users/user/src/Introduction.tsx',
    ],
  ],
];

describe('toImportFn - webpackIncludeRegexp', () => {
  it.each(testCases)('matches only suitable paths - %s', (glob, validPaths, invalidPaths) => {
    const regex = webpackIncludeRegexp(
      normalizeStoriesEntry(glob, {
        configDir: '/Users/user/.storybook',
        workingDir: '/Users/user/',
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
