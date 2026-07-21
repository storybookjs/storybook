import type { ChannelLike } from 'storybook/internal/channels';
import type { StoryIndex } from 'storybook/internal/types';

import { OpenServiceTestRunTimeoutError } from '../../../../server-errors.ts';
import { findStoryIds, type FoundStory } from '../stories/find-story-ids.ts';
import type { StoryInput } from '../stories/story-input.ts';
import type { TestRunOutput, TestRunResult } from './definition.ts';

/**
 * Channel events owned by addon-vitest. Duplicated here so core/test does not depend on the addon
 * package; keep in sync with `@storybook/addon-vitest` constants.
 */
export const TRIGGER_TEST_RUN_REQUEST = 'storybook/test/trigger-test-run-request';
export const TRIGGER_TEST_RUN_RESPONSE = 'storybook/test/trigger-test-run-response';

/** Default wait for a matching channel response before failing the queued run. */
export const DEFAULT_TEST_RUN_TIMEOUT_MS = 30 * 60 * 1000;

export type TestChannel = Pick<ChannelLike, 'on' | 'off' | 'emit'>;

export type TriggerTestRunResponse = {
  requestId: string;
  status: 'completed' | 'error' | 'cancelled';
  result?: TestRunResult;
  error?: {
    message: string;
    error?: unknown;
  };
};

/**
 * Creates a queue that ensures concurrent callers run one at a time.
 * Call `wait()` for your turn, then call the returned `done()` when finished.
 */
export function createAsyncQueue() {
  let tail: Promise<void> = Promise.resolve();

  async function wait(): Promise<() => void> {
    let done!: () => void;
    const gate = new Promise<void>((resolve) => {
      done = resolve;
    });

    const previousTail = tail;
    tail = previousTail.then(
      () => gate,
      () => gate
    );

    await previousTail.catch(() => {});

    return done;
  }

  return { wait };
}

export type TriggerTestRunParams = {
  channel: TestChannel;
  requestEvent: string;
  responseEvent: string;
  storyIds?: string[];
  config?: Record<string, unknown>;
  actor: string;
  /** Max wait for a matching response. Defaults to {@link DEFAULT_TEST_RUN_TIMEOUT_MS}. */
  timeoutMs?: number;
};

/**
 * Triggers a test run over the Storybook channel and resolves with the matching response.
 * Terminal statuses (`completed` / `error` / `cancelled`) all resolve — callers map them.
 * Rejects on emit failure, unexpected status, or timeout so the serial run queue can unblock.
 */
export function triggerTestRun({
  channel,
  requestEvent,
  responseEvent,
  storyIds,
  config,
  actor,
  timeoutMs = DEFAULT_TEST_RUN_TIMEOUT_MS,
}: TriggerTestRunParams): Promise<TriggerTestRunResponse> {
  return new Promise((resolve, reject) => {
    const requestId = `osa-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      channel.off(responseEvent, handleResponse);
    };

    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    };

    const handleResponse = (payload: TriggerTestRunResponse) => {
      if (payload.requestId !== requestId) {
        return;
      }

      switch (payload.status) {
        case 'completed':
        case 'error':
        case 'cancelled':
          settle(() => resolve(payload));
          break;
        default:
          settle(() => reject(new Error('Unexpected test run response')));
      }
    };

    channel.on(responseEvent, handleResponse);

    timeoutId = setTimeout(() => {
      settle(() => reject(new OpenServiceTestRunTimeoutError({ timeoutMs, requestId })));
    }, timeoutMs);

    try {
      channel.emit(requestEvent, {
        requestId,
        actor,
        storyIds,
        config,
      });
    } catch (error) {
      settle(() => reject(error instanceof Error ? error : new Error(String(error))));
    }
  });
}

export type RunStoryTestsParams = {
  channel: TestChannel;
  getIndex: () => Promise<StoryIndex>;
  stories?: StoryInput[];
  a11y?: boolean;
  actor?: string;
  requestEvent?: string;
  responseEvent?: string;
  /** Max wait for a matching channel response. Defaults to {@link DEFAULT_TEST_RUN_TIMEOUT_MS}. */
  timeoutMs?: number;
};

/**
 * Resolves story selectors, triggers addon-vitest via the channel, and maps the response to the
 * `test.run` output variant (`no-stories` / `completed` / `error` / `cancelled`).
 */
export async function runStoryTests({
  channel,
  getIndex,
  stories,
  a11y = true,
  actor = 'core/test',
  requestEvent = TRIGGER_TEST_RUN_REQUEST,
  responseEvent = TRIGGER_TEST_RUN_RESPONSE,
  timeoutMs = DEFAULT_TEST_RUN_TIMEOUT_MS,
}: RunStoryTestsParams): Promise<TestRunOutput> {
  let storyIds: string[] | undefined;

  if (stories) {
    const index = await getIndex();
    const resolved = findStoryIds(index, stories);
    storyIds = resolved.filter((story): story is FoundStory => 'id' in story).map((s) => s.id);

    if (storyIds.length === 0) {
      return { status: 'no-stories' };
    }
  }

  let response: TriggerTestRunResponse;
  try {
    response = await triggerTestRun({
      channel,
      requestEvent,
      responseEvent,
      storyIds,
      config: { a11y },
      actor,
      timeoutMs,
    });
  } catch (error) {
    return {
      status: 'error',
      error: {
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }

  switch (response.status) {
    case 'completed':
      if (!response.result) {
        return {
          status: 'error',
          error: { message: 'Test run completed but no result was returned' },
        };
      }
      return { status: 'completed', result: response.result };
    case 'error':
      return {
        status: 'error',
        error: {
          message: response.error?.message ?? 'Test run failed with unknown error',
          ...(response.error?.error !== undefined
            ? { error: response.error.error as { message: string } }
            : {}),
        },
      };
    case 'cancelled':
      return { status: 'cancelled' };
    default:
      return {
        status: 'error',
        error: { message: 'Unexpected test run response' },
      };
  }
}
