import { fileURLToPath } from 'node:url';

import type { StoryIndex } from 'storybook/internal/types';

import { describe, expect, it, vi } from 'vitest';

import type { ModuleGraphService } from '../module-graph/definition.ts';
import { resolveComponentMatches } from './resolve-component-matches.ts';

const existingPath = fileURLToPath(new URL('./resolve-component-matches.test.ts', import.meta.url));
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

function createModuleGraph(
  loaded: (input: {
    files: string[];
  }) => Promise<Array<Array<{ storyFile: string; depth: number }>>>
) {
  return {
    queries: {
      storiesForFiles: { loaded: vi.fn(loaded) },
    },
  } as unknown as ModuleGraphService;
}

describe('resolveComponentMatches', () => {
  it('maps existing component files to story ids', async () => {
    const moduleGraph = createModuleGraph(async () => [
      [{ storyFile: './src/Button.stories.tsx', depth: 1 }],
    ]);

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
    const moduleGraph = createModuleGraph(async () => [[]]);

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
    const moduleGraph = createModuleGraph(async () => [
      [
        { storyFile: './src/Button.stories.tsx', depth: 3 },
        { storyFile: './src/Button.stories.tsx', depth: 1 },
      ],
    ]);

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
    const moduleGraph = createModuleGraph(async () => {
      throw new Error('graph failed');
    });

    await expect(
      resolveComponentMatches({ componentPaths: [existingPath], index, moduleGraph })
    ).resolves.toEqual([{ componentPath: existingPath, matches: [] }]);
  });
});
