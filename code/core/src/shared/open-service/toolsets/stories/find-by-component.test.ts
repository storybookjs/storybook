import { existsSync } from 'node:fs';

import type { StoryIndex } from 'storybook/internal/types';

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';

import type { ModuleGraphService } from '../../services/module-graph/definition.ts';
import { findStoriesByComponent, resolveComponentMatches } from './find-by-component.ts';

vi.mock('node:fs', { spy: true });

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

const storiesForFiles = vi.fn();
const moduleGraph = {
  queries: {
    storiesForFiles: {
      loaded: storiesForFiles,
    },
  },
} as unknown as ModuleGraphService;

describe('findStoriesByComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(true);
  });

  it('enriches matches from the story index', async () => {
    storiesForFiles.mockResolvedValue([
      [
        { storyFile: './src/Button.stories.tsx', depth: 1 },
        { storyFile: './src/Button.stories.tsx', depth: 1 },
      ],
    ]);

    const result = await findStoriesByComponent({
      componentPaths: ['/repo/src/Button.tsx'],
      index,
      moduleGraph,
    });

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
    vi.mocked(existsSync).mockReturnValue(false);

    const result = await findStoriesByComponent({
      componentPaths: ['/repo/src/Missing.tsx'],
      index,
      moduleGraph,
    });

    expect(result).toEqual({
      results: [
        {
          componentPath: '/repo/src/Missing.tsx',
          matches: [],
          pathNotFound: true,
        },
      ],
    });
    expect(storiesForFiles).not.toHaveBeenCalled();
  });

  it('clips matches beyond maxDistance and records clipped distances', async () => {
    storiesForFiles.mockResolvedValue([
      [
        { storyFile: './src/Button.stories.tsx', depth: 1 },
        { storyFile: './src/Input.stories.tsx', depth: 3 },
      ],
    ]);

    const result = await findStoriesByComponent({
      componentPaths: ['/repo/src/Button.tsx'],
      maxDistance: 1,
      index,
      moduleGraph,
    });

    expect(result.results[0]?.matches).toHaveLength(2);
    expect(result.results[0]?.clipped).toEqual({
      count: 1,
      distances: [3],
    });
  });

  it('defaults maxDistance to 3', async () => {
    storiesForFiles.mockResolvedValue([
      [
        { storyFile: './src/Button.stories.tsx', depth: 3 },
        { storyFile: './src/Input.stories.tsx', depth: 4 },
      ],
    ]);

    const result = await findStoriesByComponent({
      componentPaths: ['/repo/src/Button.tsx'],
      index,
      moduleGraph,
    });

    expect(result.results[0]?.matches.map((m) => m.storyId)).toEqual([
      'button--primary',
      'button--secondary',
    ]);
    expect(result.results[0]?.clipped).toEqual({ count: 1, distances: [4] });
  });
});

describe('resolveComponentMatches', () => {
  const existingPath = '/repo/src/Button.tsx';
  const missingPath = `${existingPath}.missing`;
  let graphResults: Array<Array<{ storyFile: string; depth: number }>>;
  let graphError: Error | undefined;

  beforeEach(async () => {
    const memfs = await vi.importActual<typeof import('memfs')>('memfs');

    vi.clearAllMocks();
    vol.reset();
    vol.fromNestedJSON({ [existingPath]: '' });
    vi.mocked(existsSync).mockImplementation(memfs.fs.existsSync as typeof existsSync);
    graphResults = [];
    graphError = undefined;
    storiesForFiles.mockImplementation(async () => {
      if (graphError) {
        throw graphError;
      }
      return graphResults;
    });
  });

  afterAll(() => {
    vol.reset();
  });

  it('maps existing component files to story ids', async () => {
    graphResults = [[{ storyFile: './src/Button.stories.tsx', depth: 1 }]];

    await expect(
      resolveComponentMatches({ componentPaths: [existingPath], index, moduleGraph })
    ).resolves.toEqual([
      {
        componentPath: existingPath,
        matches: [
          { storyId: 'button--primary', depth: 1 },
          { storyId: 'button--secondary', depth: 1 },
        ],
      },
    ]);
  });

  it('marks paths that do not exist', async () => {
    graphResults = [[]];

    await expect(
      resolveComponentMatches({ componentPaths: [missingPath], index, moduleGraph })
    ).resolves.toEqual([
      {
        componentPath: missingPath,
        matches: [],
        pathNotFound: true,
      },
    ]);
  });

  it('keeps each story id at its shortest depth', async () => {
    graphResults = [
      [
        { storyFile: './src/Button.stories.tsx', depth: 3 },
        { storyFile: './src/Button.stories.tsx', depth: 1 },
      ],
    ];

    const [result] = await resolveComponentMatches({
      componentPaths: [existingPath],
      index,
      moduleGraph,
    });

    expect(result.matches).toEqual([
      { storyId: 'button--primary', depth: 1 },
      { storyId: 'button--secondary', depth: 1 },
    ]);
  });

  it('returns empty matches when the module graph errors', async () => {
    graphError = new Error('graph failed');

    await expect(
      resolveComponentMatches({ componentPaths: [existingPath], index, moduleGraph })
    ).resolves.toEqual([{ componentPath: existingPath, matches: [] }]);
  });
});
