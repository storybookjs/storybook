import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Channel, type ChannelTransport } from 'storybook/internal/channels';
import { executeNodeCommand } from 'storybook/internal/common';
import type { Options } from 'storybook/internal/types';

import { storeOptions } from '../constants';
import { log } from '../logger';
import type { StoreEvent } from '../types';
import type { StoreState } from '../types';
import { killTestRunner, runTestRunner } from './boot-test-runner';

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
  } as Options;

  beforeEach(async () => {
    const { experimental_MockUniversalStore: MockUniversalStore } =
      await import('storybook/internal/core-server');
    mockStore = new MockUniversalStore<StoreState, StoreEvent>(storeOptions);
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
    const promise = runTestRunner({
      channel: mockChannel,
      store: mockStore,
      options: mockOptions,
    });
    vi.advanceTimersByTime(30001);
    await expect(promise).rejects.toThrow();
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
