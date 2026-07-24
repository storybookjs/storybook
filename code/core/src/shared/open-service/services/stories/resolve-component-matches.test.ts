import { existsSync } from 'node:fs';

import type { StoryIndex } from 'storybook/internal/types';

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';

import type { ModuleGraphService } from '../module-graph/definition.ts';
import { resolveComponentMatches } from './resolve-component-matches.ts';

vi.mock('node:fs', { spy: true });

const existingPath = '/repo/src/Button.tsx';
const missingPath = `${existingPath}.missing`;
const index = {
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
  },
} as StoryIndex;

const storiesForFiles = vi.fn();
const moduleGraph = {
  queries: {
    storiesForFiles: { loaded: storiesForFiles },
  },
} as unknown as ModuleGraphService;
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

describe('resolveComponentMatches', () => {
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
