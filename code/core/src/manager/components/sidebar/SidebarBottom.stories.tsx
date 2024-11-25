import React from 'react';

import { Addon_TypesEnum } from '@storybook/core/types';
import type { Meta } from '@storybook/react';
import { fn } from '@storybook/test';

import { type API, ManagerContext } from '@storybook/core/manager-api';

import { SidebarBottomBase } from './SidebarBottom';

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
  decorators: [
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
