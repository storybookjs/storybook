/**
 * Minimal external store for the open-service sync demo stories.
 *
 * Each story mirrors its service state into one of these so the rendered demo can subscribe with
 * `useSyncExternalStore`. Extracted so the local-command, remote-command, and static-load stories
 * share one implementation instead of re-deriving the same listener set in every file.
 */
export type DemoStore<T> = {
  /** Reads the current value; pass as both `getSnapshot` and `getServerSnapshot`. */
  get: () => T;
  /** Replaces the value and notifies subscribers. */
  set: (value: T) => void;
  /** Subscribes a listener and returns its unsubscribe handle. */
  subscribe: (listener: () => void) => () => void;
};

export function createDemoStore<T>(initialValue: T): DemoStore<T> {
  let currentValue = initialValue;
  const listeners = new Set<() => void>();

  return {
    get: () => currentValue,
    set: (value) => {
      currentValue = value;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
