import type { experimental_UniversalStore } from 'storybook/internal/core-server';
import type { StoryId } from 'storybook/internal/types';

import type { TestResult } from './node/old-reporter';
import type { VitestError } from './types';

export const ADDON_ID = 'storybook/test';
export const TEST_PROVIDER_ID = `${ADDON_ID}/test-provider`;
export const PANEL_ID = `${ADDON_ID}/panel`;
export const STORYBOOK_ADDON_TEST_CHANNEL = 'STORYBOOK_ADDON_TEST_CHANNEL';

export const A11Y_ADDON_ID = 'storybook/a11y';
export const A11Y_PANEL_ID = `${A11Y_ADDON_ID}/panel`;

export const TUTORIAL_VIDEO_LINK = 'https://youtu.be/Waht9qq7AoA';
export const DOCUMENTATION_LINK = 'writing-tests/test-addon';
export const DOCUMENTATION_DISCREPANCY_LINK = `${DOCUMENTATION_LINK}#what-happens-when-there-are-different-test-results-in-multiple-environments`;
export const DOCUMENTATION_FATAL_ERROR_LINK = `${DOCUMENTATION_LINK}#what-happens-if-vitest-itself-has-an-error`;

export const COVERAGE_DIRECTORY = 'coverage';

export const SUPPORTED_FRAMEWORKS = [
  '@storybook/nextjs',
  '@storybook/experimental-nextjs-vite',
  '@storybook/sveltekit',
];

export const SUPPORTED_RENDERERS = ['@storybook/react', '@storybook/svelte', '@storybook/vue3'];

export type Details = {
  testResults: TestResult[];
  coverageSummary?: {
    status: 'positive' | 'warning' | 'negative' | 'unknown';
    percentage: number;
  };
};

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
export type FatalErrorEvent = {
  type: 'FATAL_ERROR';
  payload: {
    message: string;
    error: ErrorLike;
  };
};
export type StoreEvent = TriggerRunEvent | CancelRunEvent | FatalErrorEvent;

export type Store = ReturnType<typeof experimental_UniversalStore.create<StoreState, StoreEvent>>;

export const storeOptions = {
  id: ADDON_ID,
  initialState: {
    config: {
      coverage: false,
      a11y: false,
    },
    watching: false,
    cancelling: false,
    fatalError: undefined,
    currentRun: {
      coverage: false,
      a11y: false,
      finishedTestCount: 0,
      storyIds: undefined,
      totalTestCount: undefined,
      startedAt: undefined,
      finishedAt: undefined,
      unhandledErrors: [],
      coverageSummary: undefined,
    },
  },
};

export const STORE_CHANNEL_EVENT_NAME = `UNIVERSAL_STORE:${storeOptions.id}`;
export const STATUS_STORE_CHANNEL_EVENT_NAME = 'UNIVERSAL_STORE:storybook/status';
export const TEST_PROVIDER_STORE_CHANNEL_EVENT_NAME = 'UNIVERSAL_STORE:storybook/test-provider';

export const STATUS_TYPE_ID_COMPONENT_TEST = 'storybook/component-test';
export const STATUS_TYPE_ID_A11Y = 'storybook/a11y';
