import type { experimental_UniversalStore } from 'storybook/internal/core-server';
import type { StoryId } from 'storybook/internal/types';

export interface TestParameters {
  /**
   * Test addon configuration
   *
   * @see https://storybook.js.org/docs/writing-tests/test-addon
   */
  test: {
    /** Ignore unhandled errors during test execution */
    dangerouslyIgnoreUnhandledErrors?: boolean;

    /** Whether to throw exceptions coming from the play function */
    throwPlayFunctionExceptions?: boolean;
  };
}

export interface VitestError extends Error {
  VITEST_TEST_PATH?: string;
  VITEST_TEST_NAME?: string;
}

export type ErrorLike = {
  message: string;
  name?: string;
  stack?: string;
  cause?: ErrorLike;
};

export type StoreState = {
  config: {
    coverage: boolean;
    a11y: boolean;
  };
  watching: boolean;
  cancelling: boolean;
  fatalError:
    | {
        message: string | undefined;
        error: ErrorLike;
      }
    | undefined;
  currentRun: {
    coverage: boolean;
    a11y: boolean;
    finishedTestCount: number;
    totalTestCount: number | undefined;
    storyIds: StoryId[] | undefined;
    startedAt: number | undefined;
    finishedAt: number | undefined;
    unhandledErrors: VitestError[];
    coverageSummary:
      | {
          status: 'positive' | 'warning' | 'negative' | 'unknown';
          percentage: number;
        }
      | undefined;
  };
};

export type CachedState = Pick<StoreState, 'config' | 'watching'>;

export type TriggerRunEvent = {
  type: 'TRIGGER_RUN';
  payload: {
    // TODO: Avoid needing to do a fetch request server-side to retrieve the index
    indexUrl: string; // e.g. http://localhost:6006/index.json
    storyIds?: string[]; // ['button--primary', 'button--secondary']
  };
};
export type CancelRunEvent = {
  type: 'CANCEL_RUN';
};
export type ToggleWatchingEvent = {
  type: 'TOGGLE_WATCHING';
  payload: {
    to: boolean;
  };
};
export type FatalErrorEvent = {
  type: 'FATAL_ERROR';
  payload: {
    message: string;
    error: ErrorLike;
  };
};
export type StoreEvent = TriggerRunEvent | CancelRunEvent | FatalErrorEvent | ToggleWatchingEvent;

export type Store = ReturnType<typeof experimental_UniversalStore.create<StoreState, StoreEvent>>;
