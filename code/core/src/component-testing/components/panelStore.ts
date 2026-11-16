import { useSyncExternalStore } from 'react';

import { isEqual } from 'es-toolkit/predicate';

import type { Call, ControlStates } from '../../instrumenter/types.ts';
import type { SerializedError } from './InteractionsPanel.tsx';
import type { PlayStatus } from './StatusBadge.tsx';

type Update<T> = T | ((state: T) => T);

export interface PanelStore<T> {
  getState: () => T;
  setState: (update: Update<T>) => void;
  subscribe: (listener: () => void) => () => void;
}

/** A call of the instrumenter log, as the panel lists it. */
export type Interaction = Call & {
  childCallIds?: Call['id'][];
  isHidden: boolean;
  isCollapsed: boolean;
  toggleCollapsed: () => void;
};

export interface PanelState {
  status: PlayStatus;
  controlStates: ControlStates;
  interactions: Interaction[];
  interactionsCount: number;
  hasException: boolean;
  /**
   * Incremented on every sync from the instrumenter. A sync can carry a log equal to the previous
   * one while a call it references has new arguments (an `expect` retried by `waitFor`), and the
   * store would otherwise drop it as an equal state.
   */
  revision: number;
  pausedAt?: Call['id'];
  caughtException?: Error;
  unhandledErrors?: SerializedError[];
}

export const INITIAL_CONTROL_STATES: ControlStates = {
  detached: false,
  start: false,
  back: false,
  goto: false,
  next: false,
  end: false,
};

export const INITIAL_PANEL_STATE: PanelState = {
  status: 'rendering',
  controlStates: INITIAL_CONTROL_STATES,
  interactions: [],
  interactionsCount: 0,
  hasException: false,
  revision: 0,
  pausedAt: undefined,
  caughtException: undefined,
  unhandledErrors: undefined,
};

// TODO(Storybook 12): Workaround. Delete this store once the manager adopts a UniversalStore or
// OSA based alternative for addon-local state.
// Context: https://github.com/storybookjs/storybook/pull/37391
/**
 * A store for state that only this addon's panel and tab title read. A write to the shared addon
 * state goes through the manager store and re-renders the whole manager, and this state changes
 * several times on every story render.
 */
export const createPanelStore = <T>(initialState: T): PanelStore<T> => {
  let state = initialState;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    // Handlers rebuild the state from the instrumenter log on most story events, often to the same
    // value. An equal state is not published, so subscribers keep their memoized output.
    setState: (update) => {
      const next = typeof update === 'function' ? (update as (state: T) => T)(state) : update;
      if (next === state || isEqual(next, state)) {
        return;
      }
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

/** The state of the interactions panel, shared by the panel and its tab title. */
export const panelStore = createPanelStore<PanelState>(INITIAL_PANEL_STATE);

export const usePanelState = () =>
  useSyncExternalStore(panelStore.subscribe, panelStore.getState, panelStore.getState);
