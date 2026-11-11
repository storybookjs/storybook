import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';

import type { StoryIndex } from 'storybook/internal/types';

import { vol } from 'memfs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_MAX_DISTANCE, findStoriesByComponent } from './find-by-component.ts';
import type { ModuleGraphAccess, ModuleGraphStoryHit } from './resolve-component-stories.ts';

vi.mock('node:fs', { spy: true });

// Path resolution, barrel expansion, canonicalisation and dedupe belong to
// `resolveComponentStories` and are covered by resolve-component-stories.test.ts. What is asserted
// here is only what this module adds on top: maxDistance clipping, story-index enrichment, and the
// pass-through of the resolver's `pathNotFound` / unavailable outcomes.

const WORKING_DIR = path.resolve('/repo');
const BUTTON = path.join(WORKING_DIR, 'src/Button.tsx');
const MISSING = path.join(WORKING_DIR, 'src/Missing.tsx');

/** The forward-slashed form the resolver queries the module graph with. */
const asGraphPath = (filePath: string) => path.normalize(filePath).replaceAll('\\', '/');

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

/** A ready module graph whose reverse index answers with `hits` for every queried file. */
function readyGraph(hits: ModuleGraphStoryHit[]): ModuleGraphAccess {
  storiesForFiles.mockImplementation(async ({ files }: { files: string[] }) =>
    files.map((file) => (file === asGraphPath(BUTTON) ? hits : []))
  );
  return {
    queries: {
      status: { loaded: async () => ({ value: 'ready' }) },
      storiesForFiles: { loaded: storiesForFiles },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vol.reset();
  vol.fromNestedJSON({ [BUTTON]: '' });
  vi.mocked(existsSync).mockImplementation((filePath) => vol.existsSync(filePath));
  vi.mocked(realpathSync.native).mockImplementation((filePath) =>
    String(vol.realpathSync(filePath))
  );
});

describe('findStoriesByComponent', () => {
  it('enriches every match with its story-index metadata', async () => {
    const result = await findStoriesByComponent({
      componentPaths: [BUTTON],
      index,
      moduleGraph: readyGraph([{ storyFile: './src/Button.stories.tsx', depth: 1 }]),
    });

    expect(result).toEqual({
      available: true,
      results: [
        {
          componentPath: asGraphPath(BUTTON),
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

  it('clips matches past maxDistance and reports the distances that were dropped', async () => {
    const result = await findStoriesByComponent({
      componentPaths: [BUTTON],
      maxDistance: 1,
      index,
      moduleGraph: readyGraph([
        { storyFile: './src/Button.stories.tsx', depth: 1 },
        { storyFile: './src/Input.stories.tsx', depth: 3 },
      ]),
    });

    expect(result).toEqual({
      available: true,
      results: [
        {
          componentPath: asGraphPath(BUTTON),
          matches: [
            expect.objectContaining({ storyId: 'button--primary', distance: 1 }),
            expect.objectContaining({ storyId: 'button--secondary', distance: 1 }),
          ],
          clipped: { count: 1, distances: [3] },
        },
      ],
    });
  });

  it(`defaults the ceiling to ${DEFAULT_MAX_DISTANCE}`, async () => {
    const result = await findStoriesByComponent({
      componentPaths: [BUTTON],
      index,
      moduleGraph: readyGraph([
        { storyFile: './src/Button.stories.tsx', depth: DEFAULT_MAX_DISTANCE },
        { storyFile: './src/Input.stories.tsx', depth: DEFAULT_MAX_DISTANCE + 1 },
      ]),
    });

    expect(result).toMatchObject({
      available: true,
      results: [
        {
          matches: [
            expect.objectContaining({ storyId: 'button--primary' }),
            expect.objectContaining({ storyId: 'button--secondary' }),
          ],
          clipped: { count: 1, distances: [DEFAULT_MAX_DISTANCE + 1] },
        },
      ],
    });
  });

  it('omits `clipped` when nothing was dropped', async () => {
    const result = await findStoriesByComponent({
      componentPaths: [BUTTON],
      index,
      moduleGraph: readyGraph([{ storyFile: './src/Button.stories.tsx', depth: 1 }]),
    });

    expect(result).toEqual({
      available: true,
      results: [expect.not.objectContaining({ clipped: expect.anything() })],
    });
  });

  it('passes `pathNotFound` through without querying the reverse index', async () => {
    const result = await findStoriesByComponent({
      componentPaths: [MISSING],
      index,
      moduleGraph: readyGraph([{ storyFile: './src/Button.stories.tsx', depth: 1 }]),
    });

    expect(result).toEqual({
      available: true,
      results: [{ componentPath: asGraphPath(MISSING), matches: [], pathNotFound: true }],
    });
    expect(storiesForFiles).not.toHaveBeenCalled();
  });

  it('reports the graph as unavailable rather than as a component without stories', async () => {
    const result = await findStoriesByComponent({
      componentPaths: [BUTTON],
      index,
      moduleGraph: undefined,
    });

    expect(result).toEqual({
      available: false,
      reason: expect.stringMatching(/module graph is unavailable/i),
    });
  });
});
