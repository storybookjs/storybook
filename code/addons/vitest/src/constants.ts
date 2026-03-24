import type { StoreOptions } from 'storybook/internal/types';

import type { CurrentRun, RunTrigger, StoreState } from './types';

export { PANEL_ID as COMPONENT_TESTING_PANEL_ID } from '../../../core/src/component-testing/constants';
export {
  PANEL_ID as A11Y_PANEL_ID,
  ADDON_ID as A11Y_ADDON_ID,
} from '../../../addons/a11y/src/constants';

export const ADDON_ID = 'storybook/test';
export const TEST_PROVIDER_ID = `${ADDON_ID}/test-provider`;
export const STORYBOOK_ADDON_TEST_CHANNEL = `${ADDON_ID}/channel`;

export const TUTORIAL_VIDEO_LINK = 'https://youtu.be/Waht9qq7AoA';
export const DOCUMENTATION_LINK = 'writing-tests/integrations/vitest-addon';
export const DOCUMENTATION_FATAL_ERROR_LINK = `${DOCUMENTATION_LINK}#what-happens-if-vitest-itself-has-an-error`;

export const COVERAGE_DIRECTORY = 'coverage';

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
    index: { entries: {}, v: 5 },
    previewAnnotations: [],
    currentRun: {
      triggeredBy: undefined,
      config: {
        coverage: false,
        a11y: false,
      },
      componentTestStatuses: [],
      a11yStatuses: [],
      a11yReports: {},
      componentTestCount: {
        success: 0,
        error: 0,
      },
      a11yCount: {
        success: 0,
        warning: 0,
        error: 0,
      },
      storyIds: undefined,
      totalTestCount: undefined,
      startedAt: undefined,
      finishedAt: undefined,
      unhandledErrors: [],
      coverageSummary: undefined,
    },
  },
} satisfies StoreOptions<StoreState>;

export const FULL_RUN_TRIGGERS: RunTrigger[] = ['global', 'run-all'] as const;

export const STORE_CHANNEL_EVENT_NAME = `UNIVERSAL_STORE:${storeOptions.id}`;
export const STATUS_STORE_CHANNEL_EVENT_NAME = 'UNIVERSAL_STORE:storybook/status';
export const TEST_PROVIDER_STORE_CHANNEL_EVENT_NAME = 'UNIVERSAL_STORE:storybook/test-provider';

export const STATUS_TYPE_ID_COMPONENT_TEST = 'storybook/component-test';
export const STATUS_TYPE_ID_A11Y = 'storybook/a11y';

// Channel event names for programmatic test triggering
export const TRIGGER_TEST_RUN_REQUEST = `${ADDON_ID}/trigger-test-run-request`;
export const TRIGGER_TEST_RUN_RESPONSE = `${ADDON_ID}/trigger-test-run-response`;

export type TriggerTestRunRequestPayload = {
  requestId: string;
  actor: string;
  storyIds?: string[];
  config?: Partial<StoreState['config']>;
};

export type TestRunResult = CurrentRun;

export type TriggerTestRunResponsePayload = {
  requestId: string;
  status: 'completed' | 'error' | 'cancelled';
  result?: TestRunResult;
  error?: {
    message: string;
    error?: import('./types').ErrorLike;
  };
};
