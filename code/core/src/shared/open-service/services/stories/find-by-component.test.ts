import { describe, expect, it } from 'vitest';

import type { StoryIndex } from 'storybook/internal/types';

import { findStoriesByComponent, type ResolveComponentMatchesResult } from './find-by-component.ts';

const index: StoryIndex = {
  v: 5,
  entries: {
    'button--primary': {
      type: 'story',
      subtype: 'story',
      id: 'button--primary',
      name: 'Primary',
      title: 'Button',
      importPath: './src/Button.stories.tsx',
      tags: ['story'],
    },
    'button--secondary': {
      type: 'story',
      subtype: 'story',
      id: 'button--secondary',
      name: 'Secondary',
      title: 'Button',
      importPath: './src/Button.stories.tsx',
      tags: ['story'],
    },
    'input--default': {
      type: 'story',
      subtype: 'story',
      id: 'input--default',
      name: 'Default',
      title: 'Input',
      importPath: './src/Input.stories.tsx',
      tags: ['story'],
    },
  },
};

describe('findStoriesByComponent', () => {
  it('enriches matches from the story index', async () => {
    const resolveMatches = (): ResolveComponentMatchesResult[] => [
      {
        componentPath: '/repo/src/Button.tsx',
        matches: [
          { storyId: 'button--primary', depth: 1 },
          { storyId: 'button--secondary', depth: 1 },
        ],
      },
    ];

    const result = await findStoriesByComponent(
      { componentPaths: ['/repo/src/Button.tsx'], index },
      resolveMatches
    );

    expect(result).toEqual({
      results: [
        {
          componentPath: '/repo/src/Button.tsx',
          matches: [
            {
              storyId: 'button--primary',
              title: 'Button',
              name: 'Primary',
              importPath: './src/Button.stories.tsx',
              distance: 1,
            },
            {
              storyId: 'button--secondary',
              title: 'Button',
              name: 'Secondary',
              importPath: './src/Button.stories.tsx',
              distance: 1,
            },
          ],
        },
      ],
    });
  });

  it('marks pathNotFound and skips enrichment', async () => {
    const resolveMatches = (): ResolveComponentMatchesResult[] => [
      {
        componentPath: '/repo/src/Missing.tsx',
        matches: [],
        pathNotFound: true,
      },
    ];

    const result = await findStoriesByComponent(
      { componentPaths: ['/repo/src/Missing.tsx'], index },
      resolveMatches
    );

    expect(result).toEqual({
      results: [
        {
          componentPath: '/repo/src/Missing.tsx',
          matches: [],
          pathNotFound: true,
        },
      ],
    });
  });

  it('clips matches beyond maxDistance and records clipped distances', async () => {
    const resolveMatches = (): ResolveComponentMatchesResult[] => [
      {
        componentPath: '/repo/src/Button.tsx',
        matches: [
          { storyId: 'button--primary', depth: 1 },
          { storyId: 'button--secondary', depth: 1 },
          { storyId: 'input--default', depth: 3 },
        ],
      },
    ];

    const result = await findStoriesByComponent(
      { componentPaths: ['/repo/src/Button.tsx'], maxDistance: 1, index },
      resolveMatches
    );

    expect(result.results[0]?.matches).toHaveLength(2);
    expect(result.results[0]?.clipped).toEqual({
      count: 1,
      distances: [3],
    });
  });

  it('defaults maxDistance to 3', async () => {
    const resolveMatches = (): ResolveComponentMatchesResult[] => [
      {
        componentPath: '/repo/src/Button.tsx',
        matches: [
          { storyId: 'button--primary', depth: 3 },
          { storyId: 'input--default', depth: 4 },
        ],
      },
    ];

    const result = await findStoriesByComponent(
      { componentPaths: ['/repo/src/Button.tsx'], index },
      resolveMatches
    );

    expect(result.results[0]?.matches.map((m) => m.storyId)).toEqual(['button--primary']);
    expect(result.results[0]?.clipped).toEqual({ count: 1, distances: [4] });
  });

  it('drops storyIds missing from the index', async () => {
    const resolveMatches = (): ResolveComponentMatchesResult[] => [
      {
        componentPath: '/repo/src/Button.tsx',
        matches: [
          { storyId: 'button--primary', depth: 1 },
          { storyId: 'ghost--story', depth: 1 },
        ],
      },
    ];

    const result = await findStoriesByComponent(
      { componentPaths: ['/repo/src/Button.tsx'], index },
      resolveMatches
    );

    expect(result.results[0]?.matches.map((m) => m.storyId)).toEqual(['button--primary']);
  });
});
