import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';
import * as oxcParser from 'storybook/internal/oxc-parser';
import type { StoryIndex } from 'storybook/internal/types';

import {
  buildReverseIndex,
  createDeferred,
  createMockAdapter,
  createStoryIndex,
  installDependencyGraphMocks,
} from './change-detection.test-helpers.ts';
import { ChangeDetectionFailureError } from './errors.ts';
import { StoryDependencyGraphService } from './StoryDependencyGraphService.ts';

vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('./dependency-graph/index.ts', async (importOriginal) => {
  // Keep ReverseIndexImpl + types real so tests can build synthetic indexes; replace the
  // graph-building constructors with `vi.fn()`s so tests can override their behaviour per-case.
  const actual = await importOriginal<typeof import('./dependency-graph/index.ts')>();
  return {
    ...actual,
    ChangeDetectionResolverFactory: vi.fn(),
    DependencyGraphBuilder: vi.fn(),
    IncrementalPatcher: vi.fn(),
  };
});

const workingDir = '/repo';

function setup(options?: {
  storyIndex?: StoryIndex;
  getIndex?: ReturnType<typeof vi.fn>;
  withoutStartupFailure?: boolean;
}) {
  const callbacks = {
    onReady: vi.fn(),
    onChange: vi.fn(),
    onError: vi.fn(),
    onUnavailable: vi.fn(),
  };
  const adapterHandle = createMockAdapter({
    withoutStartupFailure: options?.withoutStartupFailure,
  });
  const getIndex =
    options?.getIndex ?? vi.fn().mockResolvedValue(options?.storyIndex ?? createStoryIndex([]));

  const service = new StoryDependencyGraphService({
    storyIndexGeneratorPromise: Promise.resolve({ getIndex } as never),
    workingDir,
    ...callbacks,
  });

  return { service, getIndex, callbacks, ...adapterHandle };
}

describe('StoryDependencyGraphService', () => {
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

  it('builds the graph, fires onReady, and exposes the reverse index via lookup', async () => {
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

    expect(callbacks.onReady).toHaveBeenCalledTimes(1);
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(service.hasGraph()).toBe(true);
    expect(service.lookup('/repo/src/Button.tsx')).toEqual(
      new Map([['/repo/src/Button.stories.tsx', 1]])
    );
    expect(service.lookup('/repo/src/Unknown.tsx')).toEqual(new Map());

    await service.dispose();
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

    await service.dispose();
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

    await service.dispose();
  });

  it('fires onChange after each file-change patch settles, but not for the initial build', async () => {
    installDependencyGraphMocks(buildReverseIndex([]));
    const { service, adapter, emitFileChange, callbacks } = setup({
      storyIndex: createStoryIndex([
        { storyId: 'b--default', importPath: './src/B.stories.tsx', title: 'B' },
      ]),
    });

    service.start(adapter);
    await vi.runAllTimersAsync();
    expect(callbacks.onChange).not.toHaveBeenCalled();

    emitFileChange({ kind: 'change', path: '/repo/src/B.tsx' });
    emitFileChange({ kind: 'change', path: '/repo/src/C.tsx' });
    await vi.runAllTimersAsync();

    expect(callbacks.onChange).toHaveBeenCalledTimes(2);

    await service.dispose();
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

    await service.dispose();
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
    // The index changed, so consumers are notified to recompute derived state.
    expect(callbacks.onChange).toHaveBeenCalled();

    await service.dispose();
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

    await service.dispose();
  });

  it('fires onError, logs, and disposes the oxc pool when the eager build throws', async () => {
    const { buildSpy } = installDependencyGraphMocks(buildReverseIndex([]));
    buildSpy.mockImplementation(async () => {
      throw new ChangeDetectionFailureError('graph build blew up');
    });
    const disposePoolSpy = vi.spyOn(oxcParser, 'disposeOxcParsePool').mockResolvedValue(undefined);

    const { service, adapter, callbacks } = setup({ storyIndex: createStoryIndex([]) });

    service.start(adapter);
    await vi.runAllTimersAsync();

    expect(logger.error).toHaveBeenCalledWith(
      'Change detection failed to start: graph build blew up'
    );
    expect(callbacks.onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'graph build blew up' })
    );
    expect(callbacks.onReady).not.toHaveBeenCalled();
    expect(disposePoolSpy).toHaveBeenCalledTimes(1);
    expect(service.hasGraph()).toBe(false);

    await service.dispose();
  });

  it('fires onUnavailable and tears down when the adapter reports a startup failure', async () => {
    installDependencyGraphMocks(buildReverseIndex([]));
    const disposePoolSpy = vi.spyOn(oxcParser, 'disposeOxcParsePool').mockResolvedValue(undefined);

    const { service, adapter, emitStartupFailure, callbacks, hasFileChangeSubscriber } = setup({
      storyIndex: createStoryIndex([]),
    });

    service.start(adapter);
    await vi.runAllTimersAsync();
    expect(callbacks.onReady).toHaveBeenCalledTimes(1);
    expect(hasFileChangeSubscriber()).toBe(true);

    emitStartupFailure({ reason: 'vite warmup failed', error: new Error('warmup failed') });
    await vi.runAllTimersAsync();

    expect(callbacks.onUnavailable).toHaveBeenCalledWith(
      'vite warmup failed',
      expect.objectContaining({ message: 'warmup failed' })
    );
    expect(disposePoolSpy).toHaveBeenCalledTimes(1);
    // Disposal tears down the file-change subscription.
    expect(hasFileChangeSubscriber()).toBe(false);

    await service.dispose();
  });

  it('drains the in-flight patch before disposing the oxc pool, and dispose is idempotent', async () => {
    const reverseIndex = buildReverseIndex([]);
    const patchDeferred = createDeferred<void>();
    const { patchSpy, buildSpy } = installDependencyGraphMocks(reverseIndex);
    buildSpy.mockResolvedValue({ reverseIndex, graph: new Map() });
    patchSpy.mockImplementationOnce(async () => {
      await patchDeferred.promise;
    });
    const disposePoolSpy = vi.spyOn(oxcParser, 'disposeOxcParsePool').mockResolvedValue(undefined);

    const { service, adapter, emitFileChange } = setup({
      storyIndex: createStoryIndex([
        { storyId: 'b--default', importPath: './src/B.stories.tsx', title: 'B' },
      ]),
    });

    service.start(adapter);
    await vi.runAllTimersAsync();

    emitFileChange({ kind: 'change', path: '/repo/src/B.tsx' });
    // Let the patch start and park inside patchSpy (now in-flight, past the disposed guard).
    await Promise.resolve();
    await Promise.resolve();
    expect(patchSpy).toHaveBeenCalledTimes(1);

    let disposed = false;
    const disposePromise = service.dispose().then(() => {
      disposed = true;
    });
    await Promise.resolve();
    // Dispose must wait for the in-flight patch to settle before disposing the pool.
    expect(disposed).toBe(false);
    expect(disposePoolSpy).not.toHaveBeenCalled();

    patchDeferred.resolve();
    await disposePromise;

    expect(disposed).toBe(true);
    expect(disposePoolSpy).toHaveBeenCalledTimes(1);

    // Idempotent: a second dispose is a no-op.
    await service.dispose();
    expect(disposePoolSpy).toHaveBeenCalledTimes(1);
  });
});
