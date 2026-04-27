import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ManagerContext } from 'storybook/manager-api';
import { expect, fn, userEvent, within } from 'storybook/test';
import { styled } from 'storybook/theming';

import { isChromatic } from '../../../../.storybook/isChromatic.ts';
import { CallStates } from '../../instrumenter/types.ts';
import { getCalls, getInteractions } from '../mocks/index.ts';
import { InteractionsPanel } from './InteractionsPanel.tsx';
import ToolbarStories from './Toolbar.stories.tsx';
import { destroyAnnouncer } from '@react-aria/live-announcer';

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
    controls: ToolbarStories.args.controls,
    controlStates: ToolbarStories.args.controlStates,
    interactions,
    fileName: 'addon-interactions.stories.tsx',
    hasException: false,
    onScrollToEnd: () => {},
    endRef: null,
    // prop for the AddonPanel used as wrapper of Panel
    active: true,
  },
  beforeEach: () => {
    destroyAnnouncer();
  },
} as Meta<typeof InteractionsPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

const withNestedStepToggle = (isCollapsed: boolean) => {
  return getInteractions(CallStates.DONE).map((interaction) =>
    interaction.method === 'step'
      ? { ...interaction, childCallIds: ['child-call-id'], isCollapsed }
      : interaction
  );
};

const expectLiveAnnouncement = async ({
  canvas,
  ariaLive,
  text,
  isListBusy,
}: {
  canvas: ReturnType<typeof within>;
  ariaLive: 'polite' | 'assertive';
  text: string;
  isListBusy: boolean;
}) => {
  await expect(document.body).toHaveLiveRegion({ text, level: ariaLive });
  await expect(canvas.getByRole('list')).toHaveAttribute(
    'aria-busy',
    isListBusy ? 'true' : 'false'
  );
};

export const Passing: Story = {
  args: {
    browserTestStatus: CallStates.DONE,
    interactions: getInteractions(CallStates.DONE),
  },
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Expose the completed run status for assistive tech', async () => {
      await expectLiveAnnouncement({
        canvas,
        ariaLive: 'polite',
        text: 'Component test completed successfully.',
        isListBusy: false,
      });
    });

    if (isChromatic()) {
      return;
    }

    await step('Go to start', async () => {
      const btn = await canvas.findByLabelText('Go to start');
      await userEvent.click(btn);
      await expect(args.controls.start).toHaveBeenCalled();
    });

    await step('Go back', async () => {
      const btn = await canvas.findByLabelText('Go back');
      await userEvent.click(btn);
      await expect(args.controls.back).toHaveBeenCalled();
    });

    await step('Go forward', async () => {
      const btn = await canvas.findByLabelText('Go forward');
      await userEvent.click(btn);
      await expect(args.controls.next).not.toHaveBeenCalled();
    });

    await step('Go to end', async () => {
      const btn = await canvas.findByLabelText('Go to end');
      await userEvent.click(btn);
      await expect(args.controls.end).not.toHaveBeenCalled();
    });

    await step('Rerun', async () => {
      const btn = await canvas.findByLabelText('Rerun');
      await userEvent.click(btn);
      await expect(args.controls.rerun).toHaveBeenCalled();
    });
  },
};

export const AccessibilityLabels: Story = {
  args: {
    interactions: withNestedStepToggle(false),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole('list');

    expect(list.tagName).toBe('OL');
    expect(within(list).getAllByRole('listitem').length).toBeGreaterThan(0);
    await expect(
      canvas.getByRole('button', {
        name: 'Go to interaction row: Click button. Status: passed.',
      })
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', {
        name: 'Collapse nested interaction steps for Click button',
      })
    ).toHaveAttribute('aria-expanded', 'true');
  },
};

export const CollapsedNestedStep: Story = {
  args: {
    interactions: withNestedStepToggle(true),
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expectLiveAnnouncement({
      canvas,
      ariaLive: 'polite',
      text: 'Component test is running.',
      isListBusy: true,
    });
  },
};

export const Failed: Story = {
  args: {
    status: 'errored',
    browserTestStatus: CallStates.ERROR,
    hasException: true,
    interactions: getInteractions(CallStates.ERROR),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expectLiveAnnouncement({
      canvas,
      ariaLive: 'assertive',
      text: 'Component test failed.',
      isListBusy: false,
    });
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

export const Rendering: Story = {
  args: {
    status: 'rendering',
    browserTestStatus: CallStates.ACTIVE,
    interactions: getInteractions(CallStates.ACTIVE),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expectLiveAnnouncement({
      canvas,
      ariaLive: 'polite',
      text: 'Component test is rendering.',
      isListBusy: true,
    });
  },
};

export const CompletedWithException: Story = {
  args: {
    status: 'completed',
    browserTestStatus: CallStates.ERROR,
    hasException: true,
    interactions: getInteractions(CallStates.DONE),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expectLiveAnnouncement({
      canvas,
      ariaLive: 'assertive',
      text: 'Component test failed.',
      isListBusy: false,
    });
  },
};

export const Aborted: Story = {
  args: {
    status: 'aborted',
    browserTestStatus: CallStates.DONE,
    interactions: getInteractions(CallStates.DONE),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expectLiveAnnouncement({
      canvas,
      ariaLive: 'polite',
      text: 'Component test was aborted.',
      isListBusy: false,
    });
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
