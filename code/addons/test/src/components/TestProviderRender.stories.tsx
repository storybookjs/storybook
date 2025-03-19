import React from 'react';

import type { TestProviderConfig, TestProviderState } from 'storybook/internal/core-events';
import { Addon_TypesEnum } from 'storybook/internal/types';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ManagerContext, addons } from 'storybook/manager-api';
import { expect, fn, userEvent } from 'storybook/test';
import { styled } from 'storybook/theming';

import { ADDON_ID as A11Y_ADDON_ID } from '../../../a11y/src/constants';
import { type Details, storeOptions } from '../constants';
import { store as mockStore } from '../manager-store.mock';
import { TestProviderRender } from './TestProviderRender';

const managerContext: any = {
  state: {
    testProviders: {
      'test-provider-id': {
        id: 'test-provider-id',
        name: 'Test Provider',
        type: Addon_TypesEnum.experimental_TEST_PROVIDER,
      },
    },
  },
  api: {
    getDocsUrl: fn(({ subpath }) => `https://storybook.js.org/docs/${subpath}`).mockName(
      'api::getDocsUrl'
    ),
    emit: fn().mockName('api::emit'),
    updateTestProviderState: fn().mockName('api::updateTestProviderState'),
  },
};

const config: TestProviderConfig = {
  id: 'test-provider-id',
  name: 'Test Provider',
  type: Addon_TypesEnum.experimental_TEST_PROVIDER,
  runnable: true,
};

const baseState: TestProviderState<Details> = {
  cancellable: true,
  cancelling: false,
  crashed: false,
  error: undefined,
  failed: false,
  running: false,
  details: {
    testResults: [
      {
        endTime: 0,
        startTime: 0,
        status: 'passed',
        message: 'All tests passed',
        results: [
          {
            storyId: 'story-id',
            status: 'passed',
            duration: 100,
            testRunId: 'test-run-id',
            reports: [],
          },
        ],
      },
    ],
  },
};

const Content = styled.div({
  padding: '12px 6px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
});

const meta = {
  title: 'TestProviderRender',
  component: TestProviderRender,
  args: {
    state: {
      ...config,
      ...baseState,
    },
    testProviderState: 'test-provider-state:pending',
    componentTestStatusCountsByValue: {
      'status-value:error': 0,
      'status-value:success': 0,
      'status-value:pending': 0,
      'status-value:warning': 0,
      'status-value:unknown': 0,
    },
    a11yStatusCountsByValue: {
      'status-value:error': 0,
      'status-value:success': 0,
      'status-value:pending': 0,
      'status-value:warning': 0,
      'status-value:unknown': 0,
    },
    api: managerContext.api,
  },
  decorators: [
    (StoryFn) => (
      <Content>
        <StoryFn />
      </Content>
    ),
    (StoryFn) => (
      <ManagerContext.Provider value={managerContext}>
        <StoryFn />
      </ManagerContext.Provider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
  beforeEach: async () => {
    addons.register(A11Y_ADDON_ID, () => {});
    mockStore.setState.mockClear();
    return () => {
      mockStore.setState(storeOptions.initialState);
    };
  },
} satisfies Meta<typeof TestProviderRender>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    state: {
      ...config,
      ...baseState,
    },
  },
};

export const Running: Story = {
  args: {
    state: {
      ...config,
      ...baseState,
      running: true,
    },
    testProviderState: 'test-provider-state:running',
  },
};

export const Watching: Story = {
  args: {
    state: {
      ...config,
      ...baseState,
    },
  },
  beforeEach: async () => {
    mockStore.setState((s) => ({ ...s, watching: true }));
  },
};

export const Crashed: Story = {
  args: {
    state: {
      ...config,
      ...baseState,
    },
    testProviderState: 'test-provider-state:crashed',
  },
};

export const ComponentTestsSucceeded: Story = {
  args: {
    state: {
      ...config,
      ...baseState,
    },
    testProviderState: 'test-provider-state:succeeded',
    componentTestStatusCountsByValue: {
      ...meta.args.componentTestStatusCountsByValue,
      'status-value:success': 1,
    },
  },
};

export const ComponentTestsFailed: Story = {
  args: {
    state: {
      ...config,
      ...baseState,
    },
    testProviderState: 'test-provider-state:succeeded',
    componentTestStatusCountsByValue: {
      ...meta.args.componentTestStatusCountsByValue,
      'status-value:error': 10,
    },
  },
};

export const TogglingSettings: Story = {
  args: {
    state: {
      ...config,
      ...baseState,
      details: {
        testResults: [],
      },
    },
  },
  play: async ({ canvas, step }) => {
    await step('Enable coverage', async () => {
      (await canvas.findByLabelText('Coverage')).click();
      await expect(mockStore.setState).toHaveBeenCalledOnce();
      mockStore.setState.mockClear();
    });

    await step('Enable watch mode', async () => {
      (await canvas.findByLabelText('Enable watch mode')).click();
      await expect(mockStore.setState).toHaveBeenCalledOnce();

      await expect(await canvas.findByLabelText('Coverage (unavailable)')).not.toBeDisabled();
    });
  },
};

export const CoverageEnabled: Story = {
  args: Default.args,
  beforeEach: async () => {
    mockStore.setState({
      ...storeOptions.initialState,
      config: { ...storeOptions.initialState.config, coverage: true },
    });
  },
  play: async ({ canvas }) => {
    userEvent.hover(await canvas.findByLabelText(/Coverage status:/));
  },
};

export const CoverageCalculating: Story = {
  ...CoverageEnabled,
  args: Running.args,
  play: CoverageEnabled.play,
};

export const CoverageNegative: Story = {
  ...CoverageEnabled,
  args: {
    state: {
      ...config,
      ...baseState,
      details: {
        testResults: [],
        coverageSummary: {
          percentage: 20,
          status: 'negative',
        },
      },
    },
  },
};

export const CoverageWarning: Story = {
  ...CoverageEnabled,
  args: {
    state: {
      ...config,
      ...baseState,
      details: {
        testResults: [],
        coverageSummary: {
          percentage: 50,
          status: 'warning',
        },
      },
    },
  },
};

export const CoveragePositive: Story = {
  ...CoverageEnabled,
  args: {
    state: {
      ...config,
      ...baseState,
      details: {
        testResults: [],
        coverageSummary: {
          percentage: 80,
          status: 'positive',
        },
      },
    },
  },
};

export const AccessibilityEnabled: Story = {
  args: Default.args,
  beforeEach: async () => {
    mockStore.setState({
      ...storeOptions.initialState,
      config: { ...storeOptions.initialState.config, a11y: true },
    });
  },
  play: async ({ canvas }) => {
    userEvent.hover(await canvas.findByLabelText(/Accessibility status:/));
  },
};

export const AccessibilityViolations: Story = {
  args: {
    state: {
      ...config,
      ...baseState,
      details: {
        testResults: [
          {
            endTime: 0,
            startTime: 0,
            status: 'passed',
            message: 'All tests passed',
            results: [
              {
                storyId: 'story-id',
                status: 'passed',
                duration: 100,
                testRunId: 'test-run-id',
                reports: [{ type: 'a11y', status: 'warning', result: { violations: [] } }],
              },
            ],
          },
        ],
      },
    },
  },
  beforeEach: async () => {
    mockStore.setState({
      ...storeOptions.initialState,
      config: { ...storeOptions.initialState.config, a11y: true },
    });
  },
  play: async ({ canvas }) => {
    userEvent.hover(await canvas.findByLabelText(/Accessibility status:/));
  },
};
