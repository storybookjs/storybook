import { existsSync } from 'node:fs';

import type { ChannelLike } from 'storybook/internal/channels';
import {
  ChangeDetectionUnavailableError,
  filterStoryFiles,
  findChangedFiles,
  findChangedStories,
  findStoryIds,
  type FoundStory,
  type ModuleGraphAccess,
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
        config,
      });
    } catch (error) {
      settle(() => reject(error instanceof Error ? error : new Error(String(error))));
    }
  });
}

// Outside a repository, or without git, the file form still works; the message says so.
function changedFilesError(error: unknown, since: string | undefined, cli: boolean): string {
  const message = error instanceof Error ? error.message : String(error);
  // Vitest reads the token after `--changed` as its ref, so `--changed Button.stories.tsx` asks
  // git for a ref named after a file.
  if (since && !(error instanceof ChangeDetectionUnavailableError) && existsSync(since)) {
    if (!cli) {
      return `\`changed\` takes \`true\` or a git ref, but \`${since}\` is a path. Pass story files in \`files\`.`;
    }
    return `\`--changed\` took \`${since}\` as the git ref to compare with, but it is a path. As in Vitest, the argument right after \`--changed\` is its ref: put file arguments before \`--changed\`.`;
  }
  return error instanceof ChangeDetectionUnavailableError
    ? `\`--changed\` reads the changed files from git, but ${message === 'not a git repository' ? 'this project is not in a git repository' : message}. Pass story files instead.`
    : `\`--changed\` could not read the changed files from git: ${message}`;
}

export type RunStoryTestsParams = {
  channel: TestChannel;
  getIndex: () => Promise<StoryIndex>;
  stories?: StoryInput[];
  /** Story-file filters, matched the way Vitest matches its file filters. */
  files?: string[];
  /** Vitest's `--changed`: `true` for the uncommitted changes, or a ref to also read changes since. */
  changed?: boolean | string;
  /** The module graph that maps a changed file to the stories that depend on it. */
  getModuleGraph?: () => ModuleGraphAccess | undefined;
  /** The transport the call came over, for messages that name its argument syntax. */
  transport?: string;
  /** Reads the changed files from git; injectable for tests. */
  getChangedFiles?: typeof findChangedFiles;
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
  getModuleGraph = () => undefined,
  getChangedFiles = findChangedFiles,
  transport = 'cli',
  a11y = true,
  actor = 'core/test',
  requestEvent = TRIGGER_TEST_RUN_REQUEST,
  responseEvent = TRIGGER_TEST_RUN_RESPONSE,
  timeoutMs = DEFAULT_TEST_RUN_TIMEOUT_MS,
}: RunStoryTestsParams): Promise<TestRunOutput> {
  let storyIds: string[] | undefined;
  let selection: TestRunSelection | undefined;
  let notFoundMessages: string[] = [];

  // Each form narrows the selection, as Vitest's file filters, `--changed` and `-t` do together.
  // `undefined` stands for every story.
  // An empty filter list filters nothing, as in Vitest.
  const filters = files?.length ? files : undefined;
  if (stories || filters || changed) {
    const index = await getIndex();
    let candidates: Set<string> | undefined;
    const narrow = (ids: string[]) => {
      candidates = new Set(candidates ? ids.filter((id) => candidates!.has(id)) : ids);
    };
    selection = {};

    if (filters) {
      const matched = filterStoryFiles({ index, filters });
      selection.files = { filters, storyFiles: matched.storyFiles.length };
      if (matched.storyFiles.length === 0) {
        // Vitest: "No test files found, exiting with code 1", or code 0 with `--changed`, which
        // turns on `passWithNoTests`.
        return {
          status: 'no-stories',
          notFoundMessages: changed
            ? []
            : [
                `No story files found for ${filters.map((file) => `\`${displayPath(file)}\``).join(', ')}.`,
              ],
          selection,
        };
      }
      narrow(matched.storyIds);
    }

    if (changed) {
      const since = typeof changed === 'string' ? changed : undefined;
      let changedFiles: string[];
      try {
        changedFiles = await getChangedFiles({ since });
      } catch (error) {
        return {
          status: 'error',
          error: { message: changedFilesError(error, since, transport === 'cli') },
        };
      }
      const affected = await findChangedStories({ index, changedFiles, getModuleGraph });
      if (affected.kind === 'unavailable') {
        return {
          status: 'error',
          error: {
            message: `\`--changed\` needs Storybook's module graph to find the stories that depend on a changed file: ${affected.reason} Pass story files instead.`,
          },
        };
      }
      selection.changed = {
        ...(since ? { since } : {}),
        changedFiles: changedFiles.length,
        ...(affected.kind === 'every-story'
          ? { everyStory: displayPath(affected.trigger) }
          : { storyFiles: affected.storyFiles.length }),
      };
      if (affected.kind === 'stories') {
        narrow(affected.storyIds);
      }
    }

    if (stories) {
      selection.stories = stories.length;
      const resolved = findStoryIds(index, stories);
      notFoundMessages = resolved
        .filter((story): story is NotFoundStory => !('entry' in story))
        .map((story) => story.errorMessage);
      narrow(
        resolved
          .filter((story): story is FoundStory => 'entry' in story)
          .map((story) => story.entry.id)
      );
    }

    // Nothing to run. An unknown story id fails the call; `--changed` that affects nothing passes,
    // as Vitest's `--changed` does ("No affected test files found, exiting with code 0").
    if (candidates?.size === 0) {
      return { status: 'no-stories', notFoundMessages, selection };
    }

    storyIds = candidates ? [...candidates] : undefined;
    selection.storyCount = storyIds?.length;
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
      return {
        status: 'completed',
        result: response.result,
        ...(selection ? { selection } : {}),
        ...(notFoundMessages.length > 0 ? { notFound: notFoundMessages } : {}),
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
