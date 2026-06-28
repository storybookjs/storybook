import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Channel } from 'storybook/internal/channels';
import type { Options } from 'storybook/internal/types';

import { TRIGGER_TEST_RUN_REQUEST, TRIGGER_TEST_RUN_RESPONSE } from './constants.ts';
import { experimental_serverChannel } from './preset.ts';

const mockApply = vi.fn().mockImplementation((key) => {
  if (key === 'core') {
    return Promise.resolve({ builder: 'builder-vite' });
  }
  if (key === 'previewAnnotations') {
    return Promise.resolve([]);
  }
  if (key === 'storyIndexGenerator') {
    return Promise.resolve({
      getIndex: vi.fn().mockResolvedValue({ v: 5, entries: {} }),
      onInvalidated: vi.fn(),
    });
  }
  return Promise.resolve(undefined);
});

const mockOptions = {
  configDir: '.storybook',
  presets: {
    apply: mockApply,
  },
} as unknown as Options;

vi.mock('storybook/internal/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/common')>();
  return {
    ...actual,
    createFileSystemCache: vi.fn(() => ({
      get: vi.fn().mockImplementation((key, defaultValue) => Promise.resolve(defaultValue ?? {})),
      set: vi.fn().mockResolvedValue(undefined),
    })),
    getFrameworkName: vi.fn().mockResolvedValue('react-vite'),
    loadPreviewOrConfigFile: vi.fn().mockReturnValue(undefined),
    resolvePathInStorybookCache: vi.fn().mockReturnValue('/tmp/storybook-cache'),
  };
});

const mockUnsubscribe = vi.fn();
const mockStore = {
  untilReady: vi.fn().mockResolvedValue(undefined),
  getState: vi.fn().mockReturnValue({
    currentRun: { startedAt: undefined, finishedAt: undefined },
    config: {},
  }),
  setState: vi.fn(),
  send: vi.fn(),
  subscribe: vi.fn().mockReturnValue(mockUnsubscribe),
  onStateChange: vi.fn(() => () => {}),
};

vi.mock('storybook/internal/core-server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/core-server')>();
  return {
    ...actual,
    experimental_UniversalStore: {
      create: vi.fn(() => mockStore),
    },
    experimental_getTestProviderStore: vi.fn(() => ({
      setState: vi.fn(),
      onClearAll: vi.fn(),
    })),
  };
});

vi.mock('./node/boot-test-runner.ts', () => ({
  runTestRunner: vi.fn(),
}));

vi.mock('storybook/internal/node-logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('storybook/internal/telemetry', () => ({
  cleanPaths: vi.fn((x) => x),
  oneWayHash: vi.fn((x) => x),
  sanitizeError: vi.fn((x) => x),
  telemetry: vi.fn(),
}));

describe('preset experimental_serverChannel', () => {
  let channel: Channel;
  let emitSpy: ReturnType<typeof vi.spyOn<Channel, 'emit'>>;

  beforeEach(() => {
    vi.clearAllMocks();
    channel = new Channel({
      transport: {
        setHandler: vi.fn(),
        send: vi.fn(),
      },
    });
    emitSpy = vi.spyOn(channel, 'emit');
  });

  it('should register TRIGGER_TEST_RUN_REQUEST listener', async () => {
    const onSpy = vi.spyOn(channel, 'on');
    await experimental_serverChannel(channel, mockOptions);

    expect(onSpy).toHaveBeenCalledWith(TRIGGER_TEST_RUN_REQUEST, expect.any(Function));
  });

  it('should successfully subscribe and send TRIGGER_RUN', async () => {
    await experimental_serverChannel(channel, mockOptions);

    const handler = channel.listeners(TRIGGER_TEST_RUN_REQUEST)[0] as (
      ...args: unknown[]
    ) => unknown;
    expect(handler).toBeDefined();

    const payload = {
      requestId: 'test-id',
      actor: 'test-actor',
      storyIds: ['story-1'],
    };

    mockStore.send.mockImplementationOnce(() => {
      const calls = mockStore.subscribe.mock.calls;
      const callbackCall = calls.find((call) => typeof call[0] === 'function');
      const callback = callbackCall ? callbackCall[0] : null;
      if (callback) {
        callback({
          type: 'TEST_RUN_COMPLETED',
          payload: {
            startedAt: 100,
            finishedAt: 200,
            unhandledErrors: [],
          },
        });
      }
    });

    await handler(payload);

    const calls = mockStore.subscribe.mock.calls;
    const subscriptionIndex = calls.findIndex((call) => typeof call[0] === 'function');
    expect(subscriptionIndex).toBeGreaterThanOrEqual(0);

    const subscribeCallOrder = mockStore.subscribe.mock.invocationCallOrder[subscriptionIndex];
    const sendCallOrder = mockStore.send.mock.invocationCallOrder[0];
    expect(subscribeCallOrder).toBeLessThan(sendCallOrder);

    expect(emitSpy).toHaveBeenCalledWith(TRIGGER_TEST_RUN_RESPONSE, {
      requestId: 'test-id',
      status: 'completed',
      result: {
        startedAt: 100,
        finishedAt: 200,
        unhandledErrors: [],
      },
    });

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
