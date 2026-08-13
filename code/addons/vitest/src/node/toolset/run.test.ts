import { describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';

import type { StoryIndex } from 'storybook/internal/types';

import { TRIGGER_TEST_RUN_REQUEST, TRIGGER_TEST_RUN_RESPONSE } from '../../constants.ts';
import { createTestToolset, type TestRunResult } from './definition.ts';
import {
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
  it('rejects when the story index cannot be loaded', async () => {
    await expect(
      runStoryTests({
        channel: createMockChannel(),
        getIndex: async () => {
          throw new Error('index unavailable');
        },
        stories: [{ storyId: 'button--primary' }],
      })
    ).rejects.toThrow('index unavailable');
  });

  it('returns no-stories with the per-selector messages when nothing matched', async () => {
    const channel = createMockChannel();
    const emitSpy = vi.spyOn(channel, 'emit');

    const result = await runStoryTests({
      channel,
      getIndex: async () => index,
      stories: [{ storyId: 'missing--story' }],
    });

    expect(result).toEqual({
      status: 'no-stories',
      notFoundMessages: ['No story found for story ID "missing--story"'],
    });
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('returns an error when some selectors resolve and others miss', async () => {
    const channel = createMockChannel();
    const emitSpy = vi.spyOn(channel, 'emit');

    const result = await runStoryTests({
      channel,
      getIndex: async () => index,
      stories: [{ storyId: 'button--primary' }, { storyId: 'missing--story' }],
    });

    expect(result.status).toBe('error');
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('returns no-stories when the focused selector list is empty', async () => {
    const channel = createMockChannel();
    const emitSpy = vi.spyOn(channel, 'emit');

    const result = await runStoryTests({
      channel,
      getIndex: async () => index,
      stories: [],
    });

    expect(result).toEqual({ status: 'no-stories', notFoundMessages: [] });
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

describe('createTestToolset channel identity', () => {
  it('runs the request/response over the same channel object the toolset was created with', async () => {
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

    const toolset = createTestToolset({
      channel,
      storyIndex: { getIndex: async () => index },
      a11yEnabled: false,
    });
    const outcome = await toolset.methods.run.handler(
      v.parse(toolset.methods.run.input, {
        stories: [{ storyId: 'button--primary' }],
        a11y: false,
      }),
      {
        transport: 'cli',
        getService: () => {
          throw new Error('unused');
        },
      }
    );

    expect(outcome.ok).toBe(true);
    expect(outcome.data).toMatchObject({ status: 'completed', a11y: false });
  });
});
