import React, { type FC, useEffect, useState } from 'react';

import {
  type Addon_Collection,
  type Addon_TestProviderType,
  Addon_TypesEnum,
} from 'storybook/internal/types';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { type API, ManagerContext } from 'storybook/manager-api';
import { expect, fireEvent, fn, waitFor, within } from 'storybook/test';

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
    once: fn().mockName('api::once'),
    updateTestProviderState: fn(),
  },
};

const registeredTestProviders: Addon_Collection<Addon_TestProviderType> = {
  'component-tests': {
    type: Addon_TypesEnum.experimental_TEST_PROVIDER,
    id: 'component-tests',
    render: () => <div>Component tests</div>,
  },
  'visual-tests': {
    type: Addon_TypesEnum.experimental_TEST_PROVIDER,
    id: 'visual-tests',
    render: () => <div>Visual tests</div>,
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
    successCount: 0,
    hasStatuses: false,
    notifications: [],
    api: {
      on: fn(),
      off: fn(),
      once: fn(),
      clearNotification: fn(),
      updateTestProviderState: fn(),
      emit: fn(),
      experimental_setFilter: fn(),
      getChannel: fn(),
      getElements: fn(() => ({})),
    } as any as API,
    onRunAll: fn(),
    registeredTestProviders,
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
  // do not test in chromatic
  parameters: {
    chromatic: {
      disableSnapshot: true,
    },
  },
  args: {
    registeredTestProviders: {
      'dynamic-height': {
        type: Addon_TypesEnum.experimental_TEST_PROVIDER,
        id: 'dynamic-height',
        render: () => <DynamicHeightDemo />,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement);

    const toggleButton = await screen.findByLabelText(/Expand/, {}, { timeout: 3000 });
    await fireEvent.click(toggleButton);

    const content = await screen.findByText('CUSTOM CONTENT WITH DYNAMIC HEIGHT');
    const collapse = screen.getByTestId('collapse');

    await expect(content).toBeVisible();

    await fireEvent.click(toggleButton);

    await waitFor(() => expect(collapse.getBoundingClientRect()).toHaveProperty('height', 0));

    await fireEvent.click(toggleButton);

    await waitFor(() => expect(collapse.getBoundingClientRect()).not.toHaveProperty('height', 0));
  },
};
