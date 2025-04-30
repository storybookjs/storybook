import { action } from 'storybook/actions';

import { CallStates } from '../../instrumenter/types';
import { Subnav } from './Subnav';

export default {
  title: 'Subnav',
  component: Subnav,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    controls: {
      start: action('start'),
      back: action('back'),
      goto: action('goto'),
      next: action('next'),
      end: action('end'),
      rerun: action('rerun'),
    },
    controlStates: {
      start: true,
      back: true,
      goto: true,
      next: false,
      end: false,
    },
    storyFileName: 'Subnav.stories.tsx',
    hasNext: true,
    hasPrevious: true,
  },
};

export const Pass = {
  args: {
    status: CallStates.DONE,
  },
};

export const Fail = {
  args: {
    status: CallStates.ERROR,
  },
};

export const Runs = {
  args: {
    status: CallStates.WAITING,
  },
};

export const AtStart = {
  args: {
    status: CallStates.WAITING,
    controlStates: {
      start: false,
      back: false,
      goto: true,
      next: true,
      end: true,
    },
  },
};

export const Midway = {
  args: {
    status: CallStates.WAITING,
    controlStates: {
      start: true,
      back: true,
      goto: true,
      next: true,
      end: true,
    },
  },
};

export const Locked = {
  args: {
    status: CallStates.ACTIVE,
    controlStates: {
      start: false,
      back: false,
      goto: false,
      next: false,
      end: false,
    },
  },
};
