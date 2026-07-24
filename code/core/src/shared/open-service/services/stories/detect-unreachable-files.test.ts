import { describe, expect, it, vi } from 'vitest';

import type { ModuleGraphService } from '../module-graph/definition.ts';
import { detectUnreachableFiles } from './detect-unreachable-files.ts';

function createModuleGraph(options: {
  status: { value: 'ready' } | { value: 'unavailable'; reason: string };
  storiesForFiles?: Array<Array<{ storyFile: string; depth: number }>>;
}) {
  return {
    queries: {
      status: { loaded: vi.fn(async () => options.status) },
      storiesForFiles: {
        loaded: vi.fn(async () => options.storiesForFiles ?? []),
      },
    },
  } as unknown as ModuleGraphService;
}

describe('detectUnreachableFiles', () => {
  it('returns only changed files that cannot reach a story when the graph is ready', async () => {
    const moduleGraph = createModuleGraph({
      status: { value: 'ready' },
      storiesForFiles: [
        [{ storyFile: './src/Button.stories.tsx', depth: 1 }],
        [],
        [{ storyFile: './src/Page.stories.tsx', depth: 2 }],
      ],
    });

    await expect(
      detectUnreachableFiles({
        files: ['src/Button.tsx', 'src/theme.ts', 'src/Icon.tsx'],
        moduleGraph,
      })
    ).resolves.toEqual(['src/theme.ts']);
    expect(moduleGraph.queries.storiesForFiles.loaded).toHaveBeenCalledWith({
      files: ['src/Button.tsx', 'src/theme.ts', 'src/Icon.tsx'],
    });
  });

  it('returns no files when the module graph is unavailable', async () => {
    const moduleGraph = createModuleGraph({
      status: { value: 'unavailable', reason: 'unsupported builder' },
    });

    await expect(
      detectUnreachableFiles({ files: ['src/Button.tsx'], moduleGraph })
    ).resolves.toEqual([]);
    expect(moduleGraph.queries.storiesForFiles.loaded).not.toHaveBeenCalled();
  });
});
