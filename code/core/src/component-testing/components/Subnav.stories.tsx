import React from 'react';

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
      detached: false,
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

export const Wait = {
  args: {
    status: 'rendering',
    controlStates: {
      detached: false,
      start: false,
      back: false,
      goto: false,
      next: false,
      end: false,
    },
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
    controlStates: {
      detached: false,
      start: false,
      back: false,
      goto: false,
      next: false,
      end: false,
    },
  },
};

export const AtStart = {
  args: {
    status: 'playing',
    controlStates: {
      detached: false,
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
      detached: false,
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
    controlStates: {
      detached: false,
      start: false,
      back: false,
      goto: false,
      next: false,
      end: false,
    },
  },
};

export const Detached = {
  args: {
    status: 'completed',
    controlStates: {
      detached: true,
      start: false,
      back: false,
      goto: false,
      next: false,
      end: false,
    },
  },
};

export const WithOpenInEditorLink = {
  args: {
    status: 'completed',
    controlStates: {
      detached: true,
      start: false,
      back: false,
      goto: false,
      next: false,
      end: false,
    },
    canOpenInEditor: true,
  },
};
