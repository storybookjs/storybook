import { Addon_TypesEnum } from '@storybook/core/types';
import { fn } from '@storybook/test';

import { SidebarBottomBase } from './SidebarBottom';

export default {
  component: SidebarBottomBase,
  args: {
    api: {
      clearNotification: fn(),
      emit: fn(),
      experimental_setFilter: fn(),
      getChannel: fn(),
      getElements: fn(() => ({
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
      })),
    },
  },
};

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
