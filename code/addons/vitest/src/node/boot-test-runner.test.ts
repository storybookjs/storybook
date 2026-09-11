import { join } from 'node:path';
import process, * as nodeProcess from 'node:process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Channel, type ChannelTransport } from 'storybook/internal/channels';
import { executeNodeCommand } from 'storybook/internal/common';
import * as coreServer from 'storybook/internal/core-server';
import {
  experimental_MockUniversalStore as MockUniversalStore,
  experimental_UniversalStore as UniversalStore,
  internal_universalStatusStore,
  internal_universalTestProviderStore,
} from 'storybook/internal/core-server';
import { UniversalStoreFollowerTimeoutError } from 'storybook/internal/manager-errors';
import type { Options } from 'storybook/internal/types';

import {
  STATUS_STORE_CHANNEL_EVENT_NAME,
  STORE_CHANNEL_EVENT_NAME,
  TEST_PROVIDER_STORE_CHANNEL_EVENT_NAME,
  storeOptions,
} from '../constants.ts';
import { log } from '../logger.ts';
import type { StoreEvent } from '../types.ts';
import type { StoreState } from '../types.ts';
import { killTestRunner, runTestRunner } from './boot-test-runner.ts';
import { TestManager } from './test-manager.ts';

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

vi.mock('node:process', { spy: true });
vi.mock('storybook/internal/core-server', { spy: true });
vi.mock('./test-manager.ts', { spy: true });

beforeEach(() => {
  vi.useFakeTimers();
  killTestRunner();
});

afterEach(() => {
  vi.useRealTimers();
});

const transport = { setHandler: vi.fn(), send: vi.fn() } satisfies ChannelTransport;
const mockChannel = new Channel({ transport });

describe('bootTestRunner', () => {
  let mockStore: MockUniversalStore<StoreState, StoreEvent>;
  const mockOptions = {
    configDir: '.storybook',
  } as Options;

  beforeEach(() => {
    mockStore = new MockUniversalStore<StoreState, StoreEvent>(storeOptions);
    vi.mocked(coreServer).internal_universalStatusStore = new MockUniversalStore(
      { id: 'storybook/status', initialState: {} },
      vi
    );
    vi.mocked(coreServer).internal_universalTestProviderStore = new MockUniversalStore(
      { id: 'storybook/test-provider', initialState: {} },
      vi
    );
    vi.mocked(internal_universalStatusStore).untilReady = vi.fn();
    vi.mocked(internal_universalTestProviderStore).untilReady = vi.fn();
    vi.mocked(internal_universalStatusStore.subscribe).mockImplementation(() => () => {});
    vi.mocked(internal_universalTestProviderStore.subscribe).mockImplementation(() => () => {});
    vi.mocked(internal_universalStatusStore.untilReady).mockResolvedValue([undefined, undefined]);
    vi.mocked(internal_universalTestProviderStore.untilReady).mockResolvedValue([
      undefined,
      undefined,
    ]);
    Object.assign(vi.mocked(nodeProcess), {
      default: {
        ...process,
        on: vi.fn<typeof process.on>(),
        exit: vi.fn<typeof process.exit>(),
        send: vi.fn<NonNullable<typeof process.send>>(),
      },
    });
    vi.mocked(process.on).mockReturnValue(process);
    vi.mocked(process.exit).mockImplementation(() => undefined as never);
    vi.mocked(process.send!).mockImplementation((event) => {
      message(event as Parameters<typeof message>[0]);
      return true;
    });
    vi.mocked(TestManager).mockImplementation(function () {});
    vi.mocked(executeNodeCommand).mockClear();
    vi.mocked(log).mockClear();
    child.send.mockClear();
  });

  it('should execute vitest.js', async () => {
    const promise = runTestRunner({ channel: mockChannel, store: mockStore, options: mockOptions });
    expect(vi.mocked(executeNodeCommand)).toHaveBeenCalledWith({
      scriptPath: expect.stringMatching(/vitest\.js$/),
      options: {
        env: {
          NODE_ENV: 'test',
          TEST: 'true',
          VITEST: 'true',
          VITEST_CHILD_PROCESS: 'true',
          STORYBOOK_CONFIG_DIR: '.storybook',
        },
        extendEnv: true,
      },
    });
    message({ type: 'ready' });
    await promise;
  });

  it('should log stdout and stderr', async () => {
    const promise = runTestRunner({ channel: mockChannel, store: mockStore, options: mockOptions });
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
    expect(ready).toBeUndefined();
    message({ type: 'ready' });
    await expect(promise).resolves.toBeUndefined();
    expect(ready).toBe(true);
  });

  it('should abort if vitest doesn’t become ready in time', async () => {
    const onFatalError = vi.fn();
    mockStore.subscribe('FATAL_ERROR', onFatalError);
    const promise = runTestRunner({
      channel: mockChannel,
      store: mockStore,
      options: mockOptions,
    });
    vi.advanceTimersByTime(30001);
    await expect(promise).rejects.toThrow();
    expect(onFatalError).toHaveBeenCalledExactlyOnceWith(
      {
        type: 'FATAL_ERROR',
        payload: {
          message: 'Failed to start test runner process',
          error: expect.objectContaining({
            message:
              'Aborting test runner process because it took longer than 30 seconds to start.',
          }),
        },
      },
      expect.anything()
    );
  });

  describe.each(['storybook/status', 'storybook/test-provider'])(
    'when %s fails to become ready',
    (storeId) => {
      let error: UniversalStoreFollowerTimeoutError;

      beforeEach(() => {
        vi.resetModules();
        vi.mocked((UniversalStore as any).__prepare).mockImplementation(() => {});
        vi.mocked(UniversalStore.create<StoreState, StoreEvent>).mockReturnValue(mockStore);
        error = new UniversalStoreFollowerTimeoutError(storeId);
        const followerStore =
          storeId === 'storybook/status'
            ? internal_universalStatusStore
            : internal_universalTestProviderStore;
        vi.mocked(followerStore.untilReady).mockRejectedValue(error);
      });

      afterEach(() => {
        vi.mocked((UniversalStore as any).__prepare).mockReset();
        vi.mocked(UniversalStore.create).mockReset();
      });

      it('should report a follower readiness rejection once and preserve the original error', async () => {
        const originalError = {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: undefined,
        };
        const onFatalError = vi.fn();
        mockStore.subscribe('FATAL_ERROR', onFatalError);
        const promise = runTestRunner({
          channel: mockChannel,
          store: mockStore,
          options: mockOptions,
        });
        const rejection = expect(promise).rejects.toEqual(originalError);

        await import('./vitest.ts');
        await rejection;
        await vi.advanceTimersByTimeAsync(0);
        expect(onFatalError).toHaveBeenCalledExactlyOnceWith(
          {
            type: 'FATAL_ERROR',
            payload: {
              message: 'Failed to synchronize stores in the test runner process',
              error: originalError,
            },
          },
          expect.anything()
        );
        expect(process.exit).toHaveBeenCalledExactlyOnceWith(1);
        expect(TestManager).not.toHaveBeenCalled();
      });
    }
  );

  it('should report an uncaught error after the child is ready', async () => {
    const onFatalError = vi.fn();
    mockStore.subscribe('FATAL_ERROR', onFatalError);
    const promise = runTestRunner({ channel: mockChannel, store: mockStore, options: mockOptions });
    message({ type: 'ready' });
    await promise;

    const payload = {
      message: 'Uncaught exception in the test runner process',
      error: { name: 'Error', message: 'Test runner failed', stack: 'Test runner stack' },
    };
    message({ type: 'uncaught-error', payload });

    expect(onFatalError).toHaveBeenCalledExactlyOnceWith(
      { type: 'FATAL_ERROR', payload },
      expect.anything()
    );
  });

  it('should forward universal store events', async () => {
    const promise = runTestRunner({ channel: mockChannel, store: mockStore, options: mockOptions });
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
    message({ type: 'ready' });
    await promise;
    expect(child.send).toHaveBeenCalledWith({
      args: ['foo'],
      from: 'server',
      type: 'init',
    });
  });
});
