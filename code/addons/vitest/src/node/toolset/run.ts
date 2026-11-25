import type { ChannelLike } from 'storybook/internal/channels';
import {
  findStoryIds,
  type FoundStory,
  type NotFoundStory,
  type StoryInput,
} from 'storybook/internal/core-server';
import { OpenServiceTestRunTimeoutError } from 'storybook/internal/server-errors';
import type { StoryIndex } from 'storybook/internal/types';

import { TRIGGER_TEST_RUN_REQUEST, TRIGGER_TEST_RUN_RESPONSE } from '../../constants.ts';
import type { TestRunOutput, TestRunResult, TestRunSelection } from './definition.ts';
import { displayPath } from './format.ts';

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
  /** Vitest file filters, passed on as they are. */
  files?: string[];
  /** Story index import paths of the changed story files. */
  changedFiles?: string[];
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
  files,
  changedFiles,
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
        default: {
          // Type-only: a new response status must be handled here rather than silently
          // rejected. The runtime branch still guards against malformed channel payloads.
          const _exhaustive: never = payload.status;
          settle(() => reject(new Error(`Unexpected test run response: ${_exhaustive}`)));
        }
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
        files,
        changedFiles,
        config,
      });
    } catch (error) {
      settle(() => reject(error instanceof Error ? error : new Error(String(error))));
    }
  });
}

// A story ran when its component test passed or failed.
function findNotRunStoryIds(storyIds: string[], result: TestRunResult): string[] {
  const ran = new Set(
    result.componentTestStatuses
      .filter(({ value }) => value === 'status-value:success' || value === 'status-value:error')
      .map(({ storyId }) => storyId)
  );
  return storyIds.filter((storyId) => !ran.has(storyId));
}

/** What `stories changed` reports, as far as a test run needs it. */
export type ChangedStories = {
  storyIds: string[];
  /** The story files of those stories, as story index import paths. */
  storyFiles: string[];
  /** Changed files in the config directory, which can affect every story. */
  changedConfigFiles: string[];
  /** Changed files change detection has not caught up with, so their stories may be missing. */
  pendingFiles: string[];
};

export type RunStoryTestsParams = {
  channel: TestChannel;
  getIndex: () => Promise<StoryIndex>;
  stories?: StoryInput[];
  /** Story-file filters, which Vitest matches as it matches the file filters of `vitest Button`. */
  files?: string[];
  /**
   * Run the stories `stories changed` lists: `true` for the uncommitted changes, or a git ref to
   * also cover what is committed since it.
   */
  changed?: boolean | string;
  /** The `stories.changed` tool, so both commands share one definition of "changed". */
  getChangedStories?: (since?: string) => Promise<ChangedStories>;
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
  files,
  changed,
  getChangedStories,
  a11y = true,
  actor = 'core/test',
  requestEvent = TRIGGER_TEST_RUN_REQUEST,
  responseEvent = TRIGGER_TEST_RUN_RESPONSE,
  timeoutMs = DEFAULT_TEST_RUN_TIMEOUT_MS,
}: RunStoryTestsParams): Promise<TestRunOutput> {
  let storyIds: string[] | undefined;
  let changedFiles: string[] | undefined;
  let selection: TestRunSelection | undefined;
  const notFoundMessages: string[] = [];

  // Each form narrows the run, as Vitest's file filters, `--changed` and `-t` do together.
  // An empty filter list filters nothing, as in Vitest.
  const filters = files?.length ? files : undefined;
  if (stories || filters || changed) {
    // No default: a caller that forgot to wire it must fail, not read as "nothing changed".
    const since = typeof changed === 'string' ? changed : undefined;
    const changedStories = changed ? await getChangedStories!(since) : undefined;
    selection = {};

    if (filters) {
      // Vitest matches the filters, so how many story files they match is known after the run.
      selection.files = { filters };
    }

    if (changedStories) {
      const { storyIds: changedIds, changedConfigFiles, pendingFiles } = changedStories;
      selection.changed = {
        storyCount: changedIds.length,
        changedConfigFiles,
        pendingFiles,
        ...(since === undefined ? {} : { since }),
      };
      changedFiles = changedStories.storyFiles;
    }

    if (stories) {
      selection.inputStoryCount = stories.length;
      // After `stories changed`, which waits for a story file written a moment ago to be indexed.
      const resolved = findStoryIds(await getIndex(), stories);
      notFoundMessages.push(
        ...resolved
          .filter((story): story is NotFoundStory => !('entry' in story))
          .map((story) => story.errorMessage)
      );
      const found = resolved
        .filter((story): story is FoundStory => 'entry' in story)
        .map((story) => story.entry.id);
      // Story ids are narrowed here, so the runner needs no changed files next to them.
      storyIds = changedStories
        ? found.filter((id) => changedStories.storyIds.includes(id))
        : found;
      changedFiles = undefined;
    }

    // Nothing to run. An unknown story id fails the call; `--changed` that finds nothing passes, as
    // Vitest's `--changed` does ("No affected test files found, exiting with code 0").
    if (storyIds?.length === 0 || changedFiles?.length === 0) {
      return { status: 'no-stories', notFoundMessages, selection };
    }
  }

  let response: TriggerTestRunResponse;
  try {
    response = await triggerTestRun({
      channel,
      requestEvent,
      responseEvent,
      storyIds,
      files: filters,
      changedFiles,
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
      const { result } = response;
      if (selection?.files) {
        selection.files.storyFileCount = result.matchedFileCount ?? 0;
        // Vitest: "No test files found, exiting with code 1", or code 0 with `--changed`, which
        // turns on `passWithNoTests`.
        if (selection.files.storyFileCount === 0 && !changed) {
          notFoundMessages.push(
            `No story files found for ${selection.files.filters.map((file) => `\`${displayPath(file)}\``).join(', ')}.`
          );
        }
        // No story file was left to run, or none of the stories asked for by id is in them
        if (result.storyIds?.length === 0) {
          return { status: 'no-stories', notFoundMessages, selection };
        }
      }
      // With file filters, the runner keeps the stories asked for by id that are in those files
      const notRunStoryIds = stories
        ? findNotRunStoryIds(result.storyIds ?? storyIds ?? [], result)
        : [];
      return {
        status: 'completed',
        result,
        ...(selection ? { selection } : {}),
        ...(notFoundMessages.length > 0 ? { notFoundMessages } : {}),
        ...(notRunStoryIds.length > 0 ? { notRunStoryIds } : {}),
      };
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
    default: {
      // Type-only: a new response status must be mapped here rather than collapsing into a
      // generic error. The runtime branch still guards against malformed channel payloads.
      const _exhaustive: never = response.status;
      return {
        status: 'error',
        error: { message: `Unexpected test run response: ${_exhaustive}` },
      };
    }
  }
}
