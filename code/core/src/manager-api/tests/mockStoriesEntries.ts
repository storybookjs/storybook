import type { API_PreparedStoryIndex, StoryIndex } from '@storybook/core/types';

export const mockEntries: StoryIndex['entries'] = {
  'component-a--docs': {
    type: 'docs',
    id: 'component-a--docs',
    title: 'Component A',
    name: 'Docs',
    importPath: './path/to/component-a.ts',
    storiesImports: [],
  },
  'component-a--story-1': {
    type: 'story',
    id: 'component-a--story-1',
    title: 'Component A',
    name: 'Story 1',
    importPath: './path/to/component-a.ts',
  },
  'component-a--story-2': {
    type: 'story',
    id: 'component-a--story-2',
    title: 'Component A',
    name: 'Story 2',
    importPath: './path/to/component-a.ts',
  },
  'component-b--story-3': {
    type: 'story',
    id: 'component-b--story-3',
    title: 'Component B',
    name: 'Story 3',
    importPath: './path/to/component-b.ts',
  },
};
export const docsEntries: StoryIndex['entries'] = {
  'component-a--page': {
    type: 'story',
    id: 'component-a--page',
    title: 'Component A',
    name: 'Page',
    importPath: './path/to/component-a.ts',
  },
  'component-a--story-2': {
    type: 'story',
    id: 'component-a--story-2',
    title: 'Component A',
    name: 'Story 2',
    importPath: './path/to/component-a.ts',
  },
  'component-b-docs': {
    type: 'docs',
    id: 'component-b--docs',
    title: 'Component B',
    name: 'Docs',
    importPath: './path/to/component-b.ts',
    storiesImports: [],
  },
  'component-c--story-4': {
    type: 'story',
    id: 'component-c--story-4',
    title: 'Component c',
    name: 'Story 4',
    importPath: './path/to/component-c.ts',
  },
};
export const navigationEntries: StoryIndex['entries'] = {
  'a--1': {
    type: 'story',
    title: 'a',
    name: '1',
    id: 'a--1',
    importPath: './a.ts',
  },
  'a--2': {
    type: 'story',
    title: 'a',
    name: '2',
    id: 'a--2',
    importPath: './a.ts',
  },
  'b-c--1': {
    type: 'story',
    title: 'b/c',
    name: '1',
    id: 'b-c--1',
    importPath: './b/c.ts',
  },
  'b-d--1': {
    type: 'story',
    title: 'b/d',
    name: '1',
    id: 'b-d--1',
    importPath: './b/d.ts',
  },
  'b-d--2': {
    type: 'story',
    title: 'b/d',
    name: '2',
    id: 'b-d--2',
    importPath: './b/d.ts',
  },
  'custom-id--1': {
    type: 'story',
    title: 'b/e',
    name: '1',
    id: 'custom-id--1',
    importPath: './b/.ts',
  },
};
export const preparedEntries: API_PreparedStoryIndex['entries'] = {
  'a--1': {
    type: 'story',
    title: 'a',
    name: '1',
    parameters: {},
    id: 'a--1',
    args: { a: 'b' },
    importPath: './a.ts',
  },
  'b--1': {
    type: 'story',
    title: 'b',
    name: '1',
    parameters: {},
    id: 'b--1',
    args: { x: 'y' },
    importPath: './b.ts',
  },
};
