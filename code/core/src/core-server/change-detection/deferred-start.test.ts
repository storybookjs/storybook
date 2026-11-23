import { stat } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DOCS_RENDERED,
  PREVIEW_INITIALIZED,
  STORY_FINISHED,
  STORY_PREPARED,
  STORY_RENDERED,
} from 'storybook/internal/core-events';

import { mockChannel } from '../../channels/mock-channel.ts';
import { clearRegistry } from '../../shared/open-service/server.ts';
import type { FileChangeEvent } from '../../shared/open-service/services/module-graph/engine/adapters/types.ts';
import {
  buildReverseIndex,
  createMockAdapter,
  createStoryIndex,
  installDependencyGraphMocks,
} from '../../shared/open-service/services/module-graph/module-graph.test-helpers.ts';
import {
  registerModuleGraphService,
  resetChangeDetectionAdapterForTests,
  resolveChangeDetectionAdapter,
} from '../../shared/open-service/services/module-graph/server.ts';
import { START_FALLBACK_DELAY_MS, deferChangeDetectionStart } from './deferred-start.ts';
import {
  getChangeDetectionReadiness,
  resetChangeDetectionReadiness,
  setChangeDetectionHost,
  setChangeDetectionReadiness,
} from './readiness.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock(
  '../../shared/open-service/services/module-graph/engine/dependency-graph/resolver-factory.ts',
  { spy: true }
);
vi.mock(
  '../../shared/open-service/services/module-graph/engine/dependency-graph/dependency-graph-builder.ts',
  { spy: true }
);
vi.mock(
  '../../shared/open-service/services/module-graph/engine/dependency-graph/incremental-patcher.ts',
  { spy: true }
);

const buttonChange: FileChangeEvent = { kind: 'change', path: '/repo/src/Button.tsx' };
const iconRemoval: FileChangeEvent = { kind: 'unlink', path: '/repo/src/Icon.tsx' };
const cardChange: FileChangeEvent = { kind: 'change', path: '/repo/src/Card.tsx' };
const storyFinished = { storyId: 'button--primary', status: 'success', reporters: [] };

function setup(builder = createMockAdapter()) {
  const channel = mockChannel();
  const start = vi.fn();
  const { recordingAdapter, cancel } = deferChangeDetectionStart({
    channel,
    adapter: builder.adapter,
    start,
  });
  return { channel, start, builder, adapter: recordingAdapter!, cancel };
}

describe('deferChangeDetectionStart', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    setChangeDetectionHost(undefined);
    resetChangeDetectionReadiness();
    clearRegistry();
    resetChangeDetectionAdapterForTests();
  });

  describe('when it starts', () => {
    it('waits while the first render is still under way', async () => {
      const { channel, start } = setup();

      channel.emit(PREVIEW_INITIALIZED, { userAgent: 'test' });
      channel.emit(STORY_PREPARED, { id: 'button--primary' });
      channel.emit(STORY_RENDERED, 'button--primary');
      await vi.advanceTimersByTimeAsync(START_FALLBACK_DELAY_MS - 1);

      expect(start).not.toHaveBeenCalled();
    });

    it('starts when a preview has finished its first story', () => {
      const { channel, start } = setup();

      channel.emit(STORY_FINISHED, storyFinished);

      expect(start).toHaveBeenCalledOnce();
    });

    it('starts when a preview has rendered its first docs page', () => {
      const { channel, start } = setup();

      channel.emit(DOCS_RENDERED, 'button--docs');

      expect(start).toHaveBeenCalledOnce();
    });

    it('starts after the fallback delay when no preview reports a render', async () => {
      const channel = mockChannel();
      const start = vi.fn();
      deferChangeDetectionStart({ channel, adapter: undefined, start });

      await vi.advanceTimersByTimeAsync(START_FALLBACK_DELAY_MS);

      expect(start).toHaveBeenCalledOnce();
    });

    it('starts at once when change detection readiness is requested', async () => {
      const { start } = setup();
      start.mockImplementation(() => setChangeDetectionReadiness({ status: 'ready' }));

      await expect(getChangeDetectionReadiness()).resolves.toEqual({ status: 'ready' });

      expect(start).toHaveBeenCalledOnce();
    });

    it('starts at once on a file change', () => {
      const { start, builder } = setup();

      builder.emitFileChange(buttonChange);

      expect(start).toHaveBeenCalledOnce();
    });

    it('starts once when every reason to start happens', async () => {
      const { channel, start, builder } = setup();

      channel.emit(STORY_FINISHED, storyFinished);
      channel.emit(STORY_FINISHED, { ...storyFinished, storyId: 'button--secondary' });
      channel.emit(DOCS_RENDERED, 'button--docs');
      builder.emitFileChange(buttonChange);
      void getChangeDetectionReadiness();
      await vi.advanceTimersByTimeAsync(START_FALLBACK_DELAY_MS);

      expect(start).toHaveBeenCalledOnce();
    });
  });

  describe('file changes made before the module graph subscribes', () => {
    it('reach the module graph when it subscribes, once and in the order they were made', () => {
      const { builder, adapter } = setup();
      builder.emitFileChange(buttonChange);
      builder.emitFileChange(iconRemoval);

      const moduleGraph = vi.fn();
      adapter.onFileChange(moduleGraph);
      builder.emitFileChange(cardChange);

      expect(moduleGraph.mock.calls).toEqual([[buttonChange], [iconRemoval], [cardChange]]);
    });

    it('are not repeated to a later subscriber', () => {
      const { builder, adapter } = setup();
      builder.emitFileChange(buttonChange);
      const unsubscribe = adapter.onFileChange(vi.fn());
      builder.emitFileChange(iconRemoval);
      unsubscribe();

      const laterSubscriber = vi.fn();
      adapter.onFileChange(laterSubscriber);
      builder.emitFileChange(cardChange);

      expect(laterSubscriber.mock.calls).toEqual([[cardChange]]);
    });

    it('are reported to the subscribers of the module graph service', async () => {
      // The fixture paths do not exist, and the engine dates a change by the file's mtime.
      vi.mocked(stat).mockRejectedValue(new Error('ENOENT'));
      installDependencyGraphMocks(
        buildReverseIndex([['/repo/src/Button.tsx', '/repo/src/Button.stories.tsx', 1]])
      );
      const moduleGraph = registerModuleGraphService({
        channel: mockChannel(),
        getIndex: async () =>
          createStoryIndex([
            { storyId: 'button--primary', importPath: './src/Button.stories.tsx' },
          ]),
        workingDir: '/repo',
      });
      const builder = createMockAdapter();
      const { recordingAdapter } = deferChangeDetectionStart({
        channel: mockChannel(),
        adapter: builder.adapter,
        start: () => void moduleGraph.queries.status.loaded(undefined),
      });
      resolveChangeDetectionAdapter(recordingAdapter);

      builder.emitFileChange(buttonChange);

      await vi.waitFor(() => {
        expect(moduleGraph.queries.latestStoryChanges.get(undefined)).toEqual({
          revision: 1,
          storyFiles: ['./src/Button.stories.tsx'],
        });
      });
    });

    it('are no longer recorded once change detection reported its readiness without a module graph', async () => {
      const { channel, builder } = setup();
      channel.emit(STORY_FINISHED, storyFinished);
      expect(builder.hasFileChangeSubscriber()).toBe(true);

      setChangeDetectionReadiness({ status: 'error', error: new Error('The index failed') });
      await vi.advanceTimersByTimeAsync(0);

      expect(builder.hasFileChangeSubscriber()).toBe(false);
    });
  });

  describe('the adapter for the module graph', () => {
    it('gives the resolve config and the startup failures of the builder adapter', async () => {
      const { builder, adapter } = setup();
      const onStartupFailure = vi.fn();

      adapter.onStartupFailure(onStartupFailure);
      builder.emitStartupFailure({ reason: 'The Vite warmup failed' });

      await expect(adapter.getResolveConfig()).resolves.toEqual({ projectRoot: '/repo' });
      expect(onStartupFailure).toHaveBeenCalledExactlyOnceWith({
        reason: 'The Vite warmup failed',
      });
    });

    it('takes a startup failure handler for a builder that reports none', () => {
      const { adapter } = setup(createMockAdapter({ withoutStartupFailure: true }));

      const unsubscribe = adapter.onStartupFailure(vi.fn());

      expect(unsubscribe).not.toThrow();
    });
  });

  describe('disposal', () => {
    it('never starts once cancelled', async () => {
      const { channel, start, builder, cancel } = setup();

      cancel();
      channel.emit(STORY_FINISHED, storyFinished);
      channel.emit(DOCS_RENDERED, 'button--docs');
      builder.emitFileChange(buttonChange);
      void getChangeDetectionReadiness();
      await vi.advanceTimersByTimeAsync(START_FALLBACK_DELAY_MS);

      expect(start).not.toHaveBeenCalled();
    });

    it('leaves no channel listener, timer or file change subscription once cancelled', () => {
      const { channel, builder, cancel } = setup();

      cancel();

      expect(channel.listenerCount(STORY_FINISHED)).toBe(0);
      expect(channel.listenerCount(DOCS_RENDERED)).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
      expect(builder.hasFileChangeSubscriber()).toBe(false);
    });

    it('leaves no channel listener or timer once started', () => {
      const { channel } = setup();

      channel.emit(STORY_FINISHED, storyFinished);

      expect(channel.listenerCount(STORY_FINISHED)).toBe(0);
      expect(channel.listenerCount(DOCS_RENDERED)).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('stops recording file changes when cancelled after the start', () => {
      const { channel, builder, cancel } = setup();
      channel.emit(STORY_FINISHED, storyFinished);

      cancel();

      expect(builder.hasFileChangeSubscriber()).toBe(false);
    });

    it('does not keep the process alive while it waits', () => {
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

      setup();

      expect(setTimeoutSpy.mock.results[0].value.hasRef()).toBe(false);
    });
  });
});
