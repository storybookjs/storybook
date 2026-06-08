import { describe, expect, it } from 'vitest';

import { hasCoreAnnotations } from '../../../../csf/core-annotations.ts';
import { definePreview } from '../../../../csf/csf-factories.ts';
import { processCSFFile } from './processCSFFile.ts';

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

describe('CSF4 factory files', () => {
  it('sets projectAnnotations to the core-composed preview exactly once', () => {
    const preview = definePreview({ render: () => {} });
    const meta = preview.meta({ title: 'Component' });
    const Primary = meta.story({});

    const csfFile = processCSFFile(
      { default: meta, Primary },
      './path/to/component.js',
      'Component'
    );

    // Factory stories carry their own project annotations (the preview's composed result), which
    // already contain the core annotations exactly once and are flagged as such. This is what lets
    // them bypass the (potentially doubled) store-level projectAnnotations.
    expect(csfFile.projectAnnotations).toBe(preview.composed);
    expect(hasCoreAnnotations(csfFile.projectAnnotations)).toBe(true);
  });
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
