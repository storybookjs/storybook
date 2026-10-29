import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Channel, type ChannelTransport } from '@storybook/core/internal/channels';
import { executeNodeCommand } from '@storybook/core/internal/common';
import { internal_UniversalStore } from '@storybook/core/internal/services';
import type { StoryIndex } from '@storybook/core/internal/types';

import {
  STATUS_STORE_CHANNEL_EVENT_NAME,
  STORE_CHANNEL_EVENT_NAME,
  STORY_INDEX_CHANNEL_EVENT_NAME,
  TEST_PROVIDER_STORE_CHANNEL_EVENT_NAME,
  storeOptions,
} from '../constants.ts';
import { log } from '../logger.ts';
import type { StoreEvent } from '../types.ts';
import type { StoreState } from '../types.ts';
import { createTestRunner, type TestRunner } from './boot-test-runner.ts';
import type { TestRunnerHost } from './host.ts';

let stdout: (chunk: Buffer | string) => void;
let stderr: (chunk: Buffer | string) => void;
let message: (event: { type: string; args?: unknown[]; payload?: unknown }) => void;
let exitChild: (code: number | null, signal: string | null) => void;

const child = vi.hoisted(() => ({
  stdout: {
    on: vi.fn((event: string, callback: (chunk: Buffer | string) => void) => {
      if (event === 'data') {
        stdout = callback;
      }
    }),
  },
  stderr: {
    on: vi.fn((event: string, callback: (chunk: Buffer | string) => void) => {
      if (event === 'data') {
        stderr = callback;
      }
    }),
  },
  on: vi.fn(
    (
      event: string,
      callback: (event: { type: string; args?: unknown[]; payload?: unknown }) => void
    ) => {
      if (event === 'message') {
        message = callback;
      }
      if (event === 'exit') {
        exitChild = callback as unknown as typeof exitChild;
      }
    }
  ),
  send: vi.fn(),
  kill: vi.fn(),
}));

vi.mock('@storybook/core/internal/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@storybook/core/internal/common')>();
  return {
    ...actual,
    executeNodeCommand: vi.fn().mockReturnValue(child),
    importMetaResolve: vi
      .fn()
      .mockImplementation(
        () => 'file://' + join(__dirname, '..', '..', 'dist', 'node', 'vitest.js')
      ),
  };
});

vi.mock('../logger', () => ({
  log: vi.fn(),
}));

// Each test gets the runner of a fresh instance.
let runner: TestRunner | undefined;
const runTestRunner: TestRunner['run'] = (input) => runner!.run(input);
const sendStoryIndexToTestRunner: TestRunner['sendStoryIndex'] = (generator) =>
  runner!.sendStoryIndex(generator);
const killTestRunner = () => runner!.kill();

beforeEach(() => {
  vi.useFakeTimers();
  runner?.kill();
  runner = createTestRunner();
});

afterEach(() => {
  vi.useRealTimers();
  mockChannel.removeAllListeners();
});

const storyIndex: StoryIndex = { v: 5, entries: {} };
const storyIndexGenerator = { getIndex: vi.fn(async () => storyIndex) };

const childSpawned = () => vi.waitFor(() => expect(executeNodeCommand).toHaveBeenCalled());

const transport = { setHandler: vi.fn(), send: vi.fn() } satisfies ChannelTransport;
const mockChannel = new Channel({ transport });

/** Store state broadcasts the owner sends the child, which the run-order assertions skip. */
const isStoreStateMessage = (event: { type: string; args?: any[] }) =>
  event.type === STORE_CHANNEL_EVENT_NAME && event.args?.[0]?.kind !== 'event';

describe('bootTestRunner', () => {
  let mockStore: internal_UniversalStore<StoreState, StoreEvent>;
  const mockStorybook = {
    configDir: '.storybook',
    workingDir: '/project',
    getStoryIndexGenerator: vi.fn(async () => storyIndexGenerator),
    callHook: vi.fn(async (name: string, value?: unknown) =>
      name === 'preview:annotations:collect' ? ['/project/.storybook/preview.ts'] : value
    ),
  } as unknown as TestRunnerHost;

  beforeEach(() => {
    // The instance owns the store on the channel the runner bridges to the child.
    mockStore = internal_UniversalStore.create<StoreState, StoreEvent>({
      ...storeOptions,
      owner: true,
      channel: mockChannel,
    });
    vi.mocked(executeNodeCommand).mockClear();
    vi.mocked(log).mockClear();
    child.send.mockClear();
    storyIndexGenerator.getIndex.mockReset();
    storyIndexGenerator.getIndex.mockResolvedValue(storyIndex);
  });

  it('should execute vitest.js', async () => {
    const promise = runTestRunner({
      channel: mockChannel,
      store: mockStore,
      storybook: mockStorybook,
    });
    await childSpawned();
    expect(vi.mocked(executeNodeCommand)).toHaveBeenCalledWith({
      scriptPath: expect.stringMatching(/vitest\.js$/),
      options: {
        cwd: '/project',
        env: {
          NODE_ENV: 'test',
          TEST: 'true',
          VITEST: 'true',
          VITEST_CHILD_PROCESS: 'true',
          STORYBOOK_CONFIG_DIR: '.storybook',
          STORYBOOK_PREVIEW_ANNOTATIONS: JSON.stringify(['/project/.storybook/preview.ts']),
        },
        extendEnv: true,
      },
    });
    message({ type: 'ready' });
    await promise;
  });

  it('should log stdout and stderr', async () => {
    const promise = runTestRunner({
      channel: mockChannel,
      store: mockStore,
      storybook: mockStorybook,
    });
    await childSpawned();
    stdout('foo');
    stderr('bar');
    message({ type: 'ready' });
    await promise;
    expect(vi.mocked(log)).toHaveBeenCalledWith('foo');
    expect(vi.mocked(log)).toHaveBeenCalledWith('bar');
  });

  it('should wait for vitest to be ready', async () => {
    let ready;
    const promise = runTestRunner({
      channel: mockChannel,
      store: mockStore,
      storybook: mockStorybook,
    }).then(() => {
      ready = true;
    });
    await childSpawned();
    expect(ready).toBeUndefined();
    message({ type: 'ready' });
    await expect(promise).resolves.toBeUndefined();
    expect(ready).toBe(true);
  });

  it('should abort if vitest doesn’t become ready in time', async () => {
    const promise = runTestRunner({
      channel: mockChannel,
      store: mockStore,
      storybook: mockStorybook,
    });
    await childSpawned();
    vi.advanceTimersByTime(30001);
    await expect(promise).rejects.toThrow();
  });

  it('should forward the owner store messages to the child, and not client messages', async () => {
    const promise = runTestRunner({
      channel: mockChannel,
      store: mockStore,
      storybook: mockStorybook,
    });
    await childSpawned();
    message({ type: 'ready' });
    await promise;
    child.send.mockClear();

    mockStore.send({ type: 'TRIGGER_RUN', payload: { triggeredBy: 'global', storyIds: ['foo'] } });
    mockChannel.emit(STATUS_STORE_CHANNEL_EVENT_NAME, {
      kind: 'state-request',
      from: { id: 'manager', type: 'CLIENT' },
    });

    expect(child.send.mock.calls).toEqual([
      [
        {
          args: [
            {
              kind: 'event',
              event: {
                payload: { storyIds: ['foo'], triggeredBy: 'global' },
                type: 'TRIGGER_RUN',
              },
              eventInfo: { actor: mockStore.actor },
            },
          ],
          from: 'server',
          type: 'UNIVERSAL_STORE:storybook/test',
        },
      ],
    ]);

    message({ type: 'some-event', args: ['foo'] });
    expect(mockChannel.last('some-event')).toEqual(['foo']);
  });

  it('should deliver store messages from the child without re-broadcasting them', async () => {
    const promise = runTestRunner({
      channel: mockChannel,
      store: mockStore,
      storybook: mockStorybook,
    });
    await childSpawned();
    message({ type: 'ready' });
    await promise;
    // No owner of these stores listens on this channel, so nothing answers.
    for (const type of [STATUS_STORE_CHANNEL_EVENT_NAME, TEST_PROVIDER_STORE_CHANNEL_EVENT_NAME]) {
      transport.send.mockClear();
      const bridgedListener = vi.fn();
      mockChannel.on(type, bridgedListener);
      const bridgedEvent = {
        type,
        args: [{ kind: 'set-state', from: { id: 'child', type: 'CLIENT' }, seq: 1, state: {} }],
      };
      message(bridgedEvent);
      expect(bridgedListener).toHaveBeenCalledWith(bridgedEvent.args[0]);
      expect(transport.send).not.toHaveBeenCalled();
      mockChannel.off(type, bridgedListener);
    }

    message({ type: 'other-event', args: ['bar'] });
    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'other-event' }),
      expect.anything()
    );
  });

  it('should broadcast child store writes to clients exactly once, via the owner', async () => {
    const promise = runTestRunner({
      channel: mockChannel,
      store: mockStore,
      storybook: mockStorybook,
    });
    await childSpawned();
    message({ type: 'ready' });
    await promise;
    transport.send.mockClear();
    const childActor = { id: 'child-client', type: 'CLIENT' };

    message({
      type: STORE_CHANNEL_EVENT_NAME,
      args: [
        {
          kind: 'set-state',
          from: childActor,
          seq: 1,
          state: { ...mockStore.getState(), watching: true },
        },
      ],
    });

    expect(mockStore.getState().watching).toBe(true);
    expect(transport.send.mock.calls.map(([event]) => [event.type, event.args[0].kind])).toEqual([
      [STORE_CHANNEL_EVENT_NAME, 'state-changed'],
    ]);
    expect(transport.send.mock.calls[0][0].args[0].eventInfo.actor).toEqual(childActor);
  });

  it('should resend init event', async () => {
    const promise = runTestRunner({
      channel: mockChannel,
      store: mockStore,
      storybook: mockStorybook,
      initEvent: 'init',
      initArgs: ['foo'],
    });
    await childSpawned();
    message({ type: 'ready' });
    await promise;
    expect(child.send).toHaveBeenCalledWith({
      args: ['foo'],
      from: 'server',
      type: 'init',
    });
  });

  it('should send the story index to the child before the events queued during boot', async () => {
    const promise = runTestRunner({
      channel: mockChannel,
      store: mockStore,
      storybook: mockStorybook,
      initEvent: 'init',
      initArgs: ['foo'],
    });
    await childSpawned();
    message({ type: 'ready' });
    await promise;
    expect(child.send.mock.calls.map(([event]) => event.type)).toEqual([
      STORY_INDEX_CHANNEL_EVENT_NAME,
      'init',
    ]);
    expect(child.send).toHaveBeenCalledWith({
      type: STORY_INDEX_CHANNEL_EVENT_NAME,
      args: [storyIndex],
      from: 'server',
    });
  });

  it('should send a new story index to a running child', async () => {
    const promise = runTestRunner({
      channel: mockChannel,
      store: mockStore,
      storybook: mockStorybook,
    });
    await childSpawned();
    message({ type: 'ready' });
    await promise;
    child.send.mockClear();
    const updatedIndex: StoryIndex = { v: 5, entries: { 'a--b': {} as never } };
    storyIndexGenerator.getIndex.mockResolvedValueOnce(updatedIndex);

    await sendStoryIndexToTestRunner(storyIndexGenerator as never);

    expect(child.send).toHaveBeenCalledWith({
      type: STORY_INDEX_CHANNEL_EVENT_NAME,
      args: [updatedIndex],
      from: 'server',
    });
  });

  it('should boot with the last good story index while a story file is broken', async () => {
    await sendStoryIndexToTestRunner(storyIndexGenerator as never);
    storyIndexGenerator.getIndex.mockRejectedValue(new Error('broken story file'));

    const promise = runTestRunner({
      channel: mockChannel,
      store: mockStore,
      storybook: mockStorybook,
      initEvent: 'init',
      initArgs: ['foo'],
    });
    await childSpawned();
    message({ type: 'ready' });

    await expect(promise).resolves.toBeUndefined();
    expect(child.send).toHaveBeenCalledWith({
      type: STORY_INDEX_CHANNEL_EVENT_NAME,
      args: [storyIndex],
      from: 'server',
    });
    expect(child.send).toHaveBeenCalledWith({ type: 'init', args: ['foo'], from: 'server' });
  });

  const deferredIndex = () => {
    let resolve!: (index: StoryIndex) => void;
    const promise = new Promise<StoryIndex>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  };
  const indexV1: StoryIndex = { v: 5, entries: { v1: {} as never } };
  const indexV2: StoryIndex = { v: 5, entries: { v2: {} as never } };
  const sentTypes = () =>
    child.send.mock.calls
      .filter(([event]) => !isStoreStateMessage(event))
      .map(([event]) =>
        event.type === STORY_INDEX_CHANNEL_EVENT_NAME
          ? `index:${Object.keys(event.args[0].entries).join()}`
          : event.type === STORE_CHANNEL_EVENT_NAME
            ? `${event.args[0].event.type}:${event.args[0].event.payload.storyIds}`
            : event.type
      );
  const bootOnTrigger = () =>
    mockStore.subscribe('TRIGGER_RUN', (event, eventInfo) => {
      runTestRunner({
        channel: mockChannel,
        store: mockStore,
        storybook: mockStorybook,
        initEvent: STORE_CHANNEL_EVENT_NAME,
        initArgs: [internal_UniversalStore.eventMessage(event, eventInfo)],
      }).catch(() => {});
    });

  it('should send a run triggered during boot only after the story index, and once', async () => {
    await sendStoryIndexToTestRunner(storyIndexGenerator as never);
    bootOnTrigger();
    mockStore.send({ type: 'TRIGGER_RUN', payload: { triggeredBy: 'global', storyIds: ['a'] } });
    await childSpawned();
    mockStore.send({ type: 'TRIGGER_RUN', payload: { triggeredBy: 'global', storyIds: ['b'] } });
    message({ type: 'ready' });
    await vi.waitFor(() => expect(sentTypes()).toContain('TRIGGER_RUN:a'));

    expect(sentTypes()).toEqual(['index:', 'TRIGGER_RUN:a', 'TRIGGER_RUN:b']);
  });

  it('should keep the newest story index when getIndex() calls resolve out of order', async () => {
    const promise = runTestRunner({
      channel: mockChannel,
      store: mockStore,
      storybook: mockStorybook,
    });
    await childSpawned();
    message({ type: 'ready' });
    await promise;
    child.send.mockClear();
    const first = deferredIndex();
    const second = deferredIndex();
    storyIndexGenerator.getIndex.mockReturnValueOnce(first.promise);
    storyIndexGenerator.getIndex.mockReturnValueOnce(second.promise);

    const a = sendStoryIndexToTestRunner(storyIndexGenerator as never);
    const b = sendStoryIndexToTestRunner(storyIndexGenerator as never);
    second.resolve(indexV2);
    await b;
    first.resolve(indexV1);
    await a;

    expect(sentTypes()).toEqual(['index:v2']);
  });

  it('should not let the ready handler overwrite an index from a later invalidation', async () => {
    await sendStoryIndexToTestRunner(storyIndexGenerator as never);
    const promise = runTestRunner({
      channel: mockChannel,
      store: mockStore,
      storybook: mockStorybook,
      initEvent: 'init',
    });
    await childSpawned();
    child.send.mockClear();
    const onReady = deferredIndex();
    storyIndexGenerator.getIndex.mockReturnValueOnce(onReady.promise);
    message({ type: 'ready' });
    storyIndexGenerator.getIndex.mockResolvedValueOnce(indexV2);
    await sendStoryIndexToTestRunner(storyIndexGenerator as never);
    onReady.resolve(indexV1);
    await promise;

    expect(sentTypes()).toEqual(['index:v2', 'init']);
  });

  it('should not send an index fetched for a killed child to its successor', async () => {
    bootOnTrigger();
    mockStore.send({ type: 'TRIGGER_RUN', payload: { triggeredBy: 'global', storyIds: ['a'] } });
    await childSpawned();
    message({ type: 'ready' });
    await vi.waitFor(() => expect(sentTypes()).toContain('TRIGGER_RUN:a'));
    const stale = deferredIndex();
    storyIndexGenerator.getIndex.mockReturnValueOnce(stale.promise);
    const staleSend = sendStoryIndexToTestRunner(storyIndexGenerator as never);
    mockStore.send({
      type: 'FATAL_ERROR',
      payload: { message: 'crash', error: { message: 'crash' } },
    });
    vi.mocked(executeNodeCommand).mockClear();
    child.send.mockClear();

    storyIndexGenerator.getIndex.mockResolvedValue(indexV2);
    mockStore.send({ type: 'TRIGGER_RUN', payload: { triggeredBy: 'global', storyIds: ['b'] } });
    await childSpawned();
    message({ type: 'ready' });
    await vi.waitFor(() => expect(sentTypes()).toContain('index:v2'));
    stale.resolve(indexV1);
    await staleSend;

    expect(sentTypes().filter((type) => type.startsWith('index:'))).toEqual(['index:v2']);
  });

  it('should not resend an unchanged story index while a story file stays broken', async () => {
    const promise = runTestRunner({
      channel: mockChannel,
      store: mockStore,
      storybook: mockStorybook,
    });
    await childSpawned();
    message({ type: 'ready' });
    await promise;
    child.send.mockClear();
    storyIndexGenerator.getIndex.mockRejectedValue(new Error('broken story file'));

    await sendStoryIndexToTestRunner(storyIndexGenerator as never);
    await sendStoryIndexToTestRunner(storyIndexGenerator as never);
    await sendStoryIndexToTestRunner(storyIndexGenerator as never);

    expect(child.send).not.toHaveBeenCalled();
  });

  it('should send the story index to a booting child once', async () => {
    const promise = runTestRunner({
      channel: mockChannel,
      store: mockStore,
      storybook: mockStorybook,
    });
    await childSpawned();
    await sendStoryIndexToTestRunner(storyIndexGenerator as never);
    message({ type: 'ready' });
    await promise;

    expect(sentTypes()).toEqual(['index:']);
  });

  it('should report a fatal error when the story index generator cannot be loaded', async () => {
    const fatalErrors = vi.fn();
    mockStore.subscribe('FATAL_ERROR', fatalErrors);
    const storybook = {
      ...mockStorybook,
      getStoryIndexGenerator: vi.fn().mockRejectedValue(new Error('no index')),
    } as unknown as TestRunnerHost;

    await expect(
      runTestRunner({ channel: mockChannel, store: mockStore, storybook })
    ).rejects.toThrow('no index');

    expect(fatalErrors).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ message: 'Failed to start test runner process' }),
      }),
      expect.anything()
    );
  });

  it('should boot a new child after the child dies, and run the trigger that boots it', async () => {
    bootOnTrigger();
    mockStore.send({ type: 'TRIGGER_RUN', payload: { triggeredBy: 'global', storyIds: ['a'] } });
    await childSpawned();
    message({ type: 'ready' });
    await vi.waitFor(() => expect(sentTypes()).toContain('TRIGGER_RUN:a'));
    vi.mocked(executeNodeCommand).mockClear();
    child.send.mockClear();

    exitChild(null, 'SIGKILL');
    mockStore.send({ type: 'TRIGGER_RUN', payload: { triggeredBy: 'global', storyIds: ['b'] } });
    await childSpawned();
    message({ type: 'ready' });

    await vi.waitFor(() => expect(sentTypes()).toEqual(['index:', 'TRIGGER_RUN:b']));
  });

  it('should run the trigger that boots the runner again after a fatal error killed the child', async () => {
    bootOnTrigger();
    mockStore.send({ type: 'TRIGGER_RUN', payload: { triggeredBy: 'global', storyIds: ['a'] } });
    await childSpawned();
    message({ type: 'ready' });
    await vi.waitFor(() => expect(sentTypes()).toContain('TRIGGER_RUN:a'));
    mockStore.send({
      type: 'FATAL_ERROR',
      payload: { message: 'crash', error: { message: 'crash' } },
    });
    vi.mocked(executeNodeCommand).mockClear();
    child.send.mockClear();

    mockStore.send({ type: 'TRIGGER_RUN', payload: { triggeredBy: 'global', storyIds: ['b'] } });
    await childSpawned();
    message({ type: 'ready' });

    await vi.waitFor(() => expect(sentTypes()).toEqual(['index:', 'TRIGGER_RUN:b']));
  });

  it('should report one fatal error and close the open run when a ready child dies', async () => {
    const fatalErrors = vi.fn();
    mockStore.subscribe('FATAL_ERROR', fatalErrors);
    const promise = runTestRunner({
      channel: mockChannel,
      store: mockStore,
      storybook: mockStorybook,
    });
    await childSpawned();
    message({ type: 'ready' });
    await promise;
    mockStore.setState((s) => ({
      ...s,
      cancelling: true,
      currentRun: { ...s.currentRun, startedAt: 1000, finishedAt: undefined },
    }));

    exitChild(null, 'SIGKILL');

    expect(fatalErrors).toHaveBeenCalledTimes(1);
    expect(mockStore.getState().cancelling).toBe(false);
    expect(mockStore.getState().currentRun.finishedAt).toEqual(expect.any(Number));
  });

  it('should report one fatal error when the child crashes before it is ready', async () => {
    const fatalErrors = vi.fn();
    mockStore.subscribe('FATAL_ERROR', fatalErrors);
    const promise = runTestRunner({
      channel: mockChannel,
      store: mockStore,
      storybook: mockStorybook,
    });
    await childSpawned();

    message({
      type: 'uncaught-error',
      payload: {
        message: 'Uncaught exception in the test runner process',
        error: { message: 'x' },
      },
    });
    await promise.catch(() => {});

    expect(fatalErrors).toHaveBeenCalledTimes(1);
  });

  it('should fail the boot at once, with one fatal error, when the child is killed before it is ready', async () => {
    const fatalErrors = vi.fn();
    mockStore.subscribe('FATAL_ERROR', fatalErrors);
    let outcome: unknown;
    runTestRunner({ channel: mockChannel, store: mockStore, storybook: mockStorybook }).then(
      () => (outcome = 'resolved'),
      (error) => (outcome = error)
    );
    await childSpawned();

    exitChild(null, 'SIGKILL');

    await vi.waitFor(() => expect(outcome).toBeInstanceOf(Error));
    expect(fatalErrors).toHaveBeenCalledTimes(1);
  });

  it('should not add listeners when the child boots again after crashes', async () => {
    const subscribe = vi.spyOn(mockStore, 'subscribe');
    const processListeners = () =>
      (['exit', 'SIGINT', 'SIGTERM'] as const).map((event) => process.listenerCount(event));
    const bootAndCrash = async () => {
      vi.mocked(executeNodeCommand).mockClear();
      const promise = runTestRunner({
        channel: mockChannel,
        store: mockStore,
        storybook: mockStorybook,
      });
      await childSpawned();
      message({ type: 'ready' });
      await promise;
      exitChild(1, null);
    };

    await bootAndCrash();
    const afterFirstBoot = processListeners();
    await bootAndCrash();
    await bootAndCrash();
    await bootAndCrash();

    expect(processListeners()).toEqual(afterFirstBoot);
    expect(subscribe.mock.calls.filter(([type]) => type === 'FATAL_ERROR')).toHaveLength(1);
  });

  it('should close the open run when a ready child reports an uncaught error and exits', async () => {
    const promise = runTestRunner({
      channel: mockChannel,
      store: mockStore,
      storybook: mockStorybook,
    });
    await childSpawned();
    message({ type: 'ready' });
    await promise;
    mockStore.setState((s) => ({
      ...s,
      cancelling: true,
      currentRun: { ...s.currentRun, startedAt: 1000, finishedAt: undefined },
    }));

    message({
      type: 'uncaught-error',
      payload: {
        message: 'Uncaught exception in the test runner process',
        error: { message: 'x' },
      },
    });
    exitChild(1, null);

    expect(mockStore.getState().cancelling).toBe(false);
    expect(mockStore.getState().currentRun.finishedAt).toEqual(expect.any(Number));
  });

  it('should report one fatal error when the exit arrives before the uncaught-error message', async () => {
    const fatalErrors = vi.fn();
    mockStore.subscribe('FATAL_ERROR', fatalErrors);
    const promise = runTestRunner({
      channel: mockChannel,
      store: mockStore,
      storybook: mockStorybook,
    });
    await childSpawned();

    exitChild(1, null);
    message({
      type: 'uncaught-error',
      payload: {
        message: 'Uncaught exception in the test runner process',
        error: { message: 'x' },
      },
    });
    await promise.catch(() => {});

    expect(fatalErrors).toHaveBeenCalledTimes(1);
  });

  it('should queue the next trigger when the child dies while its ready handler fetches the index', async () => {
    const pendingIndex = deferredIndex();
    storyIndexGenerator.getIndex.mockReturnValueOnce(pendingIndex.promise);
    bootOnTrigger();
    mockStore.send({ type: 'TRIGGER_RUN', payload: { triggeredBy: 'global', storyIds: ['a'] } });
    await childSpawned();
    message({ type: 'ready' });
    exitChild(null, 'SIGKILL');
    pendingIndex.resolve(storyIndex);
    await vi.advanceTimersByTimeAsync(0);
    vi.mocked(executeNodeCommand).mockClear();
    child.send.mockClear();

    mockStore.send({ type: 'TRIGGER_RUN', payload: { triggeredBy: 'global', storyIds: ['b'] } });
    await childSpawned();
    message({ type: 'ready' });

    await vi.waitFor(() => expect(sentTypes()).toEqual(['index:', 'TRIGGER_RUN:b']));
  });

  it('should fail the boot at once, with one fatal error, when the child reports a fatal error before it is ready', async () => {
    const fatalErrors = vi.fn();
    mockStore.subscribe('FATAL_ERROR', fatalErrors);
    let outcome: unknown;
    runTestRunner({ channel: mockChannel, store: mockStore, storybook: mockStorybook }).then(
      () => (outcome = 'resolved'),
      (error) => (outcome = error)
    );
    await childSpawned();

    mockStore.send({
      type: 'FATAL_ERROR',
      payload: { message: 'Failed to start Vitest', error: { message: 'x' } },
    });
    exitChild(1, null);

    await vi.waitFor(() => expect(outcome).toBeInstanceOf(Error));
    expect(fatalErrors).toHaveBeenCalledTimes(1);
  });

  describe('with one fake child per spawn', () => {
    type FakeChild = ReturnType<typeof fakeChild>;
    const fakeChild = () => {
      const handlers: Record<string, (...args: any[]) => void> = {};
      return {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, handler: (...args: any[]) => void) => {
          handlers[event] = handler;
        }),
        send: vi.fn(),
        kill: vi.fn(),
        message: (event: unknown) => handlers.message(event),
        exit: (code: number | null, signal: string | null) => handlers.exit(code, signal),
      };
    };
    let spawned: FakeChild[];
    const typesSentTo = (target: FakeChild) =>
      target.send.mock.calls
        .filter(([event]) => !isStoreStateMessage(event))
        .map(([event]) =>
          event.type === STORE_CHANNEL_EVENT_NAME
            ? `${event.args[0].event.type}:${event.args[0].event.payload.storyIds}`
            : event.type === STORY_INDEX_CHANNEL_EVENT_NAME
              ? 'index'
              : event.type
        );
    const trigger = (id: string) =>
      mockStore.send({ type: 'TRIGGER_RUN', payload: { triggeredBy: 'global', storyIds: [id] } });
    const fatalError = {
      type: 'FATAL_ERROR' as const,
      payload: { message: 'Failed to start Vitest', error: { message: 'x' } },
    };

    beforeEach(() => {
      spawned = [];
      vi.mocked(executeNodeCommand).mockImplementation(() => {
        const next = fakeChild();
        spawned.push(next);
        return next as never;
      });
    });

    afterEach(() => {
      vi.mocked(executeNodeCommand).mockReturnValue(child as never);
    });

    it('keeps one child per instance, so killing one leaves the other running', async () => {
      const { experimental_MockUniversalStore: MockUniversalStore } =
        await import('@storybook/core/internal/services');
      const other = createTestRunner();
      const otherStore = new MockUniversalStore<StoreState, StoreEvent>(storeOptions);
      const otherStorybook = { ...mockStorybook, workingDir: '/other' } as TestRunnerHost;
      try {
        const first = runTestRunner({
          channel: mockChannel,
          store: mockStore,
          storybook: mockStorybook,
        });
        await vi.waitFor(() => expect(spawned).toHaveLength(1));
        const second = other.run({
          channel: mockChannel,
          store: otherStore,
          storybook: otherStorybook,
        });
        await vi.waitFor(() => expect(spawned).toHaveLength(2));
        spawned[0].message({ type: 'ready' });
        spawned[1].message({ type: 'ready' });
        await Promise.all([first, second]);

        killTestRunner();
        await other.run({ channel: mockChannel, store: otherStore, storybook: otherStorybook });

        expect(spawned.map((target) => target.kill.mock.calls.length)).toEqual([1, 0]);
        expect(vi.mocked(executeNodeCommand).mock.calls.map(([call]) => call.options?.cwd)).toEqual(
          ['/project', '/other']
        );
      } finally {
        other.kill();
      }
    });

    it('should boot one child when two runs are triggered before it spawns', async () => {
      bootOnTrigger();

      trigger('a');
      trigger('b');
      await vi.waitFor(() => expect(spawned).toHaveLength(1));
      spawned[0].message({ type: 'ready' });

      await vi.waitFor(() =>
        expect(typesSentTo(spawned[0])).toEqual(['index', 'TRIGGER_RUN:a', 'TRIGGER_RUN:b'])
      );
      expect(spawned).toHaveLength(1);
    });

    it('should run a trigger sent after a fatal error killed a booting child, even when that child exits later', async () => {
      bootOnTrigger();
      trigger('a');
      await vi.waitFor(() => expect(spawned).toHaveLength(1));

      mockStore.send(fatalError);
      trigger('b');
      await vi.waitFor(() => expect(spawned).toHaveLength(2));
      spawned[0].exit(0, null);
      spawned[1].message({ type: 'ready' });

      await vi.waitFor(() => expect(typesSentTo(spawned[1])).toEqual(['index', 'TRIGGER_RUN:b']));
    });

    it('should boot a new child when a ready child dies while watch mode is on', async () => {
      mockStore.setState((s) => ({ ...s, watching: true }));
      const boot = runTestRunner({
        channel: mockChannel,
        store: mockStore,
        storybook: mockStorybook,
      });
      await vi.waitFor(() => expect(spawned).toHaveLength(1));
      spawned[0].message({ type: 'ready' });
      await boot;

      spawned[0].exit(null, 'SIGKILL');

      await vi.waitFor(() => expect(spawned).toHaveLength(2));
    });

    it('should clear the fatal error once the child restarted in watch mode is ready', async () => {
      mockStore.subscribe('FATAL_ERROR', (event) =>
        mockStore.setState((s) => ({ ...s, fatalError: event.payload }))
      );
      mockStore.setState((s) => ({ ...s, watching: true }));
      const boot = runTestRunner({
        channel: mockChannel,
        store: mockStore,
        storybook: mockStorybook,
      });
      await vi.waitFor(() => expect(spawned).toHaveLength(1));
      spawned[0].message({ type: 'ready' });
      await boot;

      spawned[0].exit(null, 'SIGKILL');
      await vi.waitFor(() => expect(spawned).toHaveLength(2));
      expect(mockStore.getState().fatalError).toBeDefined();
      spawned[1].message({ type: 'ready' });

      await vi.waitFor(() => expect(mockStore.getState().fatalError).toBeUndefined());
    });

    it('should not boot again when the child fails to start while watch mode is on', async () => {
      mockStore.setState((s) => ({ ...s, watching: true }));
      const boot = runTestRunner({
        channel: mockChannel,
        store: mockStore,
        storybook: mockStorybook,
      });
      boot.catch(() => {});
      await vi.waitFor(() => expect(spawned).toHaveLength(1));

      mockStore.send(fatalError);
      spawned[0].exit(1, null);
      await vi.advanceTimersByTimeAsync(1000);

      expect(spawned).toHaveLength(1);
    });

    it('should not spawn a child for a boot that was killed while it read the instance', async () => {
      let releaseInstance!: () => void;
      const instanceRead = new Promise<void>((resolve) => {
        releaseInstance = resolve;
      });
      const getGenerator = vi.mocked(mockStorybook.getStoryIndexGenerator);
      const defaultGetGenerator = getGenerator.getMockImplementation()!;
      getGenerator.mockImplementation(async () => {
        await instanceRead;
        return defaultGetGenerator();
      });
      try {
        const boot = runTestRunner({
          channel: mockChannel,
          store: mockStore,
          storybook: mockStorybook,
        });
        boot.catch(() => {});

        killTestRunner();
        releaseInstance();
        await vi.advanceTimersByTimeAsync(0);

        expect(spawned).toHaveLength(0);
      } finally {
        getGenerator.mockImplementation(defaultGetGenerator);
      }
    });

    it('should not let the start timeout of a killed boot kill the next child', async () => {
      const fatalErrors = vi.fn();
      mockStore.subscribe('FATAL_ERROR', fatalErrors);
      bootOnTrigger();
      trigger('a');
      await vi.waitFor(() => expect(spawned).toHaveLength(1));
      mockStore.send(fatalError);
      trigger('b');
      await vi.waitFor(() => expect(spawned).toHaveLength(2));
      spawned[1].message({ type: 'ready' });

      await vi.advanceTimersByTimeAsync(30_001);

      expect(spawned[1].kill).not.toHaveBeenCalled();
      expect(fatalErrors).toHaveBeenCalledTimes(1);
    });
  });
});
