import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Channel } from 'storybook/internal/channels';
import {
  createFileSystemCache,
  getFrameworkName,
  loadPreviewOrConfigFile,
  resolvePathInStorybookCache,
} from 'storybook/internal/common';
import {
  experimental_UniversalStore,
  experimental_getTestProviderStore,
} from 'storybook/internal/core-server';
import { cleanPaths, oneWayHash, sanitizeError, telemetry } from 'storybook/internal/telemetry';
import type { Options } from 'storybook/internal/types';

import { TRIGGER_TEST_RUN_REQUEST, TRIGGER_TEST_RUN_RESPONSE } from './constants.ts';
import { experimental_serverChannel } from './preset.ts';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/core-server', { spy: true });
vi.mock('./node/boot-test-runner.ts', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('storybook/internal/telemetry', { spy: true });

describe('preset experimental_serverChannel', () => {
  let channel: Channel;
  let emitSpy: ReturnType<typeof vi.spyOn<Channel, 'emit'>>;
  let mockApply: ReturnType<typeof vi.fn>;
  let mockOptions: Options;
  let mockUnsubscribe: ReturnType<typeof vi.fn>;
  let mockStore: {
    untilReady: ReturnType<typeof vi.fn>;
    getState: ReturnType<typeof vi.fn>;
    setState: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    onStateChange: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockApply = vi.fn().mockImplementation((key) => {
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

    mockOptions = {
      configDir: '.storybook',
      presets: {
        apply: mockApply,
      },
    } as unknown as Options;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    vi.mocked(createFileSystemCache).mockReturnValue({
      get: vi.fn().mockImplementation((key, defaultValue) => Promise.resolve(defaultValue ?? {})),
      set: vi.fn().mockResolvedValue(undefined),
    } as any);
    vi.mocked(getFrameworkName).mockResolvedValue('react-vite');
    vi.mocked(loadPreviewOrConfigFile).mockReturnValue(undefined);
    vi.mocked(resolvePathInStorybookCache).mockReturnValue('/tmp/storybook-cache');

    mockUnsubscribe = vi.fn();
    mockStore = {
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

    vi.mocked(experimental_UniversalStore.create).mockReturnValue(mockStore as any);
    vi.mocked(experimental_getTestProviderStore).mockReturnValue({
      setState: vi.fn(),
      onClearAll: vi.fn(),
    } as any);

    vi.mocked(cleanPaths).mockImplementation((x) => x);
    vi.mocked(oneWayHash).mockImplementation((x) => x);
    vi.mocked(sanitizeError).mockImplementation((x) => x);
    vi.mocked(telemetry).mockResolvedValue(undefined as any);
    /* eslint-enable @typescript-eslint/no-explicit-any */

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
