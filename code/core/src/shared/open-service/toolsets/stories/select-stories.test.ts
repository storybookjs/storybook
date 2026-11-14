import path from 'node:path';

import type { StoryIndex } from 'storybook/internal/types';

import { describe, expect, it } from 'vitest';

import { filterStoryFiles } from './select-stories.ts';

const ROOT = path.resolve('/repo');
const at = (file: string) => path.join(ROOT, file).replaceAll('\\', '/');

function story(id: string, importPath: string, subtype: 'story' | 'test' = 'story') {
  return { type: 'story', subtype, id, name: id, title: id, importPath, tags: [] };
}

const index = {
  v: 5,
  entries: {
    'button--primary': story('button--primary', './src/Button.stories.tsx'),
    'button--primary:renders': story('button--primary:renders', './src/Button.stories.tsx', 'test'),
    'header--default': story('header--default', './src/header/Header.stories.tsx'),
    'page--default': story('page--default', './src/Page.stories.tsx'),
    'button--docs': {
      type: 'docs',
      id: 'button--docs',
      name: 'Docs',
      title: 'Button',
      importPath: './src/Button.stories.tsx',
      storiesImports: [],
      tags: [],
    },
  },
} as unknown as StoryIndex;

describe('filterStoryFiles', () => {
  const filter = (filters: string[], cwd = ROOT) =>
    filterStoryFiles({ index, filters, cwd, workingDir: ROOT });

  it('matches a case-insensitive substring of the path relative to the current directory', () => {
    expect(filter(['button'])).toEqual({
      storyFiles: ['./src/Button.stories.tsx'],
      storyIds: ['button--primary', 'button--primary:renders'],
    });
    expect(filter(['src/Header']).storyFiles).toEqual(['./src/header/Header.stories.tsx']);
  });

  it('matches an absolute file or directory as a path prefix', () => {
    expect(filter([at('src/Button.stories.tsx')]).storyFiles).toEqual(['./src/Button.stories.tsx']);
    expect(filter([at('src/header')]).storyFiles).toEqual(['./src/header/Header.stories.tsx']);
  });

  it('matches relative to the current directory, from a subdirectory too', () => {
    expect(filter(['Header.stories'], at('src/header')).storyFiles).toEqual([
      './src/header/Header.stories.tsx',
    ]);
  });

  it('unions several filters and ignores one that matches nothing', () => {
    expect(filter(['Button', 'Page', 'nothing-here']).storyFiles).toEqual([
      './src/Button.stories.tsx',
      './src/Page.stories.tsx',
    ]);
  });

  it('matches no story file for a component file', () => {
    expect(filter(['src/Button.tsx'])).toEqual({ storyFiles: [], storyIds: [] });
  });
});
