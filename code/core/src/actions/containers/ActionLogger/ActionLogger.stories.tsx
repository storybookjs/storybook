import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import type { API, State } from 'storybook/manager-api';
import { ManagerContext } from 'storybook/manager-api';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
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
function createMockApi(): API {
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

  return api as unknown as API;
}

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
 * Yields to the event loop after each emission so React can process state updates.
 * Callers should still synchronize on actual UI state (e.g., via `waitFor` / `findBy*`).
 */
async function emitActions(api: API, actions: ActionDisplay[]) {
  for (const action of actions) {
    api.emit(EVENT_ID, action);
    // Yield to allow React to process the state update without relying on a fixed timeout
    await Promise.resolve();
  }
}

const meta = {
  title: 'ActionLogger',
  component: ActionLogger,
  loaders: [() => ({ api: createMockApi() })],
  render(args, { loaded: { api } }) {
    const managerContext = {
      state: {} as State,
      api,
    };

    return (
      <ManagerContext.Provider value={managerContext}>
        <StyledWrapper id="panel-tab-content">
          <ActionLogger {...args} api={api} />
        </StyledWrapper>
      </ManagerContext.Provider>
    );
  },
  parameters: { layout: 'fullscreen' },
  args: {
    active: true,
  },
} as Meta<typeof ActionLogger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const SingleAction: Story = {
  play: async ({ loaded: { api }, canvas }) => {
    await emitActions(api, [makeAction('onClick', [{ target: 'button' }], 'action-click')]);

    await waitFor(() => expect(canvas.getByText('onClick')).toBeInTheDocument());
  },
};

export const RepeatedAction: Story = {
  play: async ({ loaded: { api }, canvas }) => {
    const action = makeAction('onClick', [{ target: 'button' }], 'action-click');

    // Emit the same action 5 times — the container deduplicates via count
    await emitActions(api, [action, action, action, action, action]);

    await waitFor(() => expect(canvas.getByText('5')).toBeInTheDocument());
  },
};

export const MultipleActions: Story = {
  play: async ({ loaded: { api }, canvas }) => {
    await emitActions(api, [
      makeAction('onClick', [{ target: 'button' }], 'action-1'),
      makeAction('onChange', ['new value'], 'action-2'),
      makeAction('onSubmit', [{ formData: { name: 'test' } }], 'action-3'),
    ]);

    await waitFor(() => expect(canvas.getByText('onClick')).toBeInTheDocument());
    await waitFor(() => expect(canvas.getByText('onChange')).toBeInTheDocument());
    await waitFor(() => expect(canvas.getByText('onSubmit')).toBeInTheDocument());
  },
};

export const LimitDiscardsOldest: Story = {
  name: 'Limit discards oldest actions',
  play: async ({ loaded: { api }, canvas }) => {
    const limit = 3;

    // Emit 5 actions with a limit of 3 — only the last 3 should remain
    await emitActions(api, [
      makeAction('onFirst', ['1st'], 'action-1', limit),
      makeAction('onSecond', ['2nd'], 'action-2', limit),
      makeAction('onThird', ['3rd'], 'action-3', limit),
      makeAction('onFourth', ['4th'], 'action-4', limit),
      makeAction('onFifth', ['5th'], 'action-5', limit),
    ]);

    // The newest 3 should be visible
    await waitFor(() => expect(canvas.getByText('onThird')).toBeInTheDocument());
    await waitFor(() => expect(canvas.getByText('onFourth')).toBeInTheDocument());
    await waitFor(() => expect(canvas.getByText('onFifth')).toBeInTheDocument());

    // The oldest 2 should have been discarded
    expect(canvas.queryByText('onFirst')).not.toBeInTheDocument();
    expect(canvas.queryByText('onSecond')).not.toBeInTheDocument();
  },
};

export const LimitWithRepeatedActions: Story = {
  name: 'Limit with repeated (deduplicated) actions',
  play: async ({ loaded: { api }, canvas }) => {
    const limit = 3;

    // Emit 2 unique actions, then repeat the last one — should stay within limit
    await emitActions(api, [
      makeAction('onAlpha', ['a'], 'action-a', limit),
      makeAction('onBeta', ['b'], 'action-b', limit),
      makeAction('onBeta', ['b'], 'action-c', limit), // same data, should increment count
    ]);

    await waitFor(() => expect(canvas.getByText('onAlpha')).toBeInTheDocument());
    await waitFor(() => expect(canvas.getByText('onBeta')).toBeInTheDocument());
    // The repeated action should show count 2
    await waitFor(() => expect(canvas.getByText('2')).toBeInTheDocument());
  },
};

export const ClearActions: Story = {
  name: 'Clear button removes all actions',
  play: async ({ loaded: { api }, canvas }) => {
    await emitActions(api, [
      makeAction('onClick', [{ target: 'button' }], 'action-1'),
      makeAction('onChange', ['value'], 'action-2'),
    ]);

    await waitFor(() => expect(canvas.getByText('onClick')).toBeInTheDocument());

    // Click the Clear button
    const clearButton = canvas.getByText('Clear');
    await userEvent.click(clearButton);

    // Actions should be gone
    expect(canvas.queryByText('onClick')).not.toBeInTheDocument();
    expect(canvas.queryByText('onChange')).not.toBeInTheDocument();
  },
};
