import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Channel, type ChannelTransport } from 'storybook/internal/channels';
import { executeNodeCommand } from 'storybook/internal/common';
import type { Options, StoryIndex } from 'storybook/internal/types';

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
import { killTestRunner, runTestRunner, sendStoryIndexToTestRunner } from './boot-test-runner.ts';

let stdout: (chunk: Buffer | string) => void;
let stderr: (chunk: Buffer | string) => void;
let message: (event: { type: string; args?: unknown[]; payload?: unknown }) => void;

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
    }
  ),
  send: vi.fn(),
  kill: vi.fn(),
}));

vi.mock('storybook/internal/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/common')>();
  return {
    ...actual,
    executeNodeCommand: vi.fn().mockReturnValue(child),
  };
});

vi.mock('../logger', () => ({
  log: vi.fn(),
}));

vi.mock('../../../../core/src/shared/utils/module', () => ({
  importMetaResolve: vi
    .fn()
    .mockImplementation(() => 'file://' + join(__dirname, '..', '..', 'dist', 'node', 'vitest.js')),
}));

vi.mock('storybook/internal/core-server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/core-server')>();
  return {
    ...actual,
    internal_universalStatusStore: {
      subscribe: vi.fn(() => () => {}),
    },
    internal_universalTestProviderStore: {
      subscribe: vi.fn(() => () => {}),
    },
  };
});

beforeEach(() => {
  vi.useFakeTimers();
  killTestRunner();
});

afterEach(() => {
  vi.useRealTimers();
});

const storyIndex: StoryIndex = { v: 5, entries: {} };
const storyIndexGenerator = { getIndex: vi.fn(async () => storyIndex) };

const childSpawned = () => vi.waitFor(() => expect(executeNodeCommand).toHaveBeenCalled());

const transport = { setHandler: vi.fn(), send: vi.fn() } satisfies ChannelTransport;
const mockChannel = new Channel({ transport });

describe('bootTestRunner', () => {
  let mockStore: InstanceType<
    typeof import('storybook/internal/core-server').experimental_MockUniversalStore<
      StoreState,
      StoreEvent
    >
  >;
  const mockOptions = {
    configDir: '.storybook',
    presets: {
      apply: vi.fn(async (key: string, fallback?: unknown) => {
        switch (key) {
          case 'storyIndexGenerator':
            return storyIndexGenerator;
          case 'previewAnnotations':
            return ['/project/.storybook/preview.ts'];
          default:
            return fallback;
        }
      }),
    },
  } as unknown as Options;

  beforeEach(async () => {
    const { experimental_MockUniversalStore: MockUniversalStore } =
      await import('storybook/internal/core-server');
    mockStore = new MockUniversalStore<StoreState, StoreEvent>(storeOptions);
    vi.mocked(executeNodeCommand).mockClear();
    vi.mocked(log).mockClear();
    child.send.mockClear();
    storyIndexGenerator.getIndex.mockReset();
    storyIndexGenerator.getIndex.mockResolvedValue(storyIndex);
  });

  it('should execute vitest.js', async () => {
    const promise = runTestRunner({ channel: mockChannel, store: mockStore, options: mockOptions });
    await childSpawned();
    expect(vi.mocked(executeNodeCommand)).toHaveBeenCalledWith({
      scriptPath: expect.stringMatching(/vitest\.js$/),
      options: {
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
    const promise = runTestRunner({ channel: mockChannel, store: mockStore, options: mockOptions });
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
      options: mockOptions,
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
      options: mockOptions,
    });
    await childSpawned();
    vi.advanceTimersByTime(30001);
    await expect(promise).rejects.toThrow();
  });

  it('should forward universal store events', async () => {
    const promise = runTestRunner({ channel: mockChannel, store: mockStore, options: mockOptions });
    await childSpawned();
    message({ type: 'ready' });
    await promise;

    mockStore.send({ type: 'TRIGGER_RUN', payload: { triggeredBy: 'global', storyIds: ['foo'] } });
    expect(child.send).toHaveBeenCalledWith({
      args: [
        {
          event: {
            payload: { storyIds: ['foo'], triggeredBy: 'global' },
            type: 'TRIGGER_RUN',
          },
          eventInfo: {
            actor: {
              environment: 'MOCK',
              id: expect.any(String),
              type: 'LEADER',
            },
          },
        },
      ],
      from: 'server',
      type: 'UNIVERSAL_STORE:storybook/test',
    });

    message({ type: 'some-event', args: ['foo'] });
    expect(mockChannel.last('some-event')).toEqual(['foo']);
  });

  it('should deliver universal store events from the child without re-broadcasting them', async () => {
    const promise = runTestRunner({ channel: mockChannel, store: mockStore, options: mockOptions });
    await childSpawned();
    message({ type: 'ready' });
    await promise;
    for (const type of [
      STORE_CHANNEL_EVENT_NAME,
      STATUS_STORE_CHANNEL_EVENT_NAME,
      TEST_PROVIDER_STORE_CHANNEL_EVENT_NAME,
    ]) {
      transport.send.mockClear();
      const bridgedListener = vi.fn();
      mockChannel.on(type, bridgedListener);
      const bridgedEvent = {
        type,
        args: [{ event: { type: '__SET_STATE', payload: {} }, eventInfo: { actor: { id: 'x' } } }],
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

  it('should broadcast child store events to clients exactly once, via the leader forward', async () => {
    const promise = runTestRunner({ channel: mockChannel, store: mockStore, options: mockOptions });
    await childSpawned();
    message({ type: 'ready' });
    await promise;

    const { experimental_UniversalStore } = await import('storybook/internal/core-server');
    (experimental_UniversalStore as any).__prepare(
      mockChannel,
      experimental_UniversalStore.Environment.SERVER
    );
    const leader = experimental_UniversalStore.create({ ...storeOptions, leader: true });
    try {
      await leader.untilReady();
      transport.send.mockClear();

      message({
        type: 'UNIVERSAL_STORE:storybook/test',
        args: [
          {
            event: { type: '__SET_STATE', payload: { state: leader.getState() } },
            eventInfo: {
              actor: {
                id: 'child-follower',
                type: experimental_UniversalStore.ActorType.FOLLOWER,
                environment: experimental_UniversalStore.Environment.SERVER,
              },
            },
          },
        ],
      });

      expect(transport.send).toHaveBeenCalledTimes(1);
      const [forwarded] = transport.send.mock.calls[0];
      expect(forwarded.type).toBe('UNIVERSAL_STORE:storybook/test');
      expect(forwarded.args[0].eventInfo.actor.id).toBe('child-follower');
      expect(forwarded.args[0].eventInfo.forwardingActor).toBeDefined();
    } finally {
      mockChannel.removeAllListeners('UNIVERSAL_STORE:storybook/test');
    }
  });

  it('should resend init event', async () => {
    const promise = runTestRunner({
      channel: mockChannel,
      store: mockStore,
      options: mockOptions,
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
      options: mockOptions,
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
    const promise = runTestRunner({ channel: mockChannel, store: mockStore, options: mockOptions });
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
      options: mockOptions,
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
    child.send.mock.calls.map(([event]) =>
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
        options: mockOptions,
        initEvent: STORE_CHANNEL_EVENT_NAME,
        initArgs: [{ event, eventInfo }],
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
    const promise = runTestRunner({ channel: mockChannel, store: mockStore, options: mockOptions });
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
      options: mockOptions,
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
    const promise = runTestRunner({ channel: mockChannel, store: mockStore, options: mockOptions });
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
    const promise = runTestRunner({ channel: mockChannel, store: mockStore, options: mockOptions });
    await childSpawned();
    await sendStoryIndexToTestRunner(storyIndexGenerator as never);
    message({ type: 'ready' });
    await promise;

    expect(sentTypes()).toEqual(['index:']);
  });

  it('should report a fatal error when the story index generator cannot be loaded', async () => {
    const fatalErrors = vi.fn();
    mockStore.subscribe('FATAL_ERROR', fatalErrors);
    const options = {
      ...mockOptions,
      presets: { apply: vi.fn().mockRejectedValue(new Error('no index')) },
    } as unknown as Options;

    await expect(
      runTestRunner({ channel: mockChannel, store: mockStore, options })
    ).rejects.toThrow('no index');

    expect(fatalErrors).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ message: 'Failed to start test runner process' }),
      }),
      expect.anything()
    );
  });
});
