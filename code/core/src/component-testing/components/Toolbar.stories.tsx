import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { action } from 'storybook/actions';
import type { API } from 'storybook/manager-api';
import { expect, userEvent } from 'storybook/test';

import { Toolbar } from './Toolbar.tsx';

const api = {
  openInEditor: action('openInEditor'),
} as unknown as API;

const meta = {
  title: 'Toolbar',
  component: Toolbar,
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
    storyFileName: 'Toolbar.stories.tsx',
    api,
  },
} satisfies Meta<typeof Toolbar>;

export default meta;

type Story = StoryObj<typeof meta>;

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

export const PreventsFocusLossOnPointerDown: Story = {
  tags: ['vitest'],
  render: (args) => (
    <>
      <input data-testid="test-input" style={{ display: 'block', marginBottom: 8 }} />
      <Toolbar {...args} />
    </>
  ),
  args: {
    status: 'playing',
    onScrollToEnd: action('scrollToEnd'),
    controlStates: {
      detached: false,
      start: true,
      back: true,
      goto: true,
      next: true,
      end: true,
    },
  },
  play: async ({ canvas }) => {
    const input = canvas.getByTestId('test-input');
    input.focus();
    await expect(input).toHaveFocus();

    for (const name of [
      'Scroll to end',
      'Go to start',
      'Go back',
      'Go forward',
      'Go to end',
      'Rerun',
    ]) {
      await userEvent.pointer({
        target: canvas.getByRole('button', { name }),
        keys: '[MouseLeft]',
      });
      await expect(input).toHaveFocus();
    }
  },
};
