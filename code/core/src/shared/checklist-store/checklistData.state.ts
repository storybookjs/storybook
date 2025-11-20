import type { StoreState } from '.';

export const initialState = {
  loaded: false,
  widget: {
    disable: false,
  },
  values: {
    'guided-tour': {
      status: 'open',
      mutedAt: undefined,
    },
    'onboarding-survey': {
      status: 'open',
      mutedAt: undefined,
    },
    'render-component': {
      status: 'open',
      mutedAt: undefined,
    },
    'more-components': {
      status: 'open',
      mutedAt: undefined,
    },
    'more-stories': {
      status: 'open',
      mutedAt: undefined,
    },
    'whats-new-storybook-10': {
      status: 'open',
      mutedAt: undefined,
    },
    controls: {
      status: 'open',
      mutedAt: undefined,
    },
    viewports: {
      status: 'open',
      mutedAt: undefined,
    },
    'organize-stories': {
      status: 'open',
      mutedAt: undefined,
    },
    'install-vitest': {
      status: 'open',
      mutedAt: undefined,
    },
    'run-tests': {
      status: 'open',
      mutedAt: undefined,
    },
    'write-interactions': {
      status: 'open',
      mutedAt: undefined,
    },
    'install-a11y': {
      status: 'open',
      mutedAt: undefined,
    },
    'accessibility-tests': {
      status: 'open',
      mutedAt: undefined,
    },
    'install-chromatic': {
      status: 'open',
      mutedAt: undefined,
    },
    'visual-tests': {
      status: 'open',
      mutedAt: undefined,
    },
    coverage: {
      status: 'open',
      mutedAt: undefined,
    },
    'ci-tests': {
      status: 'open',
      mutedAt: undefined,
    },
    'install-docs': {
      status: 'open',
      mutedAt: undefined,
    },
    autodocs: {
      status: 'open',
      mutedAt: undefined,
    },
    'mdx-docs': {
      status: 'open',
      mutedAt: undefined,
    },
    'publish-storybook': {
      status: 'open',
      mutedAt: undefined,
    },
  },
} as const satisfies StoreState;
