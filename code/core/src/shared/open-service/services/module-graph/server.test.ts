import { afterEach, describe, expect, it, vi } from 'vitest';

import { STORY_INDEX_INVALIDATED } from 'storybook/internal/core-events';

import { clearRegistry, registerService } from '../../server.ts';
import { moduleGraphServiceDef } from './definition.ts';
import { resetModuleGraphWhenSettled } from './settlement.ts';
import {
  buildReverseIndex,
  createMockAdapter,
  installDependencyGraphMocks,
} from './module-graph.test-helpers.ts';
import { registerModuleGraphService, resolveChangeDetectionAdapter } from './server.ts';

vi.mock('./engine/dependency-graph/resolver-factory.ts', { spy: true });
vi.mock('./engine/dependency-graph/dependency-graph-builder.ts', { spy: true });
vi.mock('./engine/dependency-graph/incremental-patcher.ts', { spy: true });

afterEach(() => {
  clearRegistry();
  resetModuleGraphWhenSettled();
  vi.restoreAllMocks();
});

/** Bare service registration (no engine), for exercising the query/command contract directly. */
function registerBareModuleGraph(workingDir = '/repo') {
  return registerService({
    ...moduleGraphServiceDef,
    initialState: {
      ...moduleGraphServiceDef.initialState,
      workingDir,
    },
  });
}

describe('module-graph open service', () => {
  describe('initial state', () => {
    it('starts not-ready with empty indexes and zeroed counters', () => {
      const runtime = registerBareModuleGraph();

      expect(runtime.queries.getStatus(undefined)).toEqual({ value: 'booting' });
      expect(runtime.queries.getGraphRevision(undefined)).toBe(0);
      expect(runtime.queries.getLatestStoryChanges(undefined)).toEqual({
        revision: 0,
        storyFiles: [],
      });
      expect(runtime.queries.getStoriesForFiles({ files: ['/repo/src/Button.tsx'] })).toEqual([[]]);
    });
  });

  describe('applyGraphSnapshot command', () => {
    it('marks the service ready and stores the reverse index without advancing the revision', async () => {
      const runtime = registerBareModuleGraph();

      await runtime.commands.applyGraphSnapshot({
        storiesByFile: {
          './src/Button.tsx': { './src/Button.stories.tsx': 1 },
        },
      });

      expect(runtime.queries.getStatus(undefined)).toEqual({ value: 'ready' });
      // The snapshot is the baseline, not a change, so the revision stays at 0.
      expect(runtime.queries.getGraphRevision(undefined)).toBe(0);
      expect(runtime.queries.getLatestStoryChanges(undefined)).toEqual({
        revision: 0,
        storyFiles: [],
      });
      expect(runtime.queries.getStoriesForFiles({ files: ['/repo/src/Button.tsx'] })).toEqual([
        [{ storyFile: './src/Button.stories.tsx', depth: 1 }],
      ]);
    });

    it('seeds every known story to revision 0 for scoped reads', async () => {
      const runtime = registerBareModuleGraph();

      await runtime.commands.applyGraphSnapshot({
        storiesByFile: {
          './src/Button.tsx': { './src/Button.stories.tsx': 1 },
          './src/Card.tsx': { './src/Card.stories.tsx': 1 },
        },
      });

      expect(runtime.queries.getGraphRevision({ storyFiles: ['./src/Button.stories.tsx'] })).toBe(
        0
      );
      expect(runtime.queries.getGraphRevision({ storyFiles: ['./src/Card.stories.tsx'] })).toBe(0);
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
      expect(runtime.queries.getGraphRevision(undefined)).toBe(0);
    });
  });

  describe('status commands', () => {
    it('marks the graph failed with a serializable error', async () => {
      const runtime = registerBareModuleGraph();

      await runtime.commands.setStatus({
        value: 'error',
        error: { message: 'graph build blew up', name: 'ModuleGraphFailureError' },
      });

      expect(runtime.queries.getStatus(undefined)).toEqual({
        value: 'error',
        error: { message: 'graph build blew up', name: 'ModuleGraphFailureError' },
      });
    });

    it('marks the graph unavailable with a reason and optional error', async () => {
      const runtime = registerBareModuleGraph();

      await runtime.commands.setStatus({
        value: 'unavailable',
        reason: 'builder does not support change detection',
        error: { message: 'adapter missing' },
      });

      expect(runtime.queries.getStatus(undefined)).toEqual({
        value: 'unavailable',
        reason: 'builder does not support change detection',
        error: { message: 'adapter missing' },
      });
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
    it('replaces the reverse index, bumps the revision, and records latest changed stories', async () => {
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

      // Snapshot left the revision at 0; this is the first real change.
      expect(runtime.queries.getGraphRevision(undefined)).toBe(1);
      expect(runtime.queries.getLatestStoryChanges(undefined)).toEqual({
        revision: 1,
        storyFiles: ['./src/Button.stories.tsx'],
      });
      expect(runtime.queries.getStoriesForFiles({ files: ['/repo/src/Icon.tsx'] })).toEqual([
        [{ storyFile: './src/Button.stories.tsx', depth: 2 }],
      ]);
    });

    it('stamps each bumped story with the new revision and leaves untouched stories at 0', async () => {
      const runtime = registerBareModuleGraph();
      await runtime.commands.applyGraphSnapshot({
        storiesByFile: {
          './src/Button.tsx': { './src/Button.stories.tsx': 1 },
          './src/Card.tsx': { './src/Card.stories.tsx': 1 },
        },
      });

      await runtime.commands.applyGraphUpdate({
        storiesByFile: {
          './src/Button.tsx': { './src/Button.stories.tsx': 1 },
          './src/Card.tsx': { './src/Card.stories.tsx': 1 },
        },
        bumpedStoryFiles: ['./src/Button.stories.tsx'],
      });

      expect(runtime.queries.getGraphRevision({ storyFiles: ['./src/Button.stories.tsx'] })).toBe(
        1
      );
      // Card was not bumped, so its scoped revision stays at the seeded 0.
      expect(runtime.queries.getGraphRevision({ storyFiles: ['./src/Card.stories.tsx'] })).toBe(0);
    });

    it('replaces latest story changes with the newest revision payload', async () => {
      const runtime = registerBareModuleGraph();

      await runtime.commands.applyGraphUpdate({
        storiesByFile: {},
        bumpedStoryFiles: ['./a.stories.tsx', './b.stories.tsx'],
      });
      await runtime.commands.applyGraphUpdate({
        storiesByFile: {},
        bumpedStoryFiles: ['./a.stories.tsx'],
      });

      expect(runtime.queries.getLatestStoryChanges(undefined)).toEqual({
        revision: 2,
        storyFiles: ['./a.stories.tsx'],
      });
      expect(runtime.queries.getGraphRevision(undefined)).toBe(2);
    });

    it('does not advance the revision for an out-of-graph change (no bumped stories)', async () => {
      const runtime = registerBareModuleGraph();
      await runtime.commands.applyGraphSnapshot({
        storiesByFile: { './src/Button.tsx': { './src/Button.stories.tsx': 1 } },
      });

      await runtime.commands.applyGraphUpdate({
        storiesByFile: { './src/Button.tsx': { './src/Button.stories.tsx': 1 } },
        bumpedStoryFiles: [],
      });

      expect(runtime.queries.getGraphRevision(undefined)).toBe(0);
      expect(runtime.queries.getLatestStoryChanges(undefined)).toEqual({
        revision: 0,
        storyFiles: [],
      });
    });
  });

  describe('getGraphRevision query scopes', () => {
    it('returns 0 for an empty watch list and ignores unknown stories', async () => {
      const runtime = registerBareModuleGraph();
      await runtime.commands.applyGraphSnapshot({
        storiesByFile: { './src/Button.tsx': { './src/Button.stories.tsx': 1 } },
      });
      await runtime.commands.applyGraphUpdate({
        storiesByFile: { './src/Button.tsx': { './src/Button.stories.tsx': 1 } },
        bumpedStoryFiles: ['./src/Button.stories.tsx'],
      });

      // Watch-all sees the bump.
      expect(runtime.queries.getGraphRevision(undefined)).toBe(1);
      // Watch nothing.
      expect(runtime.queries.getGraphRevision({ storyFiles: [] })).toBe(0);
      // Unknown story contributes 0.
      expect(runtime.queries.getGraphRevision({ storyFiles: ['./src/Unknown.stories.tsx'] })).toBe(
        0
      );
    });

    it('accepts absolute and relative scope paths', async () => {
      const runtime = registerBareModuleGraph();
      await runtime.commands.applyGraphSnapshot({
        storiesByFile: { './src/Button.tsx': { './src/Button.stories.tsx': 1 } },
      });
      await runtime.commands.applyGraphUpdate({
        storiesByFile: { './src/Button.tsx': { './src/Button.stories.tsx': 1 } },
        bumpedStoryFiles: ['./src/Button.stories.tsx'],
      });

      // The query handler normalizes scope paths against the service workingDir.
      expect(
        runtime.queries.getGraphRevision({
          storyFiles: ['/repo/src/Button.stories.tsx'],
        })
      ).toBe(1);
      expect(runtime.queries.getGraphRevision({ storyFiles: ['src/Button.stories.tsx'] })).toBe(1);
    });

    it('clears latest story changes when the revision bumps without a graph update', async () => {
      const runtime = registerBareModuleGraph();

      await runtime.commands.applyGraphUpdate({
        storiesByFile: {},
        bumpedStoryFiles: ['./src/Button.stories.tsx'],
      });
      await runtime.commands.bumpGraphRevision(undefined);

      expect(runtime.queries.getLatestStoryChanges(undefined)).toEqual({
        revision: 2,
        storyFiles: [],
      });
    });

    it('advances watch-all but not scoped reads on a bare revision bump', async () => {
      const runtime = registerBareModuleGraph();
      await runtime.commands.applyGraphSnapshot({
        storiesByFile: { './src/Button.tsx': { './src/Button.stories.tsx': 1 } },
      });

      await runtime.commands.bumpGraphRevision(undefined);

      // Index reconciliation advances the global (watch-all) revision...
      expect(runtime.queries.getGraphRevision(undefined)).toBe(1);
      // ...but is not attributed to any specific story.
      expect(runtime.queries.getGraphRevision({ storyFiles: ['./src/Button.stories.tsx'] })).toBe(
        0
      );
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
      await runtime.commands.applyGraphUpdate({
        storiesByFile: {},
        bumpedStoryFiles: ['./a.stories.tsx'],
      });

      // The snapshot is a no-op for the revision; the update advances it to 1.
      expect(seen.at(-1)).toBe(1);
    });

    it('notifies a scoped subscriber only when its story is bumped', async () => {
      const runtime = registerBareModuleGraph();
      await runtime.commands.applyGraphSnapshot({
        storiesByFile: {
          './src/Button.tsx': { './src/Button.stories.tsx': 1 },
          './src/Card.tsx': { './src/Card.stories.tsx': 1 },
        },
      });

      const seen: number[] = [];
      runtime.queries.getGraphRevision.subscribe(
        { storyFiles: ['./src/Button.stories.tsx'] },
        (revision) => {
          seen.push(revision);
        }
      );

      // Bump an unrelated story: the Button-scoped subscriber must not advance.
      await runtime.commands.applyGraphUpdate({
        storiesByFile: {
          './src/Button.tsx': { './src/Button.stories.tsx': 1 },
          './src/Card.tsx': { './src/Card.stories.tsx': 1 },
        },
        bumpedStoryFiles: ['./src/Card.stories.tsx'],
      });
      // Now bump Button itself.
      await runtime.commands.applyGraphUpdate({
        storiesByFile: {
          './src/Button.tsx': { './src/Button.stories.tsx': 1 },
          './src/Card.tsx': { './src/Card.stories.tsx': 1 },
        },
        bumpedStoryFiles: ['./src/Button.stories.tsx'],
      });

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
      expect(runtime.queries.getStatus(undefined)).toEqual({ value: 'booting' });
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

      expect(runtime.queries.getStatus(undefined)).toEqual({ value: 'booting' });

      resolveChangeDetectionAdapter(adapter);

      await vi.waitFor(() => {
        expect(runtime.queries.getStatus(undefined)).toEqual({ value: 'ready' });
      });

      expect(runtime.queries.getStoriesForFiles({ files: ['/repo/src/Button.tsx'] })).toEqual([
        [{ storyFile: './src/Button.stories.tsx', depth: 1 }],
      ]);
    });
  });
});
