import { describe, expect, it, vi } from 'vitest';

import type { StoryIndex } from 'storybook/internal/types';

import type { TestRunResult } from './definition.ts';
import {
  TRIGGER_TEST_RUN_REQUEST,
  TRIGGER_TEST_RUN_RESPONSE,
  createAsyncQueue,
  runStoryTests,
  type TestChannel,
  type TriggerTestRunResponse,
} from './run.ts';

function createMockChannel(): TestChannel & {
  handlers: Map<string, Array<(payload: TriggerTestRunResponse) => void>>;
} {
  const handlers = new Map<string, Array<(payload: TriggerTestRunResponse) => void>>();

  return {
    handlers,
    on(event, listener) {
      const list = handlers.get(event) ?? [];
      list.push(listener as (payload: TriggerTestRunResponse) => void);
      handlers.set(event, list);
    },
    off(event, listener) {
      const list = handlers.get(event) ?? [];
      handlers.set(
        event,
        list.filter((l) => l !== listener)
      );
    },
    emit() {},
  };
}

function respond(channel: ReturnType<typeof createMockChannel>, response: TriggerTestRunResponse) {
  for (const listener of channel.handlers.get(TRIGGER_TEST_RUN_RESPONSE) ?? []) {
    listener(response);
  }
}

const index: StoryIndex = {
  v: 5,
  entries: {
    'button--primary': {
      type: 'story',
      subtype: 'story',
      id: 'button--primary',
      name: 'Primary',
      title: 'Button',
      importPath: './src/Button.stories.tsx',
      tags: ['story'],
    },
  },
};

const sampleResult = {
  config: { a11y: true },
  componentTestStatuses: [],
  a11yStatuses: [],
  componentTestCount: { success: 0, error: 0 },
  a11yCount: { success: 0, warning: 0, error: 0 },
  a11yReports: {},
  reports: {},
  unhandledErrors: [],
} satisfies TestRunResult;

describe('createAsyncQueue', () => {
  it('serializes concurrent waiters', async () => {
    const queue = createAsyncQueue();
    const order: number[] = [];

    const first = (async () => {
      const done = await queue.wait();
      order.push(1);
      await new Promise((r) => setTimeout(r, 20));
      order.push(2);
      done();
    })();

    const second = (async () => {
      const done = await queue.wait();
      order.push(3);
      done();
    })();

    await Promise.all([first, second]);
    expect(order).toEqual([1, 2, 3]);
  });
});

describe('runStoryTests', () => {
  it('returns no-stories when focused selectors match nothing', async () => {
    const channel = createMockChannel();
    const emitSpy = vi.spyOn(channel, 'emit');

    const result = await runStoryTests({
      channel,
      getIndex: async () => index,
      stories: [{ storyId: 'missing--story' }],
    });

    expect(result).toEqual({ status: 'no-stories' });
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('maps a completed channel response', async () => {
    const channel = createMockChannel();
    channel.emit = (event, payload) => {
      if (event === TRIGGER_TEST_RUN_REQUEST) {
        const { requestId } = payload as { requestId: string };
        queueMicrotask(() =>
          respond(channel, {
            requestId,
            status: 'completed',
            result: sampleResult,
          })
        );
      }
    };

    const result = await runStoryTests({
      channel,
      getIndex: async () => index,
      stories: [{ storyId: 'button--primary' }],
    });

    expect(result).toEqual({ status: 'completed', result: sampleResult });
  });

  it('maps an error channel response', async () => {
    const channel = createMockChannel();
    channel.emit = (event, payload) => {
      if (event === TRIGGER_TEST_RUN_REQUEST) {
        const { requestId } = payload as { requestId: string };
        queueMicrotask(() =>
          respond(channel, {
            requestId,
            status: 'error',
            error: { message: 'Tests are already running' },
          })
        );
      }
    };

    const result = await runStoryTests({
      channel,
      getIndex: async () => index,
    });

    expect(result).toEqual({
      status: 'error',
      error: { message: 'Tests are already running' },
    });
  });

  it('maps a cancelled channel response', async () => {
    const channel = createMockChannel();
    channel.emit = (event, payload) => {
      if (event === TRIGGER_TEST_RUN_REQUEST) {
        const { requestId } = payload as { requestId: string };
        queueMicrotask(() => respond(channel, { requestId, status: 'cancelled' }));
      }
    };

    const result = await runStoryTests({
      channel,
      getIndex: async () => index,
    });

    expect(result).toEqual({ status: 'cancelled' });
  });

  it('ignores responses for other requestIds', async () => {
    const channel = createMockChannel();
    channel.emit = (event, payload) => {
      if (event === TRIGGER_TEST_RUN_REQUEST) {
        const { requestId } = payload as { requestId: string };
        queueMicrotask(() => {
          respond(channel, { requestId: 'other-id', status: 'cancelled' });
          respond(channel, {
            requestId,
            status: 'completed',
            result: sampleResult,
          });
        });
      }
    };

    const result = await runStoryTests({
      channel,
      getIndex: async () => index,
    });

    expect(result).toEqual({ status: 'completed', result: sampleResult });
  });

  it('returns an error when the channel response never arrives', async () => {
    vi.useFakeTimers();
    const channel = createMockChannel();
    channel.emit = () => {};

    const pending = runStoryTests({
      channel,
      getIndex: async () => index,
      timeoutMs: 1000,
    });

    await vi.advanceTimersByTimeAsync(1000);
    const result = await pending;

    expect(result.status).toBe('error');
    expect(result).toMatchObject({
      status: 'error',
      error: {
        message: expect.stringContaining('Timed out after 1000ms'),
      },
    });
    expect(channel.handlers.get(TRIGGER_TEST_RUN_RESPONSE) ?? []).toHaveLength(0);

    vi.useRealTimers();
  });
});
