import React from 'react';

import type { Listener } from 'storybook/internal/channels';
import { type TestProviders } from 'storybook/internal/core-events';
import { Addon_TypesEnum } from 'storybook/internal/types';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ManagerContext, mockChannel } from 'storybook/manager-api';
import { fireEvent, fn } from 'storybook/test';
import { styled } from 'storybook/theming';

import { TestingModule } from './TestingModule';

const TestProvider = styled.div({
  padding: 8,
  fontSize: 12,
});

const baseState = {
  details: {},
  cancellable: false,
  cancelling: false,
  running: false,
  failed: false,
  crashed: false,
};

const testProviderInterfaces: TestProviders = {
  'component-tests': {
    type: Addon_TypesEnum.experimental_TEST_PROVIDER,
    id: 'component-tests',
    name: 'Component tests',
    render: () => <TestProvider>Component tests</TestProvider>,
    runnable: true,
    ...baseState,
  },
  'visual-tests': {
    type: Addon_TypesEnum.experimental_TEST_PROVIDER,
    id: 'visual-tests',
    name: 'Visual tests',
    render: () => <TestProvider>Visual tests</TestProvider>,
    runnable: true,
    ...baseState,
  },
  linting: {
    type: Addon_TypesEnum.experimental_TEST_PROVIDER,
    id: 'linting',
    name: 'Linting',
    render: () => <TestProvider>Linting</TestProvider>,
    ...baseState,
  },
};

// TODO: use correct type here
const testProviderStates: any = {
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
    testProviderInterfaces,
    testProviderStates,
    statusCount: 0,
    clearStatuses: fn(),
    onRunAll: fn(),
    errorCount: 0,
    errorsActive: false,
    setErrorsActive: fn(),
    warningCount: 0,
    warningsActive: false,
    setWarningsActive: fn(),
  },
  decorators: [
    (storyFn) => (
      <ManagerContext.Provider value={managerContext}>{storyFn()}</ManagerContext.Provider>
    ),
    (StoryFn) => (
      <div style={{ maxWidth: 232 }}>
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
    statusCount: 56,
    errorCount: 14,
    warningCount: 42,
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
  play: Expanded.play,
};

export const NoTestProvider: Story = {
  args: {
    testProviderInterfaces: {},
  },
};

export const NoTestProviderWithStatuses: Story = {
  args: {
    ...Statuses.args,
    testProviderInterfaces: {},
  },
};
