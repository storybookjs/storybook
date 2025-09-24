import React from 'react';

import type { Listener } from 'storybook/internal/channels';
import type { TestProviderStateByProviderId } from 'storybook/internal/types';
import {
  type Addon_Collection,
  type Addon_TestProviderType,
  Addon_TypesEnum,
} from 'storybook/internal/types';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ManagerContext, mockChannel } from 'storybook/manager-api';
import { expect, fireEvent, fn, waitFor } from 'storybook/test';
import { styled } from 'storybook/theming';

import { internal_fullTestProviderStore } from '../../manager-stores.mock';
import { TestingModule } from './TestingModule';

const TestProvider = styled.div({
  padding: 8,
  fontSize: 12,
});

const registeredTestProviders: Addon_Collection<Addon_TestProviderType> = {
  'component-tests': {
    type: Addon_TypesEnum.experimental_TEST_PROVIDER,
    id: 'component-tests',
    render: () => <TestProvider>Component tests</TestProvider>,
  },
  'visual-tests': {
    type: Addon_TypesEnum.experimental_TEST_PROVIDER,
    id: 'visual-tests',
    render: () => <TestProvider>Visual tests</TestProvider>,
  },
  linting: {
    type: Addon_TypesEnum.experimental_TEST_PROVIDER,
    id: 'linting',
    render: () => <TestProvider>Linting</TestProvider>,
  },
};

const testProviderStates: TestProviderStateByProviderId = {
  'component-tests': 'test-provider-state:pending',
  'visual-tests': 'test-provider-state:pending',
  linting: 'test-provider-state:pending',
};

const channel = mockChannel();
const managerContext: any = {
  api: {
    on: (eventName: string, listener: Listener) => {
      return channel.on(eventName, listener);
    },
    off: (eventName: string, listener: Listener) => channel.off(eventName, listener),
    runTestProvider: fn().mockName('api::runTestProvider'),
    cancelTestProvider: fn().mockName('api::cancelTestProvider'),
    updateTestProviderState: fn().mockName('api::updateTestProviderState'),
  },
};

const meta = {
  component: TestingModule,
  title: 'Sidebar/TestingModule',
  args: {
    registeredTestProviders,
    testProviderStates,
    hasStatuses: false,
    clearStatuses: fn(),
    onRunAll: fn(),
    errorCount: 0,
    errorsActive: false,
    setErrorsActive: fn(),
    warningCount: 0,
    warningsActive: false,
    setWarningsActive: fn(),
    successCount: 0,
  },
  decorators: [
    (storyFn) => (
      <ManagerContext.Provider value={managerContext}>{storyFn()}</ManagerContext.Provider>
    ),
    (StoryFn) => (
      <div style={{ maxWidth: 250 }}>
        <StoryFn />
      </div>
    ),
  ],
} satisfies Meta<typeof TestingModule>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Expanded: Story = {
  play: async ({ canvas }) => {
    const button = await canvas.findByRole('button', { name: /Expand/ });
    await fireEvent.click(button);
    await new Promise((resolve) => setTimeout(resolve, 500));
  },
};

export const Statuses: Story = {
  args: {
    hasStatuses: true,
    errorCount: 14,
    warningCount: 42,
  },
  play: Expanded.play,
};

export const PassingStatuses: Story = {
  args: {
    hasStatuses: true,
  },
  play: Expanded.play,
};

export const ErrorsActive: Story = {
  args: {
    ...Statuses.args,
    errorsActive: true,
  },
  play: Expanded.play,
};

export const WarningsActive: Story = {
  args: {
    ...Statuses.args,
    warningsActive: true,
  },
  play: Expanded.play,
};

export const BothActive: Story = {
  args: {
    ...Statuses.args,
    errorsActive: true,
    warningsActive: true,
  },
  play: Expanded.play,
};

export const CollapsedStatuses: Story = {
  args: Statuses.args,
};

export const Running: Story = {
  args: {
    testProviderStates: {
      ...testProviderStates,
      'component-tests': 'test-provider-state:running',
    },
  },
  play: Expanded.play,
};

export const RunningWithErrors: Story = {
  args: {
    ...Statuses.args,
    ...Running.args,
  },
  play: Expanded.play,
};

export const CollapsedRunning: Story = {
  args: Running.args,
};

export const CollapsedRunningWithErrors: Story = {
  args: {
    ...RunningWithErrors.args,
  },
};

export const Crashed: Story = {
  args: {
    testProviderStates: {
      ...testProviderStates,
      'component-tests': 'test-provider-state:crashed',
    },
  },
};

export const SettingsUpdated: Story = {
  play: async (playContext) => {
    await Expanded.play!(playContext);
    const testingModule = document.getElementById('storybook-testing-module');
    await waitFor(() => expect(testingModule!.dataset.updated).toBe('false'));
    internal_fullTestProviderStore.settingsChanged();
    await waitFor(() => expect(testingModule!.dataset.updated).toBe('true'));
    await waitFor(() => expect(testingModule!.dataset.updated).toBe('false'));
  },
};

export const NoTestProvider: Story = {
  args: {
    registeredTestProviders: {},
  },
};

export const NoTestProviderWithStatuses: Story = {
  args: {
    ...Statuses.args,
    registeredTestProviders: {},
  },
};
