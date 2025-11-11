import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ManagerContext, addons } from 'storybook/manager-api';
import { fn } from 'storybook/test';
import { styled } from 'storybook/theming';

import { ADDON_ID as A11Y_ADDON_ID } from '../../../a11y/src/constants';
import { storeOptions } from '../constants';
import { store as mockStore } from '../manager-store.mock';
import { TestProviderRender } from './TestProviderRender';

const managerContext: any = {
  api: {
    getDocsUrl: fn(({ subpath }) => `https://storybook.js.org/docs/${subpath}`).mockName(
      'api::getDocsUrl'
    ),
    findAllLeafStoryIds: fn((entryId) => [entryId]),
    selectStory: fn().mockName('api::selectStory'),
    setSelectedPanel: fn().mockName('api::setSelectedPanel'),
    togglePanel: fn().mockName('api::togglePanel'),
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
    api: managerContext.api,
    testProviderState: 'test-provider-state:pending',
    componentTestStatusValueToStoryIds: {
      'status-value:error': [],
      'status-value:success': [],
      'status-value:pending': [],
      'status-value:warning': [],
      'status-value:unknown': [],
    },
    a11yStatusValueToStoryIds: {
      'status-value:error': [],
      'status-value:success': [],
      'status-value:pending': [],
      'status-value:warning': [],
      'status-value:unknown': [],
    },
    storeState: storeOptions.initialState,
    setStoreState: fn(),
    isSettingsUpdated: false,
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

export const Default: Story = {};

export const Starting: Story = {
  args: {
    testProviderState: 'test-provider-state:running',
  },
};

export const Testing: Story = {
  args: {
    testProviderState: 'test-provider-state:running',
    storeState: {
      ...storeOptions.initialState,
      currentRun: {
        ...storeOptions.initialState.currentRun,
        componentTestCount: {
          success: 30,
          error: 0,
        },
        totalTestCount: 100,
      },
    },
  },
};

export const TestingWithStatuses: Story = {
  args: {
    testProviderState: 'test-provider-state:running',
    storeState: {
      ...storeOptions.initialState,
      config: {
        coverage: true,
        a11y: true,
      },
      currentRun: {
        ...storeOptions.initialState.currentRun,
        componentTestCount: {
          success: 30,
          error: 0,
        },
        totalTestCount: 100,
      },
    },
    componentTestStatusValueToStoryIds: {
      ...meta.args.componentTestStatusValueToStoryIds,
      'status-value:error': ['story-id-1', 'story-id-2'],
    },
    a11yStatusValueToStoryIds: {
      ...meta.args.a11yStatusValueToStoryIds,
      'status-value:warning': ['story-id-3', 'story-id-4', 'story-id-5'],
    },
  },
};

export const Watching: Story = {
  args: {
    storeState: {
      ...storeOptions.initialState,
      watching: true,
    },
  },
};

export const Crashed: Story = {
  args: {
    testProviderState: 'test-provider-state:crashed',
    storeState: {
      ...storeOptions.initialState,
      fatalError: {
        message: 'Error message',
        error: {
          name: 'Error',
          message: 'Error message',
          stack: 'Error stack',
        },
      },
    },
  },
};

export const UnhandledErrors: Story = {
  args: {
    testProviderState: 'test-provider-state:succeeded',
    storeState: {
      ...storeOptions.initialState,
      currentRun: {
        ...storeOptions.initialState.currentRun,
        unhandledErrors: [
          {
            name: 'Error',
            message: 'Error message',
            stack: 'Error stack',
            VITEST_TEST_PATH: '/test/path/test-name',
            VITEST_TEST_NAME: 'Test name',
          },
          {
            name: 'Error',
            message: 'Other Error message',
            stack: 'Other Error stack',
            VITEST_TEST_PATH: '/test/path/other-test-name',
            VITEST_TEST_NAME: 'Other Test name',
          },
        ],
      },
    },
  },
};

export const ComponentTestsSucceeded: Story = {
  args: {
    testProviderState: 'test-provider-state:succeeded',
    componentTestStatusValueToStoryIds: {
      ...meta.args.componentTestStatusValueToStoryIds,
      'status-value:success': ['story-id-1'],
    },
  },
};

export const ComponentTestsFailed: Story = {
  args: {
    testProviderState: 'test-provider-state:succeeded',
    componentTestStatusValueToStoryIds: {
      ...meta.args.componentTestStatusValueToStoryIds,
      'status-value:error': ['story-id-1'],
    },
  },
};

export const CoverageEnabled: Story = {
  args: {
    storeState: {
      ...meta.args.storeState,
      config: { ...meta.args.storeState.config, coverage: true },
    },
  },
};

export const RunningWithCoverageEnabled: Story = {
  args: {
    ...CoverageEnabled.args,
    testProviderState: 'test-provider-state:running',
  },
};

export const CoverageNegative: Story = {
  args: {
    storeState: {
      ...CoverageEnabled.args!.storeState!,
      currentRun: {
        ...meta.args.storeState.currentRun,
        coverageSummary: { percentage: 20, status: 'negative' },
      },
    },
  },
};

export const CoverageWarning: Story = {
  args: {
    storeState: {
      ...CoverageEnabled.args!.storeState!,
      currentRun: {
        ...meta.args.storeState.currentRun,
        coverageSummary: { percentage: 50, status: 'warning' },
      },
    },
  },
};

export const CoveragePositive: Story = {
  args: {
    storeState: {
      ...CoverageEnabled.args!.storeState!,
      currentRun: {
        ...meta.args.storeState.currentRun,
        coverageSummary: { percentage: 80, status: 'positive' },
      },
    },
  },
};

export const AccessibilityEnabled: Story = {
  args: {
    storeState: {
      ...meta.args.storeState,
      config: { ...meta.args.storeState.config, a11y: true },
    },
  },
};

export const AccessibilityViolations: Story = {
  args: {
    ...AccessibilityEnabled.args,
    testProviderState: 'test-provider-state:succeeded',
    a11yStatusValueToStoryIds: {
      ...meta.args.a11yStatusValueToStoryIds,
      'status-value:warning': ['story-id-1', 'story-id-2', 'story-id-3'],
    },
  },
};

export const AccessibilityViolationsWithErrors: Story = {
  args: {
    ...AccessibilityEnabled.args,
    testProviderState: 'test-provider-state:succeeded',
    a11yStatusValueToStoryIds: {
      ...meta.args.a11yStatusValueToStoryIds,
      'status-value:warning': ['story-id-1', 'story-id-2', 'story-id-5'],
      'status-value:error': ['story-id-3', 'story-id-4'],
    },
  },
};

export const SettingsUpdated: Story = {
  args: {
    ...meta.args,
    isSettingsUpdated: true,
  },
};

export const InSidebarContextMenu: Story = {
  args: {
    ...meta.args,
    testProviderState: 'test-provider-state:succeeded',
    entry: {
      id: 'story-id-1',
      type: 'story',
      subtype: 'story',
      name: 'Example Story',
      tags: [],
      title: 'Example Story',
      importPath: './path/to/story',
      prepared: true,
      parent: 'parent-id',
      exportName: 'ExampleStory',
      depth: 1,
    },
  },
};
