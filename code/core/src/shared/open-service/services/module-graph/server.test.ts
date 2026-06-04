import { afterEach, describe, expect, it, vi } from 'vitest';

import { STORY_INDEX_INVALIDATED } from 'storybook/internal/core-events';

import { clearRegistry, registerService } from '../../server.ts';
import { moduleGraphServiceDef } from './definition.ts';
import {
  buildReverseIndex,
  createMockAdapter,
  installDependencyGraphMocks,
} from './module-graph.test-helpers.ts';
import { registerModuleGraphService, resolveChangeDetectionAdapter } from './server.ts';
import { toStoryIndexPath } from './types.ts';

vi.mock('./engine/dependency-graph/resolver-factory.ts', { spy: true });
vi.mock('./engine/dependency-graph/dependency-graph-builder.ts', { spy: true });
vi.mock('./engine/dependency-graph/incremental-patcher.ts', { spy: true });

afterEach(() => {
  clearRegistry();
  vi.restoreAllMocks();
});

/** Bare service registration (no engine), for exercising the query/command contract directly. */
function registerBareModuleGraph(workingDir = '/repo') {
  return registerService(moduleGraphServiceDef, {
    queries: {
      getStoriesForFiles: {
        handler: (input, ctx) => {
          return input.files.map((file) => {
            const entries = ctx.self.state.storiesByFile[toStoryIndexPath(file, workingDir)];
            if (!entries) {
              return [];
            }
            return Object.entries(entries).map(([storyFile, depth]) => ({ storyFile, depth }));
          });
        },
      },
      getStoryVersion: {
        handler: (input, ctx) =>
          ctx.self.state.storyVersions[toStoryIndexPath(input.storyFile, workingDir)] ?? 0,
      },
    },
  });
}

describe('module-graph open service', () => {
  describe('initial state', () => {
    it('starts not-ready with empty indexes and zeroed counters', () => {
      const runtime = registerBareModuleGraph();

      expect(runtime.queries.getReady(undefined)).toBe(false);
      expect(runtime.queries.getGraphRevision(undefined)).toBe(0);
      expect(runtime.queries.getAllStoryVersions(undefined)).toEqual({});
      expect(runtime.queries.getStoriesForFiles({ files: ['/repo/src/Button.tsx'] })).toEqual([[]]);
      expect(runtime.queries.getStoryVersion({ storyFile: '/repo/src/Button.stories.tsx' })).toBe(
        0
      );
    });
  });

  describe('applyGraphSnapshot command', () => {
    it('marks the service ready, stores the reverse index, and bumps the revision', async () => {
      const runtime = registerBareModuleGraph();

      await runtime.commands.applyGraphSnapshot({
        storiesByFile: {
          './src/Button.tsx': { './src/Button.stories.tsx': 1 },
        },
      });

      expect(runtime.queries.getReady(undefined)).toBe(true);
      expect(runtime.queries.getGraphRevision(undefined)).toBe(1);
      expect(runtime.queries.getStoriesForFiles({ files: ['/repo/src/Button.tsx'] })).toEqual([
        [{ storyFile: './src/Button.stories.tsx', depth: 1 }],
      ]);
    });

    it('replaces (not merges) the reverse index on a subsequent snapshot', async () => {
      const runtime = registerBareModuleGraph();

      await runtime.commands.applyGraphSnapshot({
        storiesByFile: { './src/A.tsx': { './src/A.stories.tsx': 0 } },
      });
      await runtime.commands.applyGraphSnapshot({
        storiesByFile: { './src/B.tsx': { './src/B.stories.tsx': 0 } },
      });

      expect(runtime.queries.getStoriesForFiles({ files: ['/repo/src/A.tsx'] })).toEqual([[]]);
      expect(runtime.queries.getStoriesForFiles({ files: ['/repo/src/B.tsx'] })).toEqual([
        [{ storyFile: './src/B.stories.tsx', depth: 0 }],
      ]);
      expect(runtime.queries.getGraphRevision(undefined)).toBe(2);
    });
  });

  describe('getStoriesForFiles query', () => {
    it('returns one result array per input file, positionally', async () => {
      const runtime = registerBareModuleGraph();
      await runtime.commands.applyGraphSnapshot({
        storiesByFile: {
          './src/Button.tsx': { './src/Button.stories.tsx': 1 },
          './src/Card.tsx': {
            './src/Card.stories.tsx': 1,
            './src/Page.stories.tsx': 2,
          },
        },
      });

      const result = runtime.queries.getStoriesForFiles({
        files: ['/repo/src/Button.tsx', '/repo/src/Unknown.tsx', '/repo/src/Card.tsx'],
      });

      expect(result).toEqual([
        [{ storyFile: './src/Button.stories.tsx', depth: 1 }],
        [],
        [
          { storyFile: './src/Card.stories.tsx', depth: 1 },
          { storyFile: './src/Page.stories.tsx', depth: 2 },
        ],
      ]);
    });

    it('accepts absolute, relative-with-dot, and relative-without-dot input paths', async () => {
      const runtime = registerBareModuleGraph();
      await runtime.commands.applyGraphSnapshot({
        storiesByFile: { './src/Button.tsx': { './src/Button.stories.tsx': 1 } },
      });

      expect(
        runtime.queries.getStoriesForFiles({
          files: ['/repo/src/../src/Button.tsx', './src/Button.tsx', 'src/Button.tsx'],
        })
      ).toEqual([
        [{ storyFile: './src/Button.stories.tsx', depth: 1 }],
        [{ storyFile: './src/Button.stories.tsx', depth: 1 }],
        [{ storyFile: './src/Button.stories.tsx', depth: 1 }],
      ]);
    });

    it('accepts Windows-style absolute and relative input paths', async () => {
      const runtime = registerBareModuleGraph('C:\\repo');
      await runtime.commands.applyGraphSnapshot({
        storiesByFile: { './src/Button.tsx': { './src/Button.stories.tsx': 1 } },
      });

      expect(
        runtime.queries.getStoriesForFiles({
          files: ['C:\\repo\\src\\Button.tsx', '.\\src\\Button.tsx', 'src\\Button.tsx'],
        })
      ).toEqual([
        [{ storyFile: './src/Button.stories.tsx', depth: 1 }],
        [{ storyFile: './src/Button.stories.tsx', depth: 1 }],
        [{ storyFile: './src/Button.stories.tsx', depth: 1 }],
      ]);
    });

    it('returns an empty array for an empty input list', () => {
      const runtime = registerBareModuleGraph();
      expect(runtime.queries.getStoriesForFiles({ files: [] })).toEqual([]);
    });
  });

  describe('applyGraphUpdate command', () => {
    it('replaces the reverse index, bumps the revision, and increments affected story versions', async () => {
      const runtime = registerBareModuleGraph();
      await runtime.commands.applyGraphSnapshot({
        storiesByFile: { './src/Button.tsx': { './src/Button.stories.tsx': 1 } },
      });

      await runtime.commands.applyGraphUpdate({
        storiesByFile: {
          './src/Button.tsx': { './src/Button.stories.tsx': 1 },
          './src/Icon.tsx': { './src/Button.stories.tsx': 2 },
        },
        bumpedStoryFiles: ['./src/Button.stories.tsx'],
      });

      expect(runtime.queries.getGraphRevision(undefined)).toBe(2);
      expect(runtime.queries.getStoryVersion({ storyFile: '/repo/src/Button.stories.tsx' })).toBe(
        1
      );
      expect(runtime.queries.getStoriesForFiles({ files: ['/repo/src/Icon.tsx'] })).toEqual([
        [{ storyFile: './src/Button.stories.tsx', depth: 2 }],
      ]);
    });

    it('accumulates story versions across multiple updates', async () => {
      const runtime = registerBareModuleGraph();

      await runtime.commands.applyGraphUpdate({
        storiesByFile: {},
        bumpedStoryFiles: ['./a.stories.tsx', './b.stories.tsx'],
      });
      await runtime.commands.applyGraphUpdate({
        storiesByFile: {},
        bumpedStoryFiles: ['./a.stories.tsx'],
      });

      expect(runtime.queries.getAllStoryVersions(undefined)).toEqual({
        './a.stories.tsx': 2,
        './b.stories.tsx': 1,
      });
      expect(runtime.queries.getGraphRevision(undefined)).toBe(2);
    });

    it('bumps the revision even when no story files are listed', async () => {
      const runtime = registerBareModuleGraph();

      await runtime.commands.applyGraphUpdate({ storiesByFile: {}, bumpedStoryFiles: [] });

      expect(runtime.queries.getGraphRevision(undefined)).toBe(1);
      expect(runtime.queries.getAllStoryVersions(undefined)).toEqual({});
    });
  });

  describe('getStoryVersion query', () => {
    it('returns 0 for an unknown story file and normalizes its input', async () => {
      const runtime = registerBareModuleGraph();
      await runtime.commands.applyGraphUpdate({
        storiesByFile: {},
        bumpedStoryFiles: ['./src/Button.stories.tsx'],
      });

      expect(runtime.queries.getStoryVersion({ storyFile: '/repo/src/Unknown.stories.tsx' })).toBe(
        0
      );
      expect(
        runtime.queries.getStoryVersion({ storyFile: '/repo/src/../src/Button.stories.tsx' })
      ).toBe(1);
    });
  });

  describe('getGraphRevision subscription', () => {
    it('notifies subscribers when the graph changes', async () => {
      const runtime = registerBareModuleGraph();
      const seen: number[] = [];
      runtime.queries.getGraphRevision.subscribe(undefined, (revision) => {
        seen.push(revision);
      });

      await runtime.commands.applyGraphSnapshot({ storiesByFile: {} });
      await runtime.commands.applyGraphUpdate({ storiesByFile: {}, bumpedStoryFiles: [] });

      // The latest emitted revision reflects both writes.
      expect(seen.at(-1)).toBe(2);
    });
  });

  describe('registerModuleGraphService wiring', () => {
    it('subscribes to STORY_INDEX_INVALIDATED on the provided channel', () => {
      const channel = { on: vi.fn(() => () => undefined), emit: vi.fn() };

      const runtime = registerModuleGraphService({
        channel: channel as never,
        getIndex: vi.fn().mockResolvedValue({ v: 5, entries: {} }),
        workingDir: '/repo',
      });

      expect(channel.on).toHaveBeenCalledWith(STORY_INDEX_INVALIDATED, expect.any(Function));
      expect(runtime.queries.getReady(undefined)).toBe(false);
    });

    // Must run last: it resolves the process-global adapter promise, which cannot be un-resolved.
    it('builds the graph once the adapter is provided and mirrors it into service state', async () => {
      const reverseIndex = buildReverseIndex([
        ['/repo/src/Button.tsx', '/repo/src/Button.stories.tsx', 1],
      ]);
      installDependencyGraphMocks(reverseIndex);

      const channel = { on: vi.fn(() => () => undefined), emit: vi.fn() };
      const { adapter } = createMockAdapter({ resolveConfig: { projectRoot: '/repo' } });

      const runtime = registerModuleGraphService({
        channel: channel as never,
        getIndex: vi.fn().mockResolvedValue({ v: 5, entries: {} }),
        workingDir: '/repo',
      });

      expect(runtime.queries.getReady(undefined)).toBe(false);

      resolveChangeDetectionAdapter(adapter);

      await vi.waitFor(() => {
        expect(runtime.queries.getReady(undefined)).toBe(true);
      });

      expect(runtime.queries.getStoriesForFiles({ files: ['/repo/src/Button.tsx'] })).toEqual([
        [{ storyFile: './src/Button.stories.tsx', depth: 1 }],
      ]);
    });
  });
});
