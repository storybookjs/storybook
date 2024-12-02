import React from 'react';

import type { Listener } from '@storybook/core/channels';
import { styled } from '@storybook/core/theming';
import { Addon_TypesEnum } from '@storybook/core/types';
import type { Meta, StoryObj } from '@storybook/react';
import { fireEvent, fn } from '@storybook/test';

import { TESTING_MODULE_CONFIG_CHANGE, type TestProviders } from '@storybook/core/core-events';
import { ManagerContext, mockChannel } from '@storybook/core/manager-api';

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
  watching: false,
  failed: false,
  crashed: false,
};

const testProviders: TestProviders[keyof TestProviders][] = [
  {
    type: Addon_TypesEnum.experimental_TEST_PROVIDER,
    id: 'component-tests',
    name: 'Component tests',
    title: () => 'Component tests',
    description: () => 'Ran 2 seconds ago',
    runnable: true,
    watchable: true,
    ...baseState,
  },
  {
    type: Addon_TypesEnum.experimental_TEST_PROVIDER,
    id: 'visual-tests',
    name: 'Visual tests',
    title: () => 'Visual tests',
    description: () => 'Not run',
    runnable: true,
    ...baseState,
  },
  {
    type: Addon_TypesEnum.experimental_TEST_PROVIDER,
    id: 'linting',
    name: 'Linting',
    render: () => <TestProvider>Custom render function</TestProvider>,
    ...baseState,
    watching: true,
  },
];

let triggerUpdate: () => void;
const channel = mockChannel();
const managerContext: any = {
  api: {
    on: (eventName: string, listener: Listener) => {
      if (eventName === TESTING_MODULE_CONFIG_CHANGE) {
        triggerUpdate = listener;
      }
      return channel.on(eventName, listener);
    },
    off: (eventName: string, listener: Listener) => channel.off(eventName, listener),
    runTestProvider: fn().mockName('api::runTestProvider'),
    cancelTestProvider: fn().mockName('api::cancelTestProvider'),
    updateTestProviderState: fn().mockName('api::updateTestProviderState'),
    setTestProviderWatchMode: fn().mockName('api::setTestProviderWatchMode'),
  },
};

const meta = {
  component: TestingModule,
  title: 'Sidebar/TestingModule',
  args: {
    testProviders,
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
    testProviders: [{ ...testProviders[0], running: true }, ...testProviders.slice(1)],
  },
  play: Expanded.play,
};

export const RunningAll: Story = {
  args: {
    testProviders: testProviders.map((tp) => ({ ...tp, running: !!tp.runnable })),
  },
  play: Expanded.play,
};

export const CollapsedRunning: Story = {
  args: RunningAll.args,
};

export const Cancellable: Story = {
  args: {
    testProviders: [
      { ...testProviders[0], running: true, cancellable: true },
      ...testProviders.slice(1),
    ],
  },
  play: Expanded.play,
};

export const Cancelling: Story = {
  args: {
    testProviders: [
      { ...testProviders[0], running: true, cancellable: true, cancelling: true },
      ...testProviders.slice(1),
    ],
  },
  play: Expanded.play,
};

export const Watching: Story = {
  args: {
    testProviders: [{ ...testProviders[0], watching: true }, ...testProviders.slice(1)],
  },
  play: Expanded.play,
};

export const Failing: Story = {
  args: {
    testProviders: [
      { ...testProviders[0], failed: true, running: true },
      ...testProviders.slice(1),
    ],
  },
  play: Expanded.play,
};

export const Failed: Story = {
  args: {
    testProviders: [{ ...testProviders[0], failed: true }, ...testProviders.slice(1)],
  },
  play: Expanded.play,
};

export const Crashed: Story = {
  args: {
    testProviders: [
      {
        ...testProviders[0],
        render: () => (
          <TestProvider>
            Component tests didn't complete
            <br />
            Problems!
          </TestProvider>
        ),
        crashed: true,
      },
      ...testProviders.slice(1),
    ],
  },
  play: Expanded.play,
};

export const Updated: Story = {
  args: {},
  play: async (context) => {
    await Expanded.play!(context);
    triggerUpdate?.();
  },
};

export const NoTestProvider: Story = {
  args: {
    testProviders: [],
  },
};
