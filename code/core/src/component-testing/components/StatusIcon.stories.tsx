import { CallStates } from '../../instrumenter/types.ts';
import { StatusIcon } from './StatusIcon.tsx';

export default {
  title: 'StatusIcon',
  component: StatusIcon,
};

export const Pending = {
  args: { status: CallStates.WAITING },
};

export const Active = {
  args: { status: CallStates.ACTIVE },
};

export const Error = {
  args: { status: CallStates.ERROR },
};

export const Done = {
  args: { status: CallStates.DONE },
};
