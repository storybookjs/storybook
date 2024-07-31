import { CallStates } from '@storybook/instrumenter';
import { StatusBadge } from './StatusBadge';

export default {
  title: 'StatusBadge',
  component: StatusBadge,
  parameters: { layout: 'padded' },
};

export const Pass = {
  args: { status: CallStates.DONE },
};

export const Active = {
  args: { status: CallStates.ACTIVE },
};

export const Waiting = {
  args: { status: CallStates.WAITING },
};

export const Fail = {
  args: { status: CallStates.ERROR },
};
