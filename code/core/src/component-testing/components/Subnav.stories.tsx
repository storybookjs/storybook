import { action } from 'storybook/actions';

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

const controlsDisabled = {
  start: false,
  back: false,
  goto: false,
  next: false,
  end: false,
};

export const Wait = {
  args: {
    status: 'rendering',
    controlStates: controlsDisabled,
  },
};

export const Runs = {
  args: {
    status: 'playing',
  },
};

export const Pass = {
  args: {
    status: 'completed',
  },
};

export const Fail = {
  args: {
    status: 'errored',
  },
};

export const Bail = {
  args: {
    status: 'aborted',
    controlStates: controlsDisabled,
  },
};

export const AtStart = {
  args: {
    status: 'playing',
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
    status: 'playing',
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
    status: 'playing',
    controlStates: controlsDisabled,
  },
};
