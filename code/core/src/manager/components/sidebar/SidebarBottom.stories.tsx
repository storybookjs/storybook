import React, { type FC, Fragment, useEffect, useState } from 'react';

import { Addon_TypesEnum } from '@storybook/core/types';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, waitFor, within } from '@storybook/test';

import { type API, ManagerContext } from '@storybook/core/manager-api';
import { userEvent } from '@storybook/testing-library';

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
        watchable: true,
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

export default {
  component: SidebarBottomBase,
  title: 'Sidebar/SidebarBottom',
  args: {
    isDevelopment: true,

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
      <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
        <div style={{ height: 300, background: 'orangered' }} />
        {storyFn()}
      </div>
    ),
    (storyFn) => (
      <ManagerContext.Provider value={managerContext}>{storyFn()}</ManagerContext.Provider>
    ),
  ],
} as Meta<typeof SidebarBottomBase>;

export const Errors = {
  args: {
    status: {
      one: { 'sidebar-bottom-filter': { status: 'error' } },
      two: { 'sidebar-bottom-filter': { status: 'error' } },
    },
  },
};

export const Warnings = {
  args: {
    status: {
      one: { 'sidebar-bottom-filter': { status: 'warn' } },
      two: { 'sidebar-bottom-filter': { status: 'warn' } },
    },
  },
};

export const Both = {
  args: {
    status: {
      one: { 'sidebar-bottom-filter': { status: 'warn' } },
      two: { 'sidebar-bottom-filter': { status: 'warn' } },
      three: { 'sidebar-bottom-filter': { status: 'error' } },
      four: { 'sidebar-bottom-filter': { status: 'error' } },
    },
  },
};

export const DynamicHeight: StoryObj = {
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
    await userEvent.click(toggleButton);

    const content = await screen.findByText('CUSTOM CONTENT WITH DYNAMIC HEIGHT');
    const collapse = await screen.getByTestId('collapse');

    await expect(content).toBeVisible();

    await userEvent.click(toggleButton);

    await waitFor(() => expect(collapse.getBoundingClientRect()).toHaveProperty('height', 0));

    await userEvent.click(toggleButton);

    await waitFor(() => expect(collapse.getBoundingClientRect()).not.toHaveProperty('height', 0));
  },
};
