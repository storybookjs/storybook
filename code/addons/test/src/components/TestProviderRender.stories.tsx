import React from 'react';

import type { TestProviderConfig, TestProviderState } from 'storybook/internal/core-events';
import { ManagerContext } from 'storybook/internal/manager-api';
import { styled } from 'storybook/internal/theming';
import { Addon_TypesEnum } from 'storybook/internal/types';

import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn } from '@storybook/test';

import { type Details, storeOptions } from '../constants';
import { store as mockStore } from '../manager-store.mock';
import { TestProviderRender } from './TestProviderRender';

type Story = StoryObj<typeof TestProviderRender>;
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

export default {
  title: 'TestProviderRender',
  component: TestProviderRender,
  args: {
    state: {
      ...config,
      ...baseState,
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
    return () => {
      mockStore.setState(storeOptions.initialState);
    };
  },
} as Meta<typeof TestProviderRender>;

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

export const WithCoverageNegative: Story = {
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

export const WithCoverageWarning: Story = {
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

export const WithCoveragePositive: Story = {
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

export const Editing: Story = {
  args: {
    state: {
      ...config,
      ...baseState,
      details: {
        testResults: [],
      },
    },
  },

  play: async ({ canvas }) => {
    (await canvas.findByLabelText('Show settings')).click();
  },
};

export const EditingAndWatching: Story = {
  args: {
    state: {
      ...config,
      ...baseState,
      details: {
        testResults: [],
      },
    },
  },
  beforeEach: Watching.beforeEach,
  play: Editing.play,
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
      (await canvas.findByLabelText('Show settings')).click();

      (await canvas.findByLabelText('Coverage')).click();
      await expect(mockStore.setState).toHaveBeenCalledOnce();
      mockStore.setState.mockClear();
    });

    (await canvas.findByLabelText('Hide settings')).click();

    await step('Enable watch mode', async () => {
      (await canvas.findByLabelText('Enable watch mode')).click();
      await expect(mockStore.setState).toHaveBeenCalledOnce();

      (await canvas.findByLabelText('Show settings')).click();

      await expect(await canvas.findByLabelText('Coverage')).toBeDisabled();
    });
  },
};
