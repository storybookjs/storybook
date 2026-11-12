import { useSyncExternalStore } from 'react';

import type { EnhancedResults, Status } from './types.ts';
import { RuleType } from './types.ts';

export interface A11yState {
  ui: { highlighted: boolean; tab: RuleType };
  results: EnhancedResults | undefined;
  error: unknown;
  status: Status;
}

type Update = A11yState | ((state: A11yState) => A11yState);

export const initialA11yState: A11yState = {
  ui: {
    highlighted: false,
    tab: RuleType.VIOLATION,
  },
  results: undefined,
  error: undefined,
  status: 'initial',
};

let state = initialA11yState;
const listeners = new Set<() => void>();

/**
 * Only the context provider, the panel and the tab title read this state. A write to the shared
 * addon state would go through the manager store and re-render the whole manager, and this state
 * changes several times on every story render.
 */
export const a11yStore = {
  getState: () => state,
  setState: (update: Update) => {
    const next = typeof update === 'function' ? update(state) : update;
    if (next === state) {
      return;
    }
    state = next;
    listeners.forEach((listener) => listener());
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export const useA11yState = () =>
  [
    useSyncExternalStore(a11yStore.subscribe, a11yStore.getState, a11yStore.getState),
    a11yStore.setState,
  ] as const;
