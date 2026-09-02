import type { SetStateAction } from 'react';
import { useSyncExternalStore } from 'react';

interface ActionsState {
  count: number;
}

export const initialActionsState: ActionsState = { count: 0 };

let state = initialActionsState;
const listeners = new Set<() => void>();

export const actionsStore = {
  get: () => state,
  set: (next: SetStateAction<ActionsState>) => {
    state = typeof next === 'function' ? next(state) : next;
    listeners.forEach((listener) => listener());
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export const useActionsState = () => useSyncExternalStore(actionsStore.subscribe, actionsStore.get);
