import { fn } from '@storybook/test';

import { FilterToggle } from './FilterToggle';

export default {
  component: FilterToggle,
  title: 'Sidebar/FilterToggle',
  args: {
    active: false,
    onClick: fn(),
  },
};

export const Errors = {
  args: {
    count: 2,
    label: 'Error',
    status: 'critical',
  },
};

export const ErrorsActive = {
  args: {
    ...Errors.args,
    active: true,
  },
};

export const Warning = {
  args: {
    count: 12,
    label: 'Warning',
    status: 'warning',
  },
};

export const WarningActive = {
  args: {
    ...Warning.args,
    active: true,
  },
};
