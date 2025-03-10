import React, { type FC, useEffect, useState } from 'react';

import { type API, ManagerContext } from 'storybook/internal/manager-api';
import { Addon_TypesEnum } from 'storybook/internal/types';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, fireEvent, fn, waitFor, within } from 'storybook/test';

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
    testProviders: {
      'component-tests': {
        type: Addon_TypesEnum.experimental_TEST_PROVIDER,
        id: 'component-tests',
        title: () => 'Component tests',
        description: () => 'Ran 2 seconds ago',
        runnable: true,
      },
      'visual-tests': {
        type: Addon_TypesEnum.experimental_TEST_PROVIDER,
        id: 'visual-tests',
        title: () => 'Visual tests',
        description: () => 'Not run',
        runnable: true,
      },
    },
  },
  api: {
    on: fn().mockName('api::on'),
    off: fn().mockName('api::off'),
    updateTestProviderState: fn(),
  },
};

const meta = {
  component: SidebarBottomBase,
  title: 'Sidebar/SidebarBottom',
  args: {
    isDevelopment: true,
    warningCount: 0,
    errorCount: 0,
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
  },
};

export const Warnings: Story = {
  args: {
    warningCount: 2,
  },
};

export const Both: Story = {
  args: {
    errorCount: 2,
    warningCount: 2,
  },
};

export const DynamicHeight: Story = {
  decorators: [
    (storyFn) => (
      <ManagerContext.Provider
        value={{
          ...managerContext,
          state: {
            ...managerContext.state,
            testProviders: {
              custom: {
                type: Addon_TypesEnum.experimental_TEST_PROVIDER,
                id: 'custom',
                render: () => <DynamicHeightDemo />,
                runnable: true,
              },
            },
          },
        }}
      >
        {storyFn()}
      </ManagerContext.Provider>
    ),
  ],
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
