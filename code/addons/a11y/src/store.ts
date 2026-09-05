import type { SetStateAction } from 'react';
import { useSyncExternalStore } from 'react';

import type { EnhancedResults, Status } from './types.ts';
import { RuleType } from './types.ts';

export interface A11yState {
  ui: { highlighted: boolean; tab: RuleType };
  results: EnhancedResults | undefined;
  error: unknown;
  status: Status;
}

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

export const a11yStore = {
  get: () => state,
  set: (next: SetStateAction<A11yState>) => {
    state = typeof next === 'function' ? next(state) : next;
    listeners.forEach((listener) => listener());
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export const useA11yState = () => useSyncExternalStore(a11yStore.subscribe, a11yStore.get);
