import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ModuleGraphService } from '../module-graph/definition.ts';
import { detectUnreachableFiles } from './detect-unreachable-files.ts';

const statusLoaded = vi.fn();
const storiesForFilesLoaded = vi.fn();
const moduleGraph = {
  queries: {
    status: { loaded: statusLoaded },
    storiesForFiles: { loaded: storiesForFilesLoaded },
  },
} as unknown as ModuleGraphService;
let statusFixture: { value: 'ready' } | { value: 'unavailable'; reason: string };
let storiesForFilesFixture: Array<Array<{ storyFile: string; depth: number }>>;

beforeEach(() => {
  vi.clearAllMocks();
  statusFixture = { value: 'ready' };
  storiesForFilesFixture = [];
  statusLoaded.mockImplementation(async () => statusFixture);
  storiesForFilesLoaded.mockImplementation(async () => storiesForFilesFixture);
});

describe('detectUnreachableFiles', () => {
  it('returns only changed files that cannot reach a story when the graph is ready', async () => {
    storiesForFilesFixture = [
      [{ storyFile: './src/Button.stories.tsx', depth: 1 }],
      [],
      [{ storyFile: './src/Page.stories.tsx', depth: 2 }],
    ];

    await expect(
      detectUnreachableFiles({
        files: ['src/Button.tsx', 'src/theme.ts', 'src/Icon.tsx'],
        moduleGraph,
      })
    ).resolves.toEqual(['src/theme.ts']);
    expect(storiesForFilesLoaded).toHaveBeenCalledWith({
      files: ['src/Button.tsx', 'src/theme.ts', 'src/Icon.tsx'],
    });
  });

  it('returns no files when the module graph is unavailable', async () => {
    statusFixture = { value: 'unavailable', reason: 'unsupported builder' };

    await expect(
      detectUnreachableFiles({ files: ['src/Button.tsx'], moduleGraph })
    ).resolves.toEqual([]);
    expect(storiesForFilesLoaded).not.toHaveBeenCalled();
  });
});
