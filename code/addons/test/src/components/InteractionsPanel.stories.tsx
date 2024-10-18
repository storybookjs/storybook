import React from 'react';

import { ManagerContext } from 'storybook/internal/manager-api';
import { styled } from 'storybook/internal/theming';

import { CallStates } from '@storybook/instrumenter';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from '@storybook/test';

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
const managerContext: any = {
  state: {},
  api: {
    getDocsUrl: fn().mockName('api::getDocsUrl'),
    emit: fn().mockName('api::emit'),
  },
};

const meta = {
  title: 'InteractionsPanel',
  component: InteractionsPanel,
  decorators: [
    (Story: any) => (
      <ManagerContext.Provider value={managerContext}>
        <StyledWrapper id="panel-tab-content">
          <Story />
        </StyledWrapper>
      </ManagerContext.Provider>
    ),
  ],
  parameters: { layout: 'fullscreen' },
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
    storyId: 'story-id',
  },
} as Meta<typeof InteractionsPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Passing: Story = {
  args: {
    browserTestStatus: CallStates.DONE,
    interactions: getInteractions(CallStates.DONE),
  },
  play: async ({ args, canvasElement }) => {
    if (isChromatic()) {
      return;
    }
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
  },
};

export const Paused: Story = {
  args: {
    browserTestStatus: CallStates.ACTIVE,
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
    browserTestStatus: CallStates.ACTIVE,
    isPlaying: true,
    interactions: getInteractions(CallStates.ACTIVE),
  },
};

export const Failed: Story = {
  args: {
    browserTestStatus: CallStates.ERROR,
    hasException: true,
    interactions: getInteractions(CallStates.ERROR),
  },
};

export const CaughtException: Story = {
  args: {
    browserTestStatus: CallStates.ERROR,
    hasException: true,
    interactions: [],
    caughtException: new TypeError("Cannot read properties of undefined (reading 'args')"),
  },
};

export const DiscrepancyResult: Story = {
  args: {
    ...Failed.args,
    hasResultMismatch: true,
  },
};

export const Empty: Story = {
  args: {
    interactions: [],
  },
};
