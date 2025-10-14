import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ManagerContext } from 'storybook/manager-api';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { styled } from 'storybook/theming';

import { isChromatic } from '../../../../.storybook/isChromatic';
import { CallStates } from '../../instrumenter/types';
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
    getData: fn()
      .mockName('api::getData')
      .mockImplementation(() => ({
        importPath: 'core/src/component-testing/components/InteractionsPanel.stories.tsx',
      })),
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
    status: 'completed',
    calls: new Map(getCalls(CallStates.DONE).map((call) => [call.id, call])),
    controls: SubnavStories.args.controls,
    controlStates: SubnavStories.args.controlStates,
    interactions,
    fileName: 'addon-interactions.stories.tsx',
    hasException: false,
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
    status: 'playing',
    browserTestStatus: CallStates.ACTIVE,
    interactions: getInteractions(CallStates.WAITING),
    controlStates: {
      detached: false,
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
    status: 'playing',
    browserTestStatus: CallStates.ACTIVE,
    interactions: getInteractions(CallStates.ACTIVE),
  },
};

export const Failed: Story = {
  args: {
    status: 'errored',
    browserTestStatus: CallStates.ERROR,
    hasException: true,
    interactions: getInteractions(CallStates.ERROR),
  },
};

export const CaughtException: Story = {
  args: {
    status: 'errored',
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

export const DetachedDebugger = {
  args: {
    browserTestStatus: CallStates.DONE,
    interactions: getInteractions(CallStates.DONE),
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

export const RenderOnly: Story = {
  args: {
    browserTestStatus: CallStates.DONE,
    interactions: getInteractions(CallStates.DONE).slice(0, 1),
  },
};

export const Empty: Story = {
  args: {
    interactions: [],
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
