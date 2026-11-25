import { describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';

import { createStoriesToolset } from 'storybook/internal/core-server';
import { CHANGE_DETECTION_STATUS_TYPE_ID } from 'storybook/internal/types';
import type { StoryIndex } from 'storybook/internal/types';
import { clearToolsetRegistry, getToolset, registerToolset } from 'storybook/open-service';

import {
  TRIGGER_TEST_RUN_REQUEST,
  TRIGGER_TEST_RUN_RESPONSE,
  type TriggerTestRunRequestPayload,
} from '../../constants.ts';
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

// A channel that answers every run request with `result`, recording the requested ids and files.
function respondingChannel(result: TestRunResult = sampleResult) {
  const channel = createMockChannel();
  const requested: unknown[] = [];
  const requestedFiles: unknown[] = [];
  channel.emit = (event, payload) => {
    if (event === TRIGGER_TEST_RUN_REQUEST) {
      const { requestId, storyIds, files } = payload as TriggerTestRunRequestPayload;
      requested.push(storyIds);
      requestedFiles.push(files);
      queueMicrotask(() => respond(channel, { requestId, status: 'completed', result }));
    }
  };
  return { channel, requested, requestedFiles };
}

function channelResponding(response: Omit<TriggerTestRunResponse, 'requestId'>) {
  const channel = createMockChannel();
  channel.emit = (event, payload) => {
    if (event === TRIGGER_TEST_RUN_REQUEST) {
      const { requestId } = payload as { requestId: string };
      queueMicrotask(() => respond(channel, { requestId, ...response }));
    }
  };
  return channel;
}

const LISTEN_EPERM = {
  name: 'Error',
  message: 'listen EPERM: operation not permitted ::1:63315',
  stack:
    'Error: listen EPERM: operation not permitted ::1:63315\n    at Server.setupListenHandle [as _listen2] (node:net:1918:21)',
};

describe('runStoryTests on a system that refuses ports', () => {
  it('fails a run that a blocked port stopped, instead of reporting it as an unhandled error', async () => {
    const result = await runStoryTests({
      channel: channelResponding({
        status: 'completed',
        result: { ...sampleResult, unhandledErrors: [LISTEN_EPERM] },
      }),
      getIndex: async () => index,
    });

    expect(result).toEqual({
      status: 'error',
      error: {
        message:
          'The tests did not run: the system did not permit opening a port (`listen EPERM: operation not permitted ::1:63315`). This is not a problem in the code. If this command runs in a sandbox, re-run it with escalated permissions, outside the sandbox.',
      },
    });
  });

  it('fails the same way when the refused port arrives as a run error', async () => {
    const result = await runStoryTests({
      channel: channelResponding({
        status: 'error',
        error: { message: 'Failed to run tests', error: LISTEN_EPERM },
      }),
      getIndex: async () => index,
    });

    expect(result).toMatchObject({
      status: 'error',
      error: {
        message: expect.stringContaining('The tests did not run: the system did not permit'),
      },
    });
  });

  it('keeps the report of a run whose tests ran', async () => {
    const ran = {
      ...sampleResult,
      componentTestCount: { success: 1, error: 0 },
      unhandledErrors: [LISTEN_EPERM],
    };
    const result = await runStoryTests({
      channel: channelResponding({ status: 'completed', result: ran }),
      getIndex: async () => index,
    });

    expect(result).toEqual({ status: 'completed', result: ran });
  });

  it('leaves other unhandled errors to the report', async () => {
    const other = {
      ...sampleResult,
      unhandledErrors: [{ name: 'Error', message: 'listen EADDRINUSE: address already in use' }],
    };
    const result = await runStoryTests({
      channel: channelResponding({ status: 'completed', result: other }),
      getIndex: async () => index,
    });

    expect(result).toEqual({ status: 'completed', result: other });
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

  it('returns no-stories with the per-selector messages when no story id matched', async () => {
    const { channel, requested } = respondingChannel();

    const result = await runStoryTests({
      channel,
      getIndex: async () => index,
      stories: [{ storyId: 'missing--story' }],
    });

    expect(result).toEqual({
      status: 'no-stories',
      notFoundMessages: [expect.stringContaining('No story found for story ID "missing--story"')],
      selection: { inputStoryCount: 1 },
    });
    expect(requested).toEqual([]);
  });

  it('runs the story ids that resolve and reports the ones that miss', async () => {
    const { channel, requested } = respondingChannel();

    const result = await runStoryTests({
      channel,
      getIndex: async () => index,
      stories: [{ storyId: 'button--primary' }, { storyId: 'missing--story' }],
    });

    expect(requested).toEqual([['button--primary']]);
    expect(result).toMatchObject({
      status: 'completed',
      notFoundMessages: [expect.stringContaining('No story found for story ID "missing--story"')],
    });
  });

  it('returns no-stories when the focused selector list is empty', async () => {
    const { channel, requested } = respondingChannel();

    const result = await runStoryTests({ channel, getIndex: async () => index, stories: [] });

    expect(result).toEqual({
      status: 'no-stories',
      notFoundMessages: [],
      selection: { inputStoryCount: 0 },
    });
    expect(requested).toEqual([]);
  });

  it('runs every story without a selection', async () => {
    const { channel, requested } = respondingChannel();

    const result = await runStoryTests({ channel, getIndex: async () => index });

    expect(requested).toEqual([undefined]);
    expect(result).toEqual({ status: 'completed', result: sampleResult });
  });

  it('passes file filters on as they are, and takes what they matched from the run', async () => {
    const { channel, requested, requestedFiles } = respondingChannel({
      ...sampleResult,
      storyIds: ['button--primary'],
      matchedFileCount: 1,
    });

    const result = await runStoryTests({
      channel,
      getIndex: async () => index,
      files: ['button'],
    });

    expect(requested).toEqual([undefined]);
    expect(requestedFiles).toEqual([['button']]);
    expect(result).toMatchObject({
      status: 'completed',
      selection: { files: { filters: ['button'], storyFileCount: 1 }, storyCount: 1 },
    });
  });

  it('fails when the file filters match no story file', async () => {
    const { channel } = respondingChannel({ ...sampleResult, storyIds: [], matchedFileCount: 0 });

    const result = await runStoryTests({
      channel,
      getIndex: async () => index,
      files: ['src/Button.tsx'],
    });

    expect(result).toEqual({
      status: 'no-stories',
      notFoundMessages: ['No story files found for `src/Button.tsx`.'],
      selection: { files: { filters: ['src/Button.tsx'], storyFileCount: 0 }, storyCount: 0 },
    });
  });

  it('treats an empty filter list as no filter, as Vitest does', async () => {
    const { channel, requested } = respondingChannel();

    await runStoryTests({ channel, getIndex: async () => index, files: [] });

    expect(requested).toEqual([undefined]);
  });

  describe('changed', () => {
    it('runs exactly the stories that stories changed lists', async () => {
      const { channel, requested } = respondingChannel();

      const result = await runStoryTests({
        channel,
        getIndex: async () => index,
        changed: true,
        getChangedStories: async () => ({
          storyIds: ['button--primary'],
          changedConfigFiles: ['.storybook/preview.ts'],
          pendingFiles: [],
        }),
      });

      expect(requested).toEqual([['button--primary']]);
      expect(result).toMatchObject({
        status: 'completed',
        selection: {
          changed: {
            storyCount: 1,
            changedConfigFiles: ['.storybook/preview.ts'],
            pendingFiles: [],
          },
          storyCount: 1,
        },
      });
    });

    it('asks for the changes since a ref, and records the ref', async () => {
      const { channel } = respondingChannel();
      const getChangedStories = vi.fn(async () => ({
        storyIds: ['button--primary'],
        changedConfigFiles: [],
        pendingFiles: [],
      }));

      const result = await runStoryTests({
        channel,
        getIndex: async () => index,
        changed: 'next',
        getChangedStories,
      });

      expect(getChangedStories).toHaveBeenCalledExactlyOnceWith('next');
      expect(result).toMatchObject({
        selection: {
          changed: { storyCount: 1, changedConfigFiles: [], pendingFiles: [], since: 'next' },
        },
      });
    });

    it('passes without running when no story changed, as Vitest does', async () => {
      const { channel, requested } = respondingChannel();

      const result = await runStoryTests({
        channel,
        getIndex: async () => index,
        changed: true,
        getChangedStories: async () => ({ storyIds: [], changedConfigFiles: [], pendingFiles: [] }),
      });

      expect(result).toEqual({
        status: 'no-stories',
        notFoundMessages: [],
        selection: { changed: { storyCount: 0, changedConfigFiles: [], pendingFiles: [] } },
      });
      expect(requested).toEqual([]);
    });

    it('runs only the stories both a file filter and the changes select', async () => {
      const { channel, requested, requestedFiles } = respondingChannel({
        ...sampleResult,
        storyIds: [],
        matchedFileCount: 1,
      });

      const result = await runStoryTests({
        channel,
        getIndex: async () => index,
        files: ['button'],
        changed: true,
        getChangedStories: async () => ({
          storyIds: ['header--default'],
          changedConfigFiles: [],
          pendingFiles: [],
        }),
      });

      expect(requested).toEqual([['header--default']]);
      expect(requestedFiles).toEqual([['button']]);
      expect(result).toMatchObject({
        status: 'no-stories',
        notFoundMessages: [],
        selection: { files: { storyFileCount: 1 }, storyCount: 0 },
      });
    });

    it('passes when no story file matches the filters, as Vitest does with --changed', async () => {
      const { channel } = respondingChannel({ ...sampleResult, storyIds: [], matchedFileCount: 0 });

      const result = await runStoryTests({
        channel,
        getIndex: async () => index,
        files: ['src/Button.tsx'],
        changed: true,
        getChangedStories: async () => ({
          storyIds: ['button--primary'],
          changedConfigFiles: [],
          pendingFiles: [],
        }),
      });

      expect(result).toMatchObject({
        status: 'no-stories',
        notFoundMessages: [],
        selection: { files: { storyFileCount: 0 } },
      });
    });

    it('fails on an unknown ref or story id before Vitest is asked for the story files', async () => {
      const { channel, requested } = respondingChannel();
      const unknownRef = new Error('`nope` is not a known git ref.');

      await expect(
        runStoryTests({
          channel,
          getIndex: async () => index,
          files: ['src/Button.tsx'],
          changed: 'nope',
          getChangedStories: async () => {
            throw unknownRef;
          },
        })
      ).rejects.toBe(unknownRef);

      const result = await runStoryTests({
        channel,
        getIndex: async () => index,
        files: ['src/Button.tsx'],
        changed: true,
        stories: [{ storyId: 'missing--story' }],
        getChangedStories: async () => ({ storyIds: [], changedConfigFiles: [], pendingFiles: [] }),
      });

      expect(result).toMatchObject({
        status: 'no-stories',
        notFoundMessages: ['No story found for story ID "missing--story"'],
      });
      expect(requested).toEqual([]);
    });
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

describe('test run --changed and stories changed', () => {
  it('select the same stories for the same working tree', async () => {
    const parityIndex: StoryIndex = {
      v: 5,
      entries: Object.fromEntries(
        ['button--primary', 'header--default', 'page--default'].map((id) => [
          id,
          {
            type: 'story',
            subtype: 'story',
            id,
            name: id,
            title: id,
            importPath: `./src/${id}.stories.tsx`,
            tags: ['story'],
          },
        ])
      ),
    };
    const status = (storyId: string, value: string) => ({
      [storyId]: {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: {
          storyId,
          typeId: CHANGE_DETECTION_STATUS_TYPE_ID,
          value,
          title: '',
          description: '',
        },
      },
    });
    const moduleGraph = {
      queries: {
        status: { loaded: async () => ({ value: 'ready' }) },
        changeDetectionReadiness: { loaded: async () => ({ status: 'ready' }) },
      },
      commands: { storiesForFiles: async () => [] },
    };
    const ctx = { transport: 'cli' as const, getService: () => moduleGraph as never };

    clearToolsetRegistry();
    registerToolset(
      createStoriesToolset({
        storyIndex: { getIndex: async () => parityIndex },
        git: {
          getRepoRoot: async () => process.cwd(),
          getChangedFiles: async () => ({ changed: new Set<string>(), new: new Set<string>() }),
        },
        changeStatuses: {
          getAll: () =>
            ({
              ...status('button--primary', 'status-value:new'),
              ...status('page--default', 'status-value:affected'),
              ...status('header--default', 'status-value:unknown'),
            }) as never,
        },
        storybookDirs: {
          configDir: `${process.cwd()}/.storybook`,
          getStaticDirs: async () => [],
          getStoriesMatcher: async () => () => false,
        },
      })
    );
    const { channel, requested } = respondingChannel();
    const testToolset = createTestToolset({
      channel,
      storyIndex: { getIndex: async () => parityIndex },
      a11yEnabled: false,
    });

    let listed;
    try {
      listed = await getToolset('stories').methods.changed.handler({}, ctx);
      await testToolset.methods.run.handler(
        v.parse(testToolset.methods.run.input, { changed: true }),
        ctx
      );
    } finally {
      clearToolsetRegistry();
    }

    const listedIds = listed.data.stories.map((story) => story.storyId);
    expect(listedIds.sort()).toEqual(['button--primary', 'page--default']);
    expect((requested[0] as string[]).sort()).toEqual(listedIds);
  });
});
