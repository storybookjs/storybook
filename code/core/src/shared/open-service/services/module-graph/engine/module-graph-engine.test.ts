import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';
import type { StoryIndex } from 'storybook/internal/types';

import {
  buildReverseIndex,
  createDeferred,
  createMockAdapter,
  createStoryIndex,
  installDependencyGraphMocks,
} from '../module-graph.test-helpers.ts';
import { ModuleGraphFailureError } from '../errors.ts';
import { ModuleGraphEngine } from './module-graph-engine.ts';

vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('./dependency-graph/resolver-factory.ts', { spy: true });
vi.mock('./dependency-graph/dependency-graph-builder.ts', { spy: true });
vi.mock('./dependency-graph/incremental-patcher.ts', { spy: true });

const workingDir = '/repo';

function setup(options?: {
  storyIndex?: StoryIndex;
  getIndex?: () => Promise<StoryIndex>;
  withoutStartupFailure?: boolean;
}) {
  const callbacks = {
    onSnapshot: vi.fn(),
    onUpdate: vi.fn(),
    onStoryIndexInvalidated: vi.fn(),
    onError: vi.fn(),
    onUnavailable: vi.fn(),
  };
  const adapterHandle = createMockAdapter({
    withoutStartupFailure: options?.withoutStartupFailure,
  });
  const getIndex =
    options?.getIndex ?? vi.fn(async () => options?.storyIndex ?? createStoryIndex([]));

  const service = new ModuleGraphEngine({
    getIndex,
    workingDir,
    ...callbacks,
  });

  return { service, getIndex, callbacks, ...adapterHandle };
}

describe('ModuleGraphEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(logger.info).mockImplementation(() => undefined);
    vi.mocked(logger.warn).mockImplementation(() => undefined);
    vi.mocked(logger.error).mockImplementation(() => undefined);
    vi.mocked(logger.debug).mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('builds the graph, mirrors a snapshot, and exposes the reverse index via lookup', async () => {
    const reverseIndex = buildReverseIndex([
      ['/repo/src/Button.tsx', '/repo/src/Button.stories.tsx', 1],
    ]);
    installDependencyGraphMocks(reverseIndex);
    const storyIndex = createStoryIndex([
      { storyId: 'button--primary', importPath: './src/Button.stories.tsx', title: 'Button' },
    ]);
    const { service, callbacks, adapter } = setup({ storyIndex });

    expect(service.hasGraph()).toBe(false);

    service.start(adapter);
    await vi.runAllTimersAsync();

    expect(callbacks.onSnapshot).toHaveBeenCalledTimes(1);
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(service.hasGraph()).toBe(true);
    expect(service.lookup('/repo/src/Button.tsx')).toEqual(
      new Map([['/repo/src/Button.stories.tsx', 1]])
    );
    expect(service.lookup('/repo/src/Unknown.tsx')).toEqual(new Map());
  });

  it('serialises concurrent file-change events through the patch chain', async () => {
    const reverseIndex = buildReverseIndex([]);
    const { patchSpy, buildSpy } = installDependencyGraphMocks(reverseIndex);
    buildSpy.mockResolvedValue({ reverseIndex, graph: new Map() });

    let activePatches = 0;
    let maxConcurrent = 0;
    patchSpy.mockImplementation(async () => {
      activePatches += 1;
      maxConcurrent = Math.max(maxConcurrent, activePatches);
      await new Promise((resolve) => setImmediate(resolve));
      activePatches -= 1;
    });

    const { service, adapter, emitFileChange } = setup({
      storyIndex: createStoryIndex([
        { storyId: 'button--primary', importPath: './src/Button.stories.tsx', title: 'Button' },
      ]),
    });

    service.start(adapter);
    await vi.runAllTimersAsync();

    emitFileChange({ kind: 'change', path: '/repo/src/Button.tsx' });
    emitFileChange({ kind: 'change', path: '/repo/src/Other.tsx' });
    emitFileChange({ kind: 'unlink', path: '/repo/src/Stale.tsx' });
    await vi.runAllTimersAsync();

    expect(patchSpy).toHaveBeenCalledTimes(3);
    expect(maxConcurrent).toBe(1);
  });

  it('whenSettled resolves only after the in-flight patch settles, so a later lookup observes it', async () => {
    const reverseIndex = buildReverseIndex([]);
    const patchDeferred = createDeferred<void>();
    const { patchSpy, buildSpy } = installDependencyGraphMocks(reverseIndex);
    buildSpy.mockResolvedValue({ reverseIndex, graph: new Map() });

    patchSpy.mockImplementationOnce(async () => {
      await patchDeferred.promise;
      reverseIndex.record('/repo/src/Button.stories.tsx', '/repo/src/Button.stories.tsx', 0);
    });

    const { service, adapter, emitFileChange } = setup({
      storyIndex: createStoryIndex([
        { storyId: 'button--primary', importPath: './src/Button.stories.tsx', title: 'Button' },
      ]),
    });

    service.start(adapter);
    await vi.runAllTimersAsync();

    emitFileChange({ kind: 'change', path: '/repo/src/Button.stories.tsx' });

    let settled = false;
    void service.whenSettled().then(() => {
      settled = true;
    });
    // The patch is parked, so the settle barrier must not resolve yet.
    await Promise.resolve();
    expect(settled).toBe(false);

    patchDeferred.resolve();
    await vi.runAllTimersAsync();

    expect(settled).toBe(true);
    expect(service.lookup('/repo/src/Button.stories.tsx')).toEqual(
      new Map([['/repo/src/Button.stories.tsx', 0]])
    );
  });

  it('mirrors an update after each file-change patch settles, but not for the initial build', async () => {
    installDependencyGraphMocks(buildReverseIndex([]));
    const { service, adapter, emitFileChange, callbacks } = setup({
      storyIndex: createStoryIndex([
        { storyId: 'b--default', importPath: './src/B.stories.tsx', title: 'B' },
      ]),
    });

    service.start(adapter);
    await vi.runAllTimersAsync();
    expect(callbacks.onUpdate).not.toHaveBeenCalled();

    emitFileChange({ kind: 'change', path: '/repo/src/B.tsx' });
    emitFileChange({ kind: 'change', path: '/repo/src/C.tsx' });
    await vi.runAllTimersAsync();

    expect(callbacks.onUpdate).toHaveBeenCalledTimes(2);
  });

  it('buffers file events emitted during the build and applies them in order after build resolves', async () => {
    const reverseIndex = buildReverseIndex([]);
    const buildDeferred = createDeferred<void>();
    const { patchSpy, buildSpy } = installDependencyGraphMocks(reverseIndex);
    buildSpy.mockImplementation(async () => {
      await buildDeferred.promise;
      return { reverseIndex, graph: new Map() };
    });

    const { service, adapter, emitFileChange } = setup({ storyIndex: createStoryIndex([]) });

    service.start(adapter);
    // Advance past all awaits in startInternal up to the build await.
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    emitFileChange({ kind: 'change', path: '/repo/src/A.tsx' });
    emitFileChange({ kind: 'change', path: '/repo/src/B.tsx' });
    emitFileChange({ kind: 'unlink', path: '/repo/src/C.tsx' });
    expect(patchSpy).not.toHaveBeenCalled();

    buildDeferred.resolve();
    await vi.runAllTimersAsync();

    expect(patchSpy).toHaveBeenCalledTimes(3);
    expect(patchSpy).toHaveBeenNthCalledWith(1, { kind: 'change', path: '/repo/src/A.tsx' });
    expect(patchSpy).toHaveBeenNthCalledWith(2, { kind: 'change', path: '/repo/src/B.tsx' });
    expect(patchSpy).toHaveBeenNthCalledWith(3, { kind: 'unlink', path: '/repo/src/C.tsx' });
  });

  it('replays add through the patcher when onStoryIndexInvalidated reveals a new story', async () => {
    const reverseIndex = buildReverseIndex([]);
    const { patchSpy, buildSpy } = installDependencyGraphMocks(reverseIndex);
    buildSpy.mockResolvedValue({ reverseIndex, graph: new Map() });

    const initialIndex = createStoryIndex([
      { storyId: 'a--default', importPath: './src/A.stories.tsx', title: 'A' },
    ]);
    const updatedIndex = createStoryIndex([
      { storyId: 'a--default', importPath: './src/A.stories.tsx', title: 'A' },
      { storyId: 'b--default', importPath: './src/B.stories.tsx', title: 'B' },
    ]);
    const getIndex = vi.fn().mockResolvedValueOnce(initialIndex).mockResolvedValue(updatedIndex);

    const { service, adapter, callbacks } = setup({ getIndex });

    service.start(adapter);
    await vi.runAllTimersAsync();
    expect(patchSpy).not.toHaveBeenCalled();

    service.onStoryIndexInvalidated();
    await vi.runAllTimersAsync();

    expect(patchSpy).toHaveBeenCalledWith({ kind: 'add', path: '/repo/src/B.stories.tsx' });
    // The index changed, so the service wrapper is notified to bump graph revision.
    expect(callbacks.onStoryIndexInvalidated).toHaveBeenCalled();
  });

  it('guards duplicate onStoryIndexInvalidated so a newly-added story is replayed only once', async () => {
    const reverseIndex = buildReverseIndex([]);
    const { patchSpy, buildSpy } = installDependencyGraphMocks(reverseIndex);
    buildSpy.mockResolvedValue({ reverseIndex, graph: new Map() });

    const initialIndex = createStoryIndex([
      { storyId: 'a--default', importPath: './src/A.stories.tsx', title: 'A' },
    ]);
    const updatedIndex = createStoryIndex([
      { storyId: 'a--default', importPath: './src/A.stories.tsx', title: 'A' },
      { storyId: 'b--default', importPath: './src/B.stories.tsx', title: 'B' },
    ]);
    const getIndex = vi.fn().mockResolvedValueOnce(initialIndex).mockResolvedValue(updatedIndex);

    const { service, adapter } = setup({ getIndex });

    service.start(adapter);
    await vi.runAllTimersAsync();

    service.onStoryIndexInvalidated();
    service.onStoryIndexInvalidated();
    await vi.runAllTimersAsync();

    const addPatches = patchSpy.mock.calls.filter(
      ([event]) => event.kind === 'add' && event.path === '/repo/src/B.stories.tsx'
    );
    expect(addPatches).toHaveLength(1);
  });

  it('whenSettled waits for an in-flight story-index reconciliation, so a later lookup is post-reconciliation', async () => {
    // Regression guard for the invalidation-before-reconciliation gap: onStoryIndexInvalidated starts
    // an async refresh (getIndex + add/unlink) and notifies synchronously, before the
    // reconciliation patches exist. whenSettled() must await that in-flight reconciliation, not
    // just the current patch tail, or a consumer reacting to invalidation would read a pre-reconciliation
    // graph.
    const reverseIndex = buildReverseIndex([]);
    const getIndexDeferred = createDeferred<void>();
    const { patchSpy, buildSpy } = installDependencyGraphMocks(reverseIndex);
    buildSpy.mockResolvedValue({ reverseIndex, graph: new Map() });

    // The reconciliation's add patch records B into the reverse index, so a post-reconciliation
    // lookup can observe the freshly-walked story.
    patchSpy.mockImplementation(async (event) => {
      if (event.kind === 'add' && event.path === '/repo/src/B.stories.tsx') {
        reverseIndex.record('/repo/src/B.stories.tsx', '/repo/src/B.stories.tsx', 0);
      }
    });

    const initialIndex = createStoryIndex([
      { storyId: 'a--default', importPath: './src/A.stories.tsx', title: 'A' },
    ]);
    const updatedIndex = createStoryIndex([
      { storyId: 'a--default', importPath: './src/A.stories.tsx', title: 'A' },
      { storyId: 'b--default', importPath: './src/B.stories.tsx', title: 'B' },
    ]);
    // Build reads the initial index; the reconciliation's getIndex parks until released.
    const getIndex = vi
      .fn()
      .mockResolvedValueOnce(initialIndex)
      .mockImplementationOnce(async () => {
        await getIndexDeferred.promise;
        return updatedIndex;
      });

    const { service, adapter } = setup({ getIndex });
    service.start(adapter);
    await vi.runAllTimersAsync();

    service.onStoryIndexInvalidated();

    let settled = false;
    void service.whenSettled().then(() => {
      settled = true;
    });

    // The reconciliation is parked in getIndex, so the barrier must not resolve and the add patch
    // must not have run yet.
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(patchSpy).not.toHaveBeenCalled();

    getIndexDeferred.resolve();
    await vi.runAllTimersAsync();

    expect(settled).toBe(true);
    expect(patchSpy).toHaveBeenCalledWith({ kind: 'add', path: '/repo/src/B.stories.tsx' });
    expect(service.lookup('/repo/src/B.stories.tsx')).toEqual(
      new Map([['/repo/src/B.stories.tsx', 0]])
    );
  });

  it('fires onError and logs when the eager build throws', async () => {
    const { buildSpy } = installDependencyGraphMocks(buildReverseIndex([]));
    buildSpy.mockImplementation(async () => {
      throw new ModuleGraphFailureError('graph build blew up');
    });

    const { service, adapter, callbacks } = setup({ storyIndex: createStoryIndex([]) });

    service.start(adapter);
    await vi.runAllTimersAsync();

    expect(logger.error).toHaveBeenCalledWith('Module graph failed to start: graph build blew up');
    expect(callbacks.onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'graph build blew up' })
    );
    expect(callbacks.onSnapshot).not.toHaveBeenCalled();
    expect(service.hasGraph()).toBe(false);
  });

  it('fires onUnavailable when the adapter reports a startup failure', async () => {
    installDependencyGraphMocks(buildReverseIndex([]));

    const { service, adapter, emitStartupFailure, callbacks } = setup({
      storyIndex: createStoryIndex([]),
    });

    service.start(adapter);
    await vi.runAllTimersAsync();
    expect(callbacks.onSnapshot).toHaveBeenCalledTimes(1);

    emitStartupFailure({ reason: 'vite warmup failed', error: new Error('warmup failed') });
    await vi.runAllTimersAsync();

    expect(callbacks.onUnavailable).toHaveBeenCalledWith(
      'vite warmup failed',
      expect.objectContaining({ message: 'warmup failed' })
    );
  });
});
