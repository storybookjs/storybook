import { useSyncExternalStore } from 'react';

let count = 0;
const listeners = new Set<() => void>();

// TODO(Storybook 12): Workaround. Delete this store once the manager adopts a UniversalStore or
// OSA based alternative for addon-local state.
// Context: https://github.com/storybookjs/storybook/pull/37391
/**
 * The number of actions logged for the current story, shown in the tab title. It lives outside the
 * component so that it survives the addon panel being hidden and shown, and outside the shared addon
 * state so that an action does not re-render the whole manager.
 */
export const countStore = {
  getState: () => count,
  setState: (next: number) => {
    if (next === count) {
      return;
    }
    count = next;
    listeners.forEach((listener) => listener());
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export const useActionCount = () =>
  useSyncExternalStore(countStore.subscribe, countStore.getState, countStore.getState);
