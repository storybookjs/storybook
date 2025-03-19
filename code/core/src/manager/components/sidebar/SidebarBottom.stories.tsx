import React, { type FC, useEffect, useState } from 'react';

import { Addon_TypesEnum } from 'storybook/internal/types';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { type API, ManagerContext } from 'storybook/manager-api';
import { expect, fireEvent, fn, waitFor, within } from 'storybook/test';

import type { TestProviders } from '../../../core-events';
import type { TestProviderStateByProviderId } from '../../../shared/test-provider-store';
import { SidebarBottomBase } from './SidebarBottom';

const DynamicHeightDemo: FC = () => {
  const [height, setHeight] = useState(100);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeight((h) => (h === 100 ? 200 : 100));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        height,
        transition: '1s height',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'hotpink',
      }}
    >
      CUSTOM CONTENT WITH DYNAMIC HEIGHT
    </div>
  );
};

const managerContext: any = {
  state: {
    docsOptions: {
      defaultName: 'Docs',
      autodocs: 'tag',
      docsMode: false,
    },
  },
  api: {
    on: fn().mockName('api::on'),
    off: fn().mockName('api::off'),
    updateTestProviderState: fn(),
  },
};

const testProviderInterfaces: TestProviders = {
  'component-tests': {
    type: Addon_TypesEnum.experimental_TEST_PROVIDER,
    id: 'component-tests',
    name: 'Component tests',
    render: () => <div>Component tests</div>,
    runnable: true,
    details: {},
    cancellable: true,
    cancelling: false,
    running: false,
    failed: false,
    crashed: false,
  },
  'visual-tests': {
    type: Addon_TypesEnum.experimental_TEST_PROVIDER,
    id: 'visual-tests',
    name: 'Visual tests',
    render: () => <div>Visual tests</div>,
    runnable: true,
    details: {},
    cancellable: true,
    cancelling: false,
    running: false,
    failed: false,
    crashed: false,
  },
};
const testProviderStates: TestProviderStateByProviderId = {
  'component-tests': 'test-provider-state:succeeded',
  'visual-tests': 'test-provider-state:pending',
};
const meta = {
  component: SidebarBottomBase,
  title: 'Sidebar/SidebarBottom',
  args: {
    isDevelopment: true,
    warningCount: 0,
    errorCount: 0,
    hasStatuses: false,
    notifications: [],
    api: {
      on: fn(),
      off: fn(),
      clearNotification: fn(),
      updateTestProviderState: fn(),
      emit: fn(),
      experimental_setFilter: fn(),
      getChannel: fn(),
      getElements: fn(() => ({})),
    } as any as API,
    onRunAll: fn(),
    testProviderInterfaces,
    testProviderStates,
  },
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (storyFn) => (
      <ManagerContext.Provider value={managerContext}>{storyFn()}</ManagerContext.Provider>
    ),
  ],
} satisfies Meta<typeof SidebarBottomBase>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Errors: Story = {
  args: {
    errorCount: 2,
    hasStatuses: true,
  },
};

export const Warnings: Story = {
  args: {
    warningCount: 2,
    hasStatuses: true,
  },
};

export const Both: Story = {
  args: {
    errorCount: 2,
    warningCount: 2,
    hasStatuses: true,
  },
};

export const DynamicHeight: Story = {
  args: {
    testProviderInterfaces: {
      'dynamic-height': {
        type: Addon_TypesEnum.experimental_TEST_PROVIDER,
        id: 'dynamic-height',
        name: 'Dynamic height',
        render: () => <DynamicHeightDemo />,
        runnable: true,
        details: {},
        cancellable: true,
        cancelling: false,
        running: false,
        failed: false,
        crashed: false,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const screen = await within(canvasElement);

    const toggleButton = await screen.getByLabelText(/Expand/);
    await fireEvent.click(toggleButton);

    const content = await screen.findByText('CUSTOM CONTENT WITH DYNAMIC HEIGHT');
    const collapse = await screen.getByTestId('collapse');

    await expect(content).toBeVisible();

    await fireEvent.click(toggleButton);

    await waitFor(() => expect(collapse.getBoundingClientRect()).toHaveProperty('height', 0));

    await fireEvent.click(toggleButton);

    await waitFor(() => expect(collapse.getBoundingClientRect()).not.toHaveProperty('height', 0));
  },
};
