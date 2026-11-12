import { isEqual } from 'es-toolkit/predicate';

type Update<T> = T | ((state: T) => T);

export interface PanelStore<T> {
  getState: () => T;
  setState: (update: Update<T>) => void;
  subscribe: (listener: () => void) => () => void;
}

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
