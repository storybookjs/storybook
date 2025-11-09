import { StatusBadge } from './StatusBadge';

export default {
  title: 'StatusBadge',
  component: StatusBadge,
  parameters: { layout: 'padded' },
};

export const Wait = {
  args: { status: 'rendering' },
};

export const Runs = {
  args: { status: 'playing' },
};

export const Pass = {
  args: { status: 'completed' },
};

export const Fail = {
  args: { status: 'errored' },
};

export const Bail = {
  args: { status: 'aborted' },
};
