import type { TestResult } from './node/reporter';

export const ADDON_ID = 'storybook/test';
export const TEST_PROVIDER_ID = `${ADDON_ID}/test-provider`;
export const PANEL_ID = `${ADDON_ID}/panel`;
export const STORYBOOK_ADDON_TEST_CHANNEL = 'STORYBOOK_ADDON_TEST_CHANNEL';

export const DOCUMENTATION_LINK = 'writing-tests/test-addon';
export const DOCUMENTATION_FATAL_ERROR_LINK = `${DOCUMENTATION_LINK}#what-happens-if-vitest-itself-has-an-error`;

export const A11Y_PANEL_ID = 'storybook/a11y/panel';

export const COVERAGE_DIRECTORY = 'coverage';

export const SUPPORTED_FRAMEWORKS = [
  '@storybook/nextjs',
  '@storybook/nextjs-vite',
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

export type StoreState = {
  config: {
    coverage: boolean;
    a11y: boolean;
  };
  watching: boolean;
};

export const storeOptions = {
  id: ADDON_ID,
  initialState: {
    config: {
      coverage: false,
      a11y: false,
    },
    watching: false,
  },
};

export const STORE_CHANNEL_EVENT_NAME = `UNIVERSAL_STORE:${storeOptions.id}`;

export const STATUS_TYPE_ID_COMPONENT_TEST = 'storybook/component-test';
export const STATUS_TYPE_ID_A11Y = 'storybook/a11y';
