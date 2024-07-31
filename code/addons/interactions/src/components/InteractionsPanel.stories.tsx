import React from 'react';
import type { StoryObj, Meta } from '@storybook/react';
import { CallStates } from '@storybook/instrumenter';
import { styled } from 'storybook/internal/theming';
import { userEvent, within, waitFor, expect } from '@storybook/test';
import { isChromatic } from '../../../../.storybook/isChromatic';

import { getCalls, getInteractions } from '../mocks';
import { InteractionsPanel } from './InteractionsPanel';
import SubnavStories from './Subnav.stories';

const StyledWrapper = styled.div(({ theme }) => ({
  backgroundColor: theme.background.content,
  color: theme.color.defaultText,
  display: 'block',
  height: '100%',
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  overflow: 'auto',
}));

const interactions = getInteractions(CallStates.DONE);

const meta = {
  title: 'InteractionsPanel',
  component: InteractionsPanel,
  decorators: [
    (Story: any) => (
      <StyledWrapper id="panel-tab-content">
        <Story />
      </StyledWrapper>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    theme: 'light', // stacked will break interactions
  },
  args: {
    calls: new Map(getCalls(CallStates.DONE).map((call) => [call.id, call])),
    controls: SubnavStories.args.controls,
    controlStates: SubnavStories.args.controlStates,
    interactions,
    fileName: 'addon-interactions.stories.tsx',
    hasException: false,
    isPlaying: false,
    onScrollToEnd: () => {},
    endRef: null,
    // prop for the AddonPanel used as wrapper of Panel
    active: true,
  },
} as Meta<typeof InteractionsPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Passing: Story = {
  args: {
    interactions: getInteractions(CallStates.DONE),
  },
};
Passing.play = async ({ args, canvasElement }) => {
  if (isChromatic()) return;
  const canvas = within(canvasElement);

  await waitFor(async () => {
    await userEvent.click(canvas.getByLabelText('Go to start'));
    await expect(args.controls.start).toHaveBeenCalled();
  });

  await waitFor(async () => {
    await userEvent.click(canvas.getByLabelText('Go back'));
    await expect(args.controls.back).toHaveBeenCalled();
  });

  await waitFor(async () => {
    await userEvent.click(canvas.getByLabelText('Go forward'));
    await expect(args.controls.next).not.toHaveBeenCalled();
  });

  await waitFor(async () => {
    await userEvent.click(canvas.getByLabelText('Go to end'));
    await expect(args.controls.end).not.toHaveBeenCalled();
  });

  await waitFor(async () => {
    await userEvent.click(canvas.getByLabelText('Rerun'));
    await expect(args.controls.rerun).toHaveBeenCalled();
  });
};

export const Paused: Story = {
  args: {
    isPlaying: true,
    interactions: getInteractions(CallStates.WAITING),
    controlStates: {
      start: false,
      back: false,
      goto: true,
      next: true,
      end: true,
    },
    pausedAt: interactions[interactions.length - 1].id,
  },
};

export const Playing: Story = {
  args: {
    isPlaying: true,
    interactions: getInteractions(CallStates.ACTIVE),
  },
};

export const Failed: Story = {
  args: {
    hasException: true,
    interactions: getInteractions(CallStates.ERROR),
  },
};

// export const NoInteractions: Story = {
//   args: {
//     interactions: [],
//   },
// };

export const CaughtException: Story = {
  args: {
    hasException: true,
    interactions: [],
    caughtException: new TypeError("Cannot read properties of undefined (reading 'args')"),
  },
};
