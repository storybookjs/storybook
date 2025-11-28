import type { experimental_UniversalStore } from 'storybook/internal/core-server';
import type { PreviewAnnotation, Status, StoryId } from 'storybook/internal/types';
import type { API_HashEntry } from 'storybook/internal/types';

export interface VitestError extends Error {
  VITEST_TEST_PATH?: string;
  VITEST_TEST_NAME?: string;
  stacks?: Array<{
    line: number;
    column: number;
    file: string;
    method: string;
  }>;
}

export type ErrorLike = {
  message: string;
  name?: string;
  stack?: string;
  cause?: ErrorLike;
};

export type RunTrigger =
  | 'run-all'
  | 'global'
  | 'watch'
  | Extract<API_HashEntry['type'], string>
  | `external:${string}`;

export type StoreState = {
  config: {
    coverage: boolean;
    a11y: boolean;
  };
  watching: boolean;
  cancelling: boolean;
  // TODO: Avoid needing to do a fetch request server-side to retrieve the index
  // e.g. http://localhost:6006/index.json
  indexUrl: string | undefined;
  previewAnnotations: PreviewAnnotation[];
  fatalError:
    | {
        message: string | undefined;
        error: ErrorLike;
      }
    | undefined;
  currentRun: {
    triggeredBy: RunTrigger | undefined;
    config: StoreState['config'];
    componentTestStatuses: Status[];
    a11yStatuses: Status[];
    componentTestCount: {
      success: number;
      error: number;
    };
    a11yCount: {
      success: number;
      warning: number;
      error: number;
    };
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

export type CachedState = Pick<StoreState, 'config'>;

export type TriggerRunEvent = {
  type: 'TRIGGER_RUN';
  payload: {
    storyIds?: string[] | undefined;
    triggeredBy: RunTrigger;
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
export type TestRunCompletedEvent = {
  type: 'TEST_RUN_COMPLETED';
  payload: StoreState['currentRun'];
};
export type StoreEvent =
  | TriggerRunEvent
  | CancelRunEvent
  | FatalErrorEvent
  | ToggleWatchingEvent
  | TestRunCompletedEvent;

export type Store = ReturnType<typeof experimental_UniversalStore.create<StoreState, StoreEvent>>;
