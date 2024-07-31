import { describe, it, expect } from 'vitest';

import { processCSFFile } from './processCSFFile';

it('returns a CSFFile object with meta and stories', () => {
  const { meta, stories } = processCSFFile(
    {
      default: { title: 'Component' },
      storyOne: { args: { a: 1 } },
      storyTwo: { args: { a: 2 } },
    },
    './path/to/component.js',
    'Component'
  );

  expect(meta).toEqual({
    id: 'component',
    title: 'Component',
    parameters: { fileName: './path/to/component.js' },
  });
  expect(stories).toEqual({
    'component--story-one': expect.objectContaining({
      id: 'component--story-one',
      name: 'Story One',
      args: { a: 1 },
    }),
    'component--story-two': expect.objectContaining({
      id: 'component--story-two',
      name: 'Story Two',
      args: { a: 2 },
    }),
  });
});

it('automatically sets title if undefined', () => {
  const { meta } = processCSFFile(
    {
      default: {},
      storyOne: {},
    },
    './path/to/component.js',
    'Prefix/to/file'
  );

  expect(meta).toEqual({
    id: 'prefix-to-file',
    title: 'Prefix/to/file',
    parameters: { fileName: './path/to/component.js' },
  });
});

it('ignores __namedExportsOrder', () => {
  const { stories } = processCSFFile(
    {
      default: { title: 'Component' },
      x: () => 0,
      y: () => 0,
      z: () => 0,
      w: () => 0,
      __namedExportsOrder: ['w', 'x', 'z', 'y'],
    },
    './path/to/component.js',
    'Component'
  );

  expect(Object.keys(stories)).toEqual([
    'component--x',
    'component--y',
    'component--z',
    'component--w',
  ]);
});

it('filters exports using includeStories array', () => {
  const { stories } = processCSFFile(
    {
      default: { title: 'Component', includeStories: ['x', 'z'] },
      x: () => 0,
      y: () => 0,
      z: () => 0,
      w: () => 0,
    },
    './path/to/component.js',
    'Component'
  );

  expect(Object.keys(stories)).toEqual(['component--x', 'component--z']);
});

it('filters exports using includeStories regex', () => {
  const { stories } = processCSFFile(
    {
      default: { title: 'Component', includeStories: /^(x|z)$/ },
      x: () => 0,
      y: () => 0,
      z: () => 0,
      w: () => 0,
    },
    './path/to/component.js',
    'Component'
  );

  expect(Object.keys(stories)).toEqual(['component--x', 'component--z']);
});

it('filters exports using excludeStories array', () => {
  const { stories } = processCSFFile(
    {
      default: { title: 'Component', excludeStories: ['x', 'z'] },
      x: () => 0,
      y: () => 0,
      z: () => 0,
      w: () => 0,
    },
    './path/to/component.js',
    'Component'
  );

  expect(Object.keys(stories)).toEqual(['component--y', 'component--w']);
});

it('filters exports using excludeStories regex', () => {
  const { stories } = processCSFFile(
    {
      default: { title: 'Component', excludeStories: /^(x|z)$/ },
      x: () => 0,
      y: () => 0,
      z: () => 0,
      w: () => 0,
    },
    './path/to/component.js',
    'Component'
  );

  expect(Object.keys(stories)).toEqual(['component--y', 'component--w']);
});

describe('moduleExports', () => {
  it('are carried through', () => {
    const moduleExports = {
      default: { title: 'Component' },
      storyOne: { args: { a: 1 } },
      storyTwo: { args: { a: 2 } },
    };
    const csfFile = processCSFFile(moduleExports, './path/to/component.js', 'Component');
    expect(csfFile.moduleExports).toBe(moduleExports);
  });
});
