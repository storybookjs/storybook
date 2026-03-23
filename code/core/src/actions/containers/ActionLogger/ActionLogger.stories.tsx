import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ManagerContext } from 'storybook/manager-api';
import { expect, fn, userEvent, within } from 'storybook/test';
import { styled } from 'storybook/theming';

import type { ActionDisplay } from '../../models';
import { EVENT_ID } from '../../constants';
import ActionLogger from './index';

const StyledWrapper = styled.div(({ theme }) => ({
  backgroundColor: theme.background.content,
  color: theme.color.defaultText,
  display: 'block',
  height: '400px',
  position: 'relative',
  overflow: 'auto',
}));

/**
 * A minimal event-emitter mock for the Storybook manager API.
 * The container calls `api.on(EVENT_ID, handler)` to register its `addAction`
 * callback. We capture that handler so that play functions can call
 * `api.emit(EVENT_ID, action)` to drive the container's state.
 */
function createMockApi() {
  const listeners: Record<string, Set<(...args: any[]) => void>> = {};

  const api = {
    on(event: string, handler: (...args: any[]) => void) {
      if (!listeners[event]) {
        listeners[event] = new Set();
      }
      listeners[event].add(handler);
    },
    off(event: string, handler: (...args: any[]) => void) {
      listeners[event]?.delete(handler);
    },
    emit(event: string, ...args: any[]) {
      listeners[event]?.forEach((h) => h(...args));
    },
    getCurrentParameter: fn().mockName('api::getCurrentParameter').mockReturnValue(undefined),
    getDocsUrl: fn().mockName('api::getDocsUrl'),
    getData: fn().mockName('api::getData'),
  };

  return api;
}

/** Module-level reference so play functions can access the same mock. */
let currentApi: ReturnType<typeof createMockApi>;

function makeAction(name: string, args: any[], id: string, limit: number = 50): ActionDisplay {
  return {
    id,
    data: { name, args },
    count: 0,
    options: { limit, clearOnStoryChange: true },
  };
}

/**
 * Helper to emit actions into the container via the mock API.
 * Waits briefly after each emission for React state to settle.
 */
async function emitActions(actions: ActionDisplay[]) {
  for (const action of actions) {
    currentApi.emit(EVENT_ID, action);
    // Let React process the state update
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

const meta = {
  title: 'ActionLogger',
  component: ActionLogger,
  decorators: [
    (Story: any) => {
      // Fresh mock API per story render
      currentApi = createMockApi();
      const managerContext: any = {
        state: {},
        api: currentApi,
      };
      return (
        <ManagerContext.Provider value={managerContext}>
          <StyledWrapper id="panel-tab-content">
            <Story />
          </StyledWrapper>
        </ManagerContext.Provider>
      );
    },
  ],
  parameters: { layout: 'fullscreen' },
  args: {
    active: true,
    // The container receives `api` as a prop. We pass the mock here, but the
    // decorator will override it with a fresh instance each render via context.
    // We cast to `any` because our mock intentionally doesn't implement the
    // full API interface — only the parts the ActionLogger container uses.
    api: {} as any,
  },
  render: (args) => {
    // Use the currentApi that was just created by the decorator
    return <ActionLogger active={args.active} api={currentApi as any} />;
  },
} as Meta<typeof ActionLogger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const SingleAction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await emitActions([makeAction('onClick', [{ target: 'button' }], 'action-click')]);

    await expect(canvas.getByText('onClick')).toBeInTheDocument();
  },
};

export const RepeatedAction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const action = makeAction('onClick', [{ target: 'button' }], 'action-click');

    // Emit the same action 5 times — the container deduplicates via count
    await emitActions([action, action, action, action, action]);

    await expect(canvas.getByText('5')).toBeInTheDocument();
  },
};

export const MultipleActions: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await emitActions([
      makeAction('onClick', [{ target: 'button' }], 'action-1'),
      makeAction('onChange', ['new value'], 'action-2'),
      makeAction('onSubmit', [{ formData: { name: 'test' } }], 'action-3'),
    ]);

    await expect(canvas.getByText('onClick')).toBeInTheDocument();
    await expect(canvas.getByText('onChange')).toBeInTheDocument();
    await expect(canvas.getByText('onSubmit')).toBeInTheDocument();
  },
};

export const LimitDiscardsOldest: Story = {
  name: 'Limit discards oldest actions',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const limit = 3;

    // Emit 5 actions with a limit of 3 — only the last 3 should remain
    await emitActions([
      makeAction('onFirst', ['1st'], 'action-1', limit),
      makeAction('onSecond', ['2nd'], 'action-2', limit),
      makeAction('onThird', ['3rd'], 'action-3', limit),
      makeAction('onFourth', ['4th'], 'action-4', limit),
      makeAction('onFifth', ['5th'], 'action-5', limit),
    ]);

    // The newest 3 should be visible
    await expect(canvas.getByText('onThird')).toBeInTheDocument();
    await expect(canvas.getByText('onFourth')).toBeInTheDocument();
    await expect(canvas.getByText('onFifth')).toBeInTheDocument();

    // The oldest 2 should have been discarded
    expect(canvas.queryByText('onFirst')).not.toBeInTheDocument();
    expect(canvas.queryByText('onSecond')).not.toBeInTheDocument();
  },
};

export const LimitWithRepeatedActions: Story = {
  name: 'Limit with repeated (deduplicated) actions',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const limit = 3;

    // Emit 2 unique actions, then repeat the last one — should stay within limit
    await emitActions([
      makeAction('onAlpha', ['a'], 'action-a', limit),
      makeAction('onBeta', ['b'], 'action-b', limit),
      makeAction('onBeta', ['b'], 'action-c', limit), // same data, should increment count
    ]);

    await expect(canvas.getByText('onAlpha')).toBeInTheDocument();
    await expect(canvas.getByText('onBeta')).toBeInTheDocument();
    // The repeated action should show count 2
    await expect(canvas.getByText('2')).toBeInTheDocument();
  },
};

export const ClearActions: Story = {
  name: 'Clear button removes all actions',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await emitActions([
      makeAction('onClick', [{ target: 'button' }], 'action-1'),
      makeAction('onChange', ['value'], 'action-2'),
    ]);

    await expect(canvas.getByText('onClick')).toBeInTheDocument();

    // Click the Clear button
    const clearButton = canvas.getByText('Clear');
    await userEvent.click(clearButton);

    // Actions should be gone
    expect(canvas.queryByText('onClick')).not.toBeInTheDocument();
    expect(canvas.queryByText('onChange')).not.toBeInTheDocument();
  },
};
