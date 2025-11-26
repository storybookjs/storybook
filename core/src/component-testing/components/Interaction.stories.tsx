import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, userEvent, within } from 'storybook/test';

import { CallStates } from '../../instrumenter/types';
import { getCalls } from '../mocks';
import { Interaction } from './Interaction';
import ToolbarStories from './Toolbar.stories';

type Story = StoryObj<typeof Interaction>;

export default {
  title: 'Interaction',
  component: Interaction,
  args: {
    callsById: new Map(getCalls(CallStates.DONE).map((call) => [call.id, call])),
    controls: ToolbarStories.args.controls,
    controlStates: ToolbarStories.args.controlStates,
  },
} as Meta<typeof Interaction>;

export const Render: Story = {
  args: {
    call: getCalls(CallStates.DONE, 1)[0],
  },
};

export const RenderError: Story = {
  args: {
    call: getCalls(CallStates.ERROR, 1)[0],
  },
};

export const Active: Story = {
  args: {
    call: getCalls(CallStates.ACTIVE, -1)[0],
  },
};

export const Waiting: Story = {
  args: {
    call: getCalls(CallStates.WAITING, -1)[0],
  },
};

export const Failed: Story = {
  args: {
    call: getCalls(CallStates.ERROR, -1)[0],
  },
};

export const Done: Story = {
  args: {
    call: getCalls(CallStates.DONE, -1)[0],
  },
};

export const WithParent: Story = {
  args: {
    call: { ...getCalls(CallStates.DONE, -1)[0], ancestors: ['parent-id'] },
  },
};

export const Disabled: Story = {
  args: { ...Done.args, controlStates: { ...ToolbarStories.args.controlStates, goto: false } },
};

export const Hovered: Story = {
  ...Done,
  globals: { sb_theme: 'light' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByRole('button'));
    await expect(canvas.getByTestId('icon-active')).toBeInTheDocument();
  },
};
