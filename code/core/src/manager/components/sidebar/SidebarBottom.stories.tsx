import { fn } from '@storybook/test';

import { SidebarBottomBase } from './SidebarBottom';

export default {
  component: SidebarBottomBase,
  args: {
    api: {
      experimental_setFilter: fn(),
      emit: fn(),
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
