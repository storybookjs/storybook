import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, userEvent, within } from 'storybook/test';

import { type Call, CallStates } from '../../instrumenter/types.ts';
import { getCalls } from '../mocks/index.ts';
import { Interaction } from './Interaction.tsx';
import ToolbarStories from './Toolbar.stories.tsx';

type Story = StoryObj<typeof Interaction>;

const createCall = (overrides: Partial<Call> = {}): Call => ({
  id: 'story--id [interaction]',
  storyId: 'story--id',
  cursor: 1,
  ancestors: [],
  path: [],
  method: 'step',
  args: ['Click button', { __function__: { name: '' } }],
  interceptable: true,
  retain: false,
  status: CallStates.DONE,
  ...overrides,
});

export default {
  title: 'Interaction',
  component: Interaction,
  decorators: [
    (Story) => (
      <ul style={{ listStyleType: 'none' }}>
        <Story />
      </ul>
    ),
  ],
  args: {
    callsById: new Map(getCalls(CallStates.DONE).map((call) => [call.id, call])),
    controls: ToolbarStories.args.controls,
    controlStates: ToolbarStories.args.controlStates,
    isHidden: false,
    isCollapsed: false,
    childCallIds: undefined,
    toggleCollapsed: () => {},
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
    call: getCalls(CallStates.DONE)[1],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', {
        name: 'Go to interaction row: Click button. Status: passed.',
      })
    ).toBeInTheDocument();
  },
};

export const WithParent: Story = {
  args: {
    call: { ...getCalls(CallStates.DONE, -1)[0], ancestors: ['parent-id'] },
  },
};

export const Disabled: Story = {
  args: { ...Done.args, controlStates: { ...ToolbarStories.args.controlStates, goto: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', {
        name: 'Interaction row: Click button. Status: passed.',
      })
    ).toBeInTheDocument();
  },
};

export const TrimmedStepLabelAria: Story = {
  args: {
    call: createCall({ args: ['  My step  '] }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', {
        name: 'Go to interaction row: My step. Status: passed.',
      })
    ).toBeInTheDocument();
  },
};

export const EmptyStepLabelFallbackAria: Story = {
  args: {
    call: createCall({
      args: ['   '],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', {
        name: 'Go to interaction row: step. Status: passed.',
      })
    ).toBeInTheDocument();
  },
};

/**
 * When `step` has no user label, `extractStepName` is the method name `step` — row ARIA must stay
 * readable.
 */
export const StepMethodFallbackAria: Story = {
  args: {
    call: {
      id: 'story--id [step-fallback]',
      storyId: 'story--id',
      cursor: 1,
      ancestors: [],
      path: [],
      method: 'step',
      args: [],
      interceptable: true,
      retain: false,
      status: CallStates.WAITING,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', {
        name: 'Go to interaction row: step. Status: pending.',
      })
    ).toBeInTheDocument();
  },
};

export const NestedStepMethodFallbackAria: Story = {
  args: {
    call: createCall({
      path: ['nested'],
      args: ['Should be ignored'],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', {
        name: 'Go to interaction row: step. Status: passed.',
      })
    ).toBeInTheDocument();
  },
};

export const ExpandedNestedStepAria: Story = {
  args: {
    call: createCall(),
    childCallIds: ['child-call-id'],
    isCollapsed: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', {
        name: 'Collapse nested interaction steps for Click button',
      })
    ).toHaveAttribute('aria-expanded', 'true');
  },
};

export const CollapsedNestedStepAria: Story = {
  args: {
    call: createCall(),
    childCallIds: ['child-call-id'],
    isCollapsed: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', {
        name: 'Expand nested interaction steps for Click button',
      })
    ).toHaveAttribute('aria-expanded', 'false');
  },
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
