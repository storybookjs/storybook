import type { StoreOptions } from 'storybook/internal/types';

import type { StoreState } from './types';

export const ADDON_ID = 'storybook/test';
export const TEST_PROVIDER_ID = `${ADDON_ID}/test-provider`;
export const PANEL_ID = `${ADDON_ID}/panel`;
export const STORYBOOK_ADDON_TEST_CHANNEL = 'STORYBOOK_ADDON_TEST_CHANNEL';

export const A11Y_ADDON_ID = 'storybook/a11y';
export const A11Y_PANEL_ID = `${A11Y_ADDON_ID}/panel`;

export const TUTORIAL_VIDEO_LINK = 'https://youtu.be/Waht9qq7AoA';
export const DOCUMENTATION_LINK = 'writing-tests/test-addon';
export const DOCUMENTATION_FATAL_ERROR_LINK = `${DOCUMENTATION_LINK}#what-happens-if-vitest-itself-has-an-error`;

export const COVERAGE_DIRECTORY = 'coverage';

export const SUPPORTED_FRAMEWORKS = [
  '@storybook/nextjs',
  '@storybook/experimental-nextjs-vite',
  '@storybook/sveltekit',
];

export const SUPPORTED_RENDERERS = ['@storybook/react', '@storybook/svelte', '@storybook/vue3'];

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
    indexUrl: undefined,
    currentRun: {
      triggeredBy: undefined,
      config: {
        coverage: false,
        a11y: false,
      },
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

export const STORE_CHANNEL_EVENT_NAME = `UNIVERSAL_STORE:${storeOptions.id}`;
export const STATUS_STORE_CHANNEL_EVENT_NAME = 'UNIVERSAL_STORE:storybook/status';
export const TEST_PROVIDER_STORE_CHANNEL_EVENT_NAME = 'UNIVERSAL_STORE:storybook/test-provider';

export const STATUS_TYPE_ID_COMPONENT_TEST = 'storybook/component-test';
export const STATUS_TYPE_ID_A11Y = 'storybook/a11y';
