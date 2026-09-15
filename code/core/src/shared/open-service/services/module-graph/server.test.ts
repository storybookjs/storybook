import { afterEach, describe, expect, it, vi } from 'vitest';

import { STORY_INDEX_INVALIDATED } from 'storybook/internal/core-events';

import { createTestChannel, installTestChannel } from '../../../../channels/test-channel.ts';
import { SERVICE_PATCHES } from '../../service-channel.ts';
import { getService } from '../../service-registry.ts';
import { clearRegistry } from '../../server.ts';
import type { ModuleGraphIndexService } from '../module-graph-index/definition.ts';
import {
  buildReverseIndex,
  createDeferred,
  createMockAdapter,
  createStoryIndex,
  installDependencyGraphMocks,
  registerTestModuleGraphService,
} from './module-graph.test-helpers.ts';
import {
  registerModuleGraphService,
  resetChangeDetectionAdapterForTests,
  resolveChangeDetectionAdapter,
} from './server.ts';
import type { StoriesByFileRecord } from './types.ts';

vi.mock('./engine/dependency-graph/resolver-factory.ts', { spy: true });
vi.mock('./engine/dependency-graph/dependency-graph-builder.ts', { spy: true });
vi.mock('./engine/dependency-graph/incremental-patcher.ts', { spy: true });

afterEach(() => {
  clearRegistry();
  resetChangeDetectionAdapterForTests();
  vi.restoreAllMocks();
});

/** Bare service registration (no engine), for exercising the query/command contract directly. */
function registerBareModuleGraph(workingDir = '/repo') {
  return registerTestModuleGraphService(workingDir);
}

function moduleGraphIndex() {
  return getService<ModuleGraphIndexService>('core/module-graph-index', { internal: true });
}

async function applyIndex(storiesByFile: StoriesByFileRecord) {
  await moduleGraphIndex().commands._applyIndex({ storiesByFile });
}

describe('module-graph open service', () => {
  describe('initial state', () => {
    it('starts not-ready with empty indexes and zeroed counters', () => {
      const runtime = registerBareModuleGraph();

      expect(runtime.queries.status.get(undefined)).toEqual({ value: 'booting' });
      expect(runtime.queries.graphRevision.get(undefined)).toBe(0);
      expect(runtime.queries.latestStoryChanges.get(undefined)).toEqual({
        revision: 0,
        storyFiles: [],
      });
      expect(
        moduleGraphIndex().queries.storiesForFiles.get({ files: ['/repo/src/Button.tsx'] })
      ).toEqual([[]]);
    });
  });

  describe('_applyGraphSnapshot command', () => {
    it('marks the service ready and stores the reverse index without advancing the revision', async () => {
      const runtime = registerBareModuleGraph();

      await runtime.commands._applyGraphSnapshot({
        storiesByFile: {
          './src/Button.tsx': { './src/Button.stories.tsx': 1 },
        },
      });

      expect(runtime.queries.status.get(undefined)).toEqual({ value: 'ready' });
      // The snapshot is the baseline, not a change, so the revision stays at 0.
      expect(runtime.queries.graphRevision.get(undefined)).toBe(0);
      expect(runtime.queries.latestStoryChanges.get(undefined)).toEqual({
        revision: 0,
        storyFiles: [],
      });
      expect(
        moduleGraphIndex().queries.storiesForFiles.get({ files: ['/repo/src/Button.tsx'] })
      ).toEqual([[{ storyFile: './src/Button.stories.tsx', depth: 1 }]]);
    });

    it('seeds every known story to revision 0 for scoped reads', async () => {
      const runtime = registerBareModuleGraph();

      await runtime.commands._applyGraphSnapshot({
        storiesByFile: {
          './src/Button.tsx': { './src/Button.stories.tsx': 1 },
          './src/Card.tsx': { './src/Card.stories.tsx': 1 },
        },
      });

      expect(runtime.queries.graphRevision.get({ storyFiles: ['./src/Button.stories.tsx'] })).toBe(
        0
      );
      expect(runtime.queries.graphRevision.get({ storyFiles: ['./src/Card.stories.tsx'] })).toBe(0);
    });

    it('replaces (not merges) the reverse index on a subsequent snapshot', async () => {
      const runtime = registerBareModuleGraph();

      await runtime.commands._applyGraphSnapshot({
        storiesByFile: { './src/A.tsx': { './src/A.stories.tsx': 0 } },
      });
      await runtime.commands._applyGraphSnapshot({
        storiesByFile: { './src/B.tsx': { './src/B.stories.tsx': 0 } },
      });

      expect(
        moduleGraphIndex().queries.storiesForFiles.get({ files: ['/repo/src/A.tsx'] })
      ).toEqual([[]]);
      expect(
        moduleGraphIndex().queries.storiesForFiles.get({ files: ['/repo/src/B.tsx'] })
      ).toEqual([[{ storyFile: './src/B.stories.tsx', depth: 0 }]]);
      expect(runtime.queries.graphRevision.get(undefined)).toBe(0);
    });
  });

  describe('status commands', () => {
    it('marks the graph failed with a serializable error', async () => {
      const runtime = registerBareModuleGraph();

      await runtime.commands._setStatus({
        value: 'error',
        error: { message: 'graph build blew up', name: 'ModuleGraphFailureError' },
      });

      expect(runtime.queries.status.get(undefined)).toEqual({
        value: 'error',
        error: { message: 'graph build blew up', name: 'ModuleGraphFailureError' },
      });
    });

    it('marks the graph unavailable with a reason and optional error', async () => {
      const runtime = registerBareModuleGraph();

      await runtime.commands._setStatus({
        value: 'unavailable',
        reason: 'builder does not support change detection',
        error: { message: 'adapter missing' },
      });

      expect(runtime.queries.status.get(undefined)).toEqual({
        value: 'unavailable',
        reason: 'builder does not support change detection',
        error: { message: 'adapter missing' },
      });
    });
  });

  describe('storiesForFiles query', () => {
    it('returns one result array per input file, positionally', async () => {
      const runtime = registerBareModuleGraph();
      await runtime.commands._applyGraphSnapshot({
        storiesByFile: {
          './src/Button.tsx': { './src/Button.stories.tsx': 1 },
          './src/Card.tsx': {
            './src/Card.stories.tsx': 1,
            './src/Page.stories.tsx': 2,
          },
        },
      });

      const result = moduleGraphIndex().queries.storiesForFiles.get({
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
      await runtime.commands._applyGraphSnapshot({
        storiesByFile: { './src/Button.tsx': { './src/Button.stories.tsx': 1 } },
      });

      expect(
        moduleGraphIndex().queries.storiesForFiles.get({
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
      await runtime.commands._applyGraphSnapshot({
        storiesByFile: { './src/Button.tsx': { './src/Button.stories.tsx': 1 } },
      });

      expect(
        moduleGraphIndex().queries.storiesForFiles.get({
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
      expect(moduleGraphIndex().queries.storiesForFiles.get({ files: [] })).toEqual([]);
    });
  });

  describe('_applyGraphUpdate command', () => {
    it('bumps the revision and records latest changed stories after an index apply', async () => {
      const runtime = registerBareModuleGraph();
      await runtime.commands._applyGraphSnapshot({
        storiesByFile: { './src/Button.tsx': { './src/Button.stories.tsx': 1 } },
      });

      await applyIndex({
        './src/Button.tsx': { './src/Button.stories.tsx': 1 },
        './src/Icon.tsx': { './src/Button.stories.tsx': 2 },
      });
      await runtime.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./src/Button.stories.tsx'],
      });

      // Snapshot left the revision at 0; this is the first real change.
      expect(runtime.queries.graphRevision.get(undefined)).toBe(1);
      expect(runtime.queries.latestStoryChanges.get(undefined)).toEqual({
        revision: 1,
        storyFiles: ['./src/Button.stories.tsx'],
      });
      expect(
        moduleGraphIndex().queries.storiesForFiles.get({ files: ['/repo/src/Icon.tsx'] })
      ).toEqual([[{ storyFile: './src/Button.stories.tsx', depth: 2 }]]);
    });

    it('stamps each bumped story with the new revision and leaves untouched stories at 0', async () => {
      const runtime = registerBareModuleGraph();
      await runtime.commands._applyGraphSnapshot({
        storiesByFile: {
          './src/Button.tsx': { './src/Button.stories.tsx': 1 },
          './src/Card.tsx': { './src/Card.stories.tsx': 1 },
        },
      });

      await runtime.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./src/Button.stories.tsx'],
      });

      expect(runtime.queries.graphRevision.get({ storyFiles: ['./src/Button.stories.tsx'] })).toBe(
        1
      );
      // Card was not bumped, so its scoped revision stays at the seeded 0.
      expect(runtime.queries.graphRevision.get({ storyFiles: ['./src/Card.stories.tsx'] })).toBe(0);
    });

    it('replaces latest story changes with the newest revision payload', async () => {
      const runtime = registerBareModuleGraph();

      await runtime.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./a.stories.tsx', './b.stories.tsx'],
      });
      await runtime.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./a.stories.tsx'],
      });

      expect(runtime.queries.latestStoryChanges.get(undefined)).toEqual({
        revision: 2,
        storyFiles: ['./a.stories.tsx'],
      });
      expect(runtime.queries.graphRevision.get(undefined)).toBe(2);
    });

    it('advances file activity but not graph revision for an out-of-graph change', async () => {
      const runtime = registerBareModuleGraph();
      await runtime.commands._applyGraphSnapshot({
        storiesByFile: { './src/Button.tsx': { './src/Button.stories.tsx': 1 } },
      });

      await applyIndex({ './src/Button.tsx': { './src/Button.stories.tsx': 1 } });
      await runtime.commands._applyGraphUpdate({
        bumpedStoryFiles: [],
      });

      expect(runtime.queries.graphRevision.get(undefined)).toBe(0);
      expect(runtime.queries.fileActivityRevision.get(undefined)).toBe(1);
      expect(runtime.queries.latestStoryChanges.get(undefined)).toEqual({
        revision: 0,
        storyFiles: [],
      });
    });

    it('keeps the stored index when a bump-only update runs', async () => {
      const runtime = registerBareModuleGraph();
      await runtime.commands._applyGraphSnapshot({
        storiesByFile: { './src/Button.tsx': { './src/Button.stories.tsx': 1 } },
      });

      // A comment-only edit re-walks nothing, so the engine bumps without rewriting the index.
      await runtime.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./src/Button.stories.tsx'],
      });

      expect(
        moduleGraphIndex().queries.storiesForFiles.get({ files: ['./src/Button.tsx'] })
      ).toEqual([[{ storyFile: './src/Button.stories.tsx', depth: 1 }]]);
      expect(runtime.queries.graphRevision.get(undefined)).toBe(1);
      expect(runtime.queries.latestStoryChanges.get(undefined)).toEqual({
        revision: 1,
        storyFiles: ['./src/Button.stories.tsx'],
      });
    });
  });

  describe('latestStoryChanges query', () => {
    it('returns the current graph revision paired with the latest bumped story files', async () => {
      const runtime = registerBareModuleGraph();

      expect(runtime.queries.latestStoryChanges.get(undefined)).toEqual({
        revision: 0,
        storyFiles: [],
      });

      await runtime.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./src/Button.stories.tsx', './src/Card.stories.tsx'],
      });

      expect(runtime.queries.latestStoryChanges.get(undefined)).toEqual({
        revision: 1,
        storyFiles: ['./src/Button.stories.tsx', './src/Card.stories.tsx'],
      });
    });

    it('replaces the previous change set when a newer update bumps different stories', async () => {
      const runtime = registerBareModuleGraph();

      await runtime.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./a.stories.tsx', './b.stories.tsx'],
      });
      await runtime.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./c.stories.tsx'],
      });

      expect(runtime.queries.latestStoryChanges.get(undefined)).toEqual({
        revision: 2,
        storyFiles: ['./c.stories.tsx'],
      });
    });

    it('preserves the prior change set when an update bumps no stories', async () => {
      const runtime = registerBareModuleGraph();

      await runtime.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./src/Button.stories.tsx'],
      });
      await applyIndex({ './src/Button.tsx': { './src/Button.stories.tsx': 1 } });
      await runtime.commands._applyGraphUpdate({
        bumpedStoryFiles: [],
      });

      expect(runtime.queries.latestStoryChanges.get(undefined)).toEqual({
        revision: 1,
        storyFiles: ['./src/Button.stories.tsx'],
      });
    });

    it('clears story files after a snapshot without resetting the graph revision', async () => {
      const runtime = registerBareModuleGraph();

      await runtime.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./src/Button.stories.tsx'],
      });
      await runtime.commands._applyGraphSnapshot({
        storiesByFile: { './src/Button.tsx': { './src/Button.stories.tsx': 1 } },
      });

      expect(runtime.queries.latestStoryChanges.get(undefined)).toEqual({
        revision: 1,
        storyFiles: [],
      });
    });

    it('notifies subscribers when the latest change set updates', async () => {
      const runtime = registerBareModuleGraph();
      const seen: Array<{ revision: number; storyFiles: string[] }> = [];
      runtime.queries.latestStoryChanges.subscribe(undefined, ({ data }) => {
        if (data) {
          seen.push(data);
        }
      });

      await runtime.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./a.stories.tsx'],
      });
      await runtime.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./b.stories.tsx'],
      });

      expect(seen.at(-1)).toEqual({
        revision: 2,
        storyFiles: ['./b.stories.tsx'],
      });
    });
  });

  describe('graphRevision query scopes', () => {
    it('returns 0 for an empty watch list and ignores unknown stories', async () => {
      const runtime = registerBareModuleGraph();
      await runtime.commands._applyGraphSnapshot({
        storiesByFile: { './src/Button.tsx': { './src/Button.stories.tsx': 1 } },
      });
      await runtime.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./src/Button.stories.tsx'],
      });

      // Watch-all sees the bump.
      expect(runtime.queries.graphRevision.get(undefined)).toBe(1);
      // Watch nothing.
      expect(runtime.queries.graphRevision.get({ storyFiles: [] })).toBe(0);
      // Unknown story contributes 0.
      expect(runtime.queries.graphRevision.get({ storyFiles: ['./src/Unknown.stories.tsx'] })).toBe(
        0
      );
    });

    it('accepts absolute and relative scope paths', async () => {
      const runtime = registerBareModuleGraph();
      await runtime.commands._applyGraphSnapshot({
        storiesByFile: { './src/Button.tsx': { './src/Button.stories.tsx': 1 } },
      });
      await runtime.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./src/Button.stories.tsx'],
      });

      // The query handler normalizes scope paths against the service workingDir.
      expect(
        runtime.queries.graphRevision.get({
          storyFiles: ['/repo/src/Button.stories.tsx'],
        })
      ).toBe(1);
      expect(runtime.queries.graphRevision.get({ storyFiles: ['src/Button.stories.tsx'] })).toBe(1);
    });
  });

  describe('graphRevision subscription', () => {
    it('notifies subscribers when the graph changes', async () => {
      const runtime = registerBareModuleGraph();
      const seen: number[] = [];
      runtime.queries.graphRevision.subscribe(undefined, ({ data }) => {
        if (data !== undefined) {
          seen.push(data);
        }
      });

      await runtime.commands._applyGraphSnapshot({ storiesByFile: {} });
      await runtime.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./a.stories.tsx'],
      });

      // The snapshot is a no-op for the revision; the update advances it to 1.
      expect(seen.at(-1)).toBe(1);
    });

    it('notifies a scoped subscriber only when its story is bumped', async () => {
      const runtime = registerBareModuleGraph();
      await runtime.commands._applyGraphSnapshot({
        storiesByFile: {
          './src/Button.tsx': { './src/Button.stories.tsx': 1 },
          './src/Card.tsx': { './src/Card.stories.tsx': 1 },
        },
      });

      const seen: number[] = [];
      runtime.queries.graphRevision.subscribe(
        { storyFiles: ['./src/Button.stories.tsx'] },
        ({ data }) => {
          if (data !== undefined) {
            seen.push(data);
          }
        }
      );

      // Bump an unrelated story: the Button-scoped subscriber must not advance.
      await runtime.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./src/Card.stories.tsx'],
      });
      // Now bump Button itself.
      await runtime.commands._applyGraphUpdate({
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
      expect(runtime.queries.status.get(undefined)).toEqual({ value: 'booting' });
    });

    it('starts the engine from getAdapter on the first status.loaded', async () => {
      const reverseIndex = buildReverseIndex([
        ['/repo/src/Button.tsx', '/repo/src/Button.stories.tsx', 1],
      ]);
      installDependencyGraphMocks(reverseIndex);
      const { adapter } = createMockAdapter({ resolveConfig: { projectRoot: '/repo' } });
      const getAdapter = vi.fn(async () => adapter);

      const runtime = registerModuleGraphService({
        channel: { on: vi.fn(() => () => undefined), emit: vi.fn() } as never,
        getIndex: vi.fn().mockResolvedValue(
          createStoryIndex([
            {
              storyId: 'button--primary',
              importPath: './src/Button.stories.tsx',
              title: 'Button',
            },
          ])
        ),
        workingDir: '/repo',
        getAdapter,
      });

      expect(getAdapter).not.toHaveBeenCalled();
      expect(await runtime.queries.status.loaded(undefined)).toEqual({ value: 'ready' });
      expect(getAdapter).toHaveBeenCalledTimes(1);
      expect(
        moduleGraphIndex().queries.storiesForFiles.get({ files: ['/repo/src/Button.tsx'] })
      ).toEqual([[{ storyFile: './src/Button.stories.tsx', depth: 1 }]]);
    });

    it('does not call getAdapter when the host already resolved the adapter', async () => {
      const reverseIndex = buildReverseIndex([
        ['/repo/src/Button.tsx', '/repo/src/Button.stories.tsx', 1],
      ]);
      installDependencyGraphMocks(reverseIndex);
      const { adapter } = createMockAdapter({ resolveConfig: { projectRoot: '/repo' } });
      const getAdapter = vi.fn(async () => adapter);

      const runtime = registerModuleGraphService({
        channel: { on: vi.fn(() => () => undefined), emit: vi.fn() } as never,
        getIndex: vi.fn().mockResolvedValue(
          createStoryIndex([
            {
              storyId: 'button--primary',
              importPath: './src/Button.stories.tsx',
              title: 'Button',
            },
          ])
        ),
        workingDir: '/repo',
        getAdapter,
      });

      resolveChangeDetectionAdapter(adapter);
      await vi.waitFor(() => {
        expect(runtime.queries.status.get(undefined)).toEqual({ value: 'ready' });
      });
      expect(getAdapter).not.toHaveBeenCalled();

      await runtime.queries.status.loaded(undefined);
      expect(getAdapter).not.toHaveBeenCalled();
    });

    it('calls getAdapter once when two settle waits overlap', async () => {
      const reverseIndex = buildReverseIndex([
        ['/repo/src/Button.tsx', '/repo/src/Button.stories.tsx', 1],
      ]);
      installDependencyGraphMocks(reverseIndex);
      const { adapter } = createMockAdapter({ resolveConfig: { projectRoot: '/repo' } });
      const adapterHandle = createDeferred<typeof adapter>();
      const getAdapter = vi.fn(() => adapterHandle.promise);

      const runtime = registerModuleGraphService({
        channel: { on: vi.fn(() => () => undefined), emit: vi.fn() } as never,
        getIndex: vi.fn().mockResolvedValue(
          createStoryIndex([
            {
              storyId: 'button--primary',
              importPath: './src/Button.stories.tsx',
              title: 'Button',
            },
          ])
        ),
        workingDir: '/repo',
        getAdapter,
      });

      const first = runtime.commands._waitForSettledEngine(undefined);
      const second = runtime.commands._waitForSettledEngine(undefined);
      adapterHandle.resolve(adapter);
      await Promise.all([first, second]);

      expect(getAdapter).toHaveBeenCalledTimes(1);
      expect(runtime.queries.status.get(undefined)).toEqual({ value: 'ready' });
    });

    it('returns serialized change-detection readiness from the injected getter', async () => {
      const getChangeDetectionReadiness = vi.fn(async () => ({
        status: 'unavailable' as const,
        reason: 'disabled',
      }));

      const runtime = registerModuleGraphService({
        channel: { on: vi.fn(() => () => undefined), emit: vi.fn() } as never,
        getIndex: vi.fn().mockResolvedValue({ v: 5, entries: {} }),
        workingDir: '/repo',
        getChangeDetectionReadiness,
      });

      await expect(runtime.commands._waitForChangeDetectionReadiness(undefined)).resolves.toEqual({
        status: 'unavailable',
        reason: 'disabled',
      });
      expect(runtime.queries.changeDetectionReadiness.get(undefined)).toEqual({
        status: 'unavailable',
        reason: 'disabled',
      });
      expect(getChangeDetectionReadiness).toHaveBeenCalledOnce();
    });

    it('forwards an optional error on unavailable change-detection readiness', async () => {
      const runtime = registerModuleGraphService({
        channel: { on: vi.fn(() => () => undefined), emit: vi.fn() } as never,
        getIndex: vi.fn().mockResolvedValue({ v: 5, entries: {} }),
        workingDir: '/repo',
        getChangeDetectionReadiness: async () => ({
          status: 'unavailable' as const,
          reason: 'vite warmup failed',
          error: new Error('warmup failed'),
        }),
      });

      await expect(runtime.commands._waitForChangeDetectionReadiness(undefined)).resolves.toEqual({
        status: 'unavailable',
        reason: 'vite warmup failed',
        error: { message: 'warmup failed' },
      });
      expect(runtime.queries.changeDetectionReadiness.get(undefined)).toEqual({
        status: 'unavailable',
        reason: 'vite warmup failed',
        error: { message: 'warmup failed' },
      });
    });

    it('loads change-detection readiness through the query load hook', async () => {
      const runtime = registerModuleGraphService({
        channel: { on: vi.fn(() => () => undefined), emit: vi.fn() } as never,
        getIndex: vi.fn().mockResolvedValue({ v: 5, entries: {} }),
        workingDir: '/repo',
        getChangeDetectionReadiness: async () => ({ status: 'ready' as const }),
      });

      expect(runtime.queries.changeDetectionReadiness.get(undefined)).toEqual({
        status: 'pending',
      });
      await expect(runtime.queries.changeDetectionReadiness.loaded(undefined)).resolves.toEqual({
        status: 'ready',
      });
    });

    it('serializes a change-detection error readiness result', async () => {
      const runtime = registerModuleGraphService({
        channel: { on: vi.fn(() => () => undefined), emit: vi.fn() } as never,
        getIndex: vi.fn().mockResolvedValue({ v: 5, entries: {} }),
        workingDir: '/repo',
        getChangeDetectionReadiness: async () => ({
          status: 'error',
          error: { message: 'scan blew up' },
        }),
      });

      await expect(runtime.commands._waitForChangeDetectionReadiness(undefined)).resolves.toEqual({
        status: 'error',
        error: { message: 'scan blew up' },
      });
    });

    it('settles the graph as unavailable when getAdapter rejects', async () => {
      const getAdapter = vi.fn(async () => {
        throw new Error('preview builder missing');
      });

      const runtime = registerModuleGraphService({
        channel: { on: vi.fn(() => () => undefined), emit: vi.fn() } as never,
        getIndex: vi.fn().mockResolvedValue({ v: 5, entries: {} }),
        workingDir: '/repo',
        getAdapter,
      });

      await expect(runtime.queries.status.loaded(undefined)).resolves.toEqual({
        value: 'unavailable',
        reason: 'builder does not support change detection',
      });
      await expect(runtime.queries.status.loaded(undefined)).resolves.toEqual({
        value: 'unavailable',
        reason: 'builder does not support change detection',
      });
      expect(getAdapter).toHaveBeenCalledTimes(1);
    });

    it('builds the graph from the adapter and turns index invalidations into targeted updates', async () => {
      const reverseIndex = buildReverseIndex([
        ['/repo/src/Button.tsx', '/repo/src/Button.stories.tsx', 1],
      ]);
      installDependencyGraphMocks(reverseIndex);

      const baselineIndex = createStoryIndex([
        { storyId: 'button--primary', importPath: './src/Button.stories.tsx', title: 'Button' },
      ]);
      const indexWithCard = createStoryIndex([
        { storyId: 'button--primary', importPath: './src/Button.stories.tsx', title: 'Button' },
        { storyId: 'card--primary', importPath: './src/Card.stories.tsx', title: 'Card' },
      ]);
      // Build reads the baseline; the first invalidation re-reads it unchanged, the second adds Card.
      const getIndex = vi
        .fn()
        .mockResolvedValueOnce(baselineIndex)
        .mockResolvedValueOnce(baselineIndex)
        .mockResolvedValue(indexWithCard);

      const on = vi.fn<(event: string, listener: () => void) => () => void>(() => () => undefined);
      const channel = { on, emit: vi.fn() };
      const { adapter } = createMockAdapter({ resolveConfig: { projectRoot: '/repo' } });

      const runtime = registerModuleGraphService({
        channel: channel as never,
        getIndex,
        workingDir: '/repo',
      });

      expect(runtime.queries.status.get(undefined)).toEqual({ value: 'booting' });

      resolveChangeDetectionAdapter(adapter);

      await vi.waitFor(() => {
        expect(runtime.queries.status.get(undefined)).toEqual({ value: 'ready' });
      });

      expect(
        moduleGraphIndex().queries.storiesForFiles.get({ files: ['/repo/src/Button.tsx'] })
      ).toEqual([[{ storyFile: './src/Button.stories.tsx', depth: 1 }]]);

      const invalidate = channel.on.mock.calls.find(
        ([event]) => event === STORY_INDEX_INVALIDATED
      )?.[1];
      expect(invalidate).toBeTypeOf('function');

      // An invalidation that does not change the story set must not advance the revision on its own
      // (no untargeted bump, no clobbered change set).
      invalidate!();
      await runtime.commands._waitForSettledEngine(undefined);
      expect(runtime.queries.graphRevision.get(undefined)).toBe(0);
      expect(runtime.queries.latestStoryChanges.get(undefined)).toEqual({
        revision: 0,
        storyFiles: [],
      });

      // A newly-indexed story is reconciled and reported as a targeted change.
      invalidate!();
      await vi.waitFor(() => {
        expect(runtime.queries.latestStoryChanges.get(undefined)).toEqual({
          revision: 1,
          storyFiles: ['./src/Card.stories.tsx'],
        });
      });
    });
  });

  describe('hot/cold split sync', () => {
    afterEach(() => {
      installTestChannel(null);
    });

    // Many edges, few stories: cold index is large; hot revisions stay small.
    function fatIndexFixture() {
      const storyFiles = Array.from({ length: 20 }, (_, j) => `./src/story-${j}.stories.ts`);
      const fatIndex = Object.fromEntries(
        Array.from({ length: 400 }, (_, i) => [
          `./src/file-${i}.ts`,
          Object.fromEntries(storyFiles.map((storyFile) => [storyFile, 1])),
        ])
      );
      return { storyFiles, fatIndex, fatIndexBytes: JSON.stringify(fatIndex).length };
    }

    function servicePatches(channel: ReturnType<typeof createTestChannel>) {
      return channel.emit.mock.calls
        .filter(([event]) => event === SERVICE_PATCHES)
        .map(([, payload]) => payload as { serviceId: string; state: Record<string, unknown> });
    }

    it('broadcasts only the slim hot snapshot on a bump-only update', async () => {
      const channel = createTestChannel();
      installTestChannel(channel);
      const { storyFiles, fatIndex, fatIndexBytes } = fatIndexFixture();

      const runtime = registerBareModuleGraph();
      await runtime.commands._applyGraphSnapshot({ storiesByFile: fatIndex });
      channel.emit.mockClear();

      await runtime.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./src/story-0.stories.ts'],
      });

      const patches = servicePatches(channel);
      expect(patches.map((p) => p.serviceId)).toEqual(['core/module-graph']);
      expect(patches[0].state).not.toHaveProperty('storiesByFile');
      expect(JSON.stringify(patches[0].state).length).toBeLessThan(fatIndexBytes / 20);
      expect(runtime.queries.graphRevision.get(undefined)).toBe(1);
      expect(
        moduleGraphIndex().queries.storiesForFiles.get({ files: ['./src/file-0.ts'] })
      ).toEqual([storyFiles.map((storyFile) => ({ storyFile, depth: 1 }))]);
    });

    it('broadcasts the cold index before the hot bump when both apply', async () => {
      const channel = createTestChannel();
      installTestChannel(channel);
      const { fatIndex } = fatIndexFixture();

      const runtime = registerBareModuleGraph();
      await runtime.commands._applyGraphSnapshot({ storiesByFile: fatIndex });
      channel.emit.mockClear();

      const nextIndex = {
        ...fatIndex,
        './src/file-new.ts': { './src/story-0.stories.ts': 2 },
      };
      await applyIndex(nextIndex);
      await runtime.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./src/story-0.stories.ts'],
      });

      const patches = servicePatches(channel);
      expect(patches.map((p) => p.serviceId)).toEqual([
        'core/module-graph-index',
        'core/module-graph',
      ]);
      expect(patches[0].state).toHaveProperty('storiesByFile');
      expect(patches[0].state.storiesByFile).toEqual(nextIndex);
      expect(patches[1].state).not.toHaveProperty('storiesByFile');
      expect(
        moduleGraphIndex().queries.storiesForFiles.get({ files: ['./src/file-new.ts'] })
      ).toEqual([[{ storyFile: './src/story-0.stories.ts', depth: 2 }]]);
    });
  });
});
