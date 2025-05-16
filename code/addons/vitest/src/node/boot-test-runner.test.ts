import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Channel, type ChannelTransport } from 'storybook/internal/channels';
import { execaNode } from 'storybook/internal/execa';

import { storeOptions } from '../constants';
import { log } from '../logger';
import type { StoreEvent } from '../types';
import type { StoreState } from '../types';
import { killTestRunner, runTestRunner } from './boot-test-runner';

let stdout: (chunk: any) => void;
let stderr: (chunk: any) => void;
let message: (event: any) => void;

const child = vi.hoisted(() => ({
  stdout: {
    on: vi.fn((event, callback) => {
      stdout = callback;
    }),
  },
  stderr: {
    on: vi.fn((event, callback) => {
      stderr = callback;
    }),
  },
  on: vi.fn((event, callback) => {
    message = callback;
  }),
  send: vi.fn(),
  kill: vi.fn(),
}));

vi.mock('storybook/internal/execa', () => ({
  execaNode: vi.fn().mockReturnValue(child),
}));

vi.mock('../logger', () => ({
  log: vi.fn(),
}));

let statusStoreSubscriber = vi.hoisted(() => undefined);
let testProviderStoreSubscriber = vi.hoisted(() => undefined);

vi.mock('storybook/internal/core-server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/core-server')>();
  return {
    ...actual,
    internal_universalStatusStore: {
      subscribe: (listener: any) => {
        statusStoreSubscriber = listener;
      },
    },
    internal_universalTestProviderStore: {
      subscribe: (listener: any) => {
        testProviderStoreSubscriber = listener;
      },
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

const transport = { setHandler: vi.fn(), send: vi.fn() } satisfies ChannelTransport;
const mockChannel = new Channel({ transport });

describe('bootTestRunner', () => {
  let mockStore: any;

  beforeEach(async () => {
    const { experimental_MockUniversalStore: MockUniversalStore } = await import(
      'storybook/internal/core-server'
    );
    mockStore = new MockUniversalStore<StoreState, StoreEvent>(storeOptions);
  });

  it('should execute vitest.js', async () => {
    runTestRunner(mockChannel, mockStore);
    expect(execaNode).toHaveBeenCalledWith(expect.stringMatching(/vitest\.mjs$/), {
      env: {
        NODE_ENV: 'test',
        TEST: 'true',
        VITEST: 'true',
        VITEST_CHILD_PROCESS: 'true',
      },
      extendEnv: true,
    });
  });

  it('should log stdout and stderr', async () => {
    runTestRunner(mockChannel, mockStore);
    stdout('foo');
    stderr('bar');
    expect(log).toHaveBeenCalledWith('foo');
    expect(log).toHaveBeenCalledWith('bar');
  });

  it('should wait for vitest to be ready', async () => {
    let ready;
    const promise = runTestRunner(mockChannel, mockStore).then(() => {
      ready = true;
    });
    expect(ready).toBeUndefined();
    message({ type: 'ready' });
    await expect(promise).resolves.toBeUndefined();
    expect(ready).toBe(true);
  });

  it('should abort if vitest doesn’t become ready in time', async () => {
    const promise = runTestRunner(mockChannel, mockStore);
    vi.advanceTimersByTime(30001);
    await expect(promise).rejects.toThrow();
  });

  it('should forward universal store events', async () => {
    runTestRunner(mockChannel, mockStore);
    message({ type: 'ready' });

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

  it('should resend init event', async () => {
    runTestRunner(mockChannel, mockStore, 'init', ['foo']);
    message({ type: 'ready' });
    expect(child.send).toHaveBeenCalledWith({
      args: ['foo'],
      from: 'server',
      type: 'init',
    });
  });
});
