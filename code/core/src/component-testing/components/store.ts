import type { SetStateAction } from 'react';
import { useSyncExternalStore } from 'react';

import type { PanelState } from './Panel.tsx';

export const INITIAL_CONTROL_STATES = {
  detached: false,
  start: false,
  back: false,
  goto: false,
  next: false,
  end: false,
};

export const initialPanelState: PanelState = {
  status: 'rendering',
  controlStates: INITIAL_CONTROL_STATES,
  interactions: [],
  interactionsCount: 0,
  hasException: false,
  pausedAt: undefined,
  caughtException: undefined,
  unhandledErrors: undefined,
};

let state = initialPanelState;
const listeners = new Set<() => void>();

export const panelStore = {
  get: () => state,
  set: (next: SetStateAction<PanelState>) => {
    state = typeof next === 'function' ? next(state) : next;
    listeners.forEach((listener) => listener());
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export const usePanelState = () => useSyncExternalStore(panelStore.subscribe, panelStore.get);
