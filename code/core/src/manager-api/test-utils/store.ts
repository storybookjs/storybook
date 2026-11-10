import type { State } from '../root.tsx';
import Store, { type Upstream } from '../store.ts';

/** Store guaranteed not to read from storage, for testing purposes. */
class InMemoryStore extends Store {
  constructor({ setState, getState }: Upstream) {
    super({ allowPersistence: false, setState, getState });
  }

  getInitialState(base: State) {
    return base;
  }
}

/**
 * Factory function to create a valid Store instance for testing purposes. Provides a simple
 * in-memory store without persistence logic. Useful for mocking the store in stories.
 *
 * @param initialState - The initial state for the store
 * @param onChange - Optional callback invoked whenever state changes
 * @returns A Store instance configured for testing
 */
export function createTestingStore(
  initialState: State,
  onChange?: (internalState: State) => void
): Store {
  let internalState = { ...initialState };

  const upstream = {
    allowPersistence: false,
    getState: () => internalState,
    setState: (patch: any, callback?: any) => {
      if (typeof patch === 'function') {
        internalState = { ...internalState, ...patch(internalState) };
      } else {
        internalState = { ...internalState, ...patch };
      }
      if (callback && typeof callback === 'function') {
        callback(internalState);
      }
      if (onChange) {
        onChange(internalState);
      }
    },
  };

  return new InMemoryStore(upstream);
}

/**
 * Creates a Store whose upstream commits like React's: `setState` patches are applied later (on a
 * macrotask), in order, before their callbacks run. Use it to test code against writes that have
 * not been committed yet.
 *
 * @param initialState - The initial committed state
 * @returns A Store instance backed by a deferred-commit upstream
 */
export function createCommitLaggingStore(initialState: Partial<State> = {}): Store {
  let committed = { ...initialState } as State;
  let queue: Array<{ patch: Partial<State>; callback?: (s: State) => void }> = [];

  const upstream = {
    allowPersistence: false,
    getState: () => committed,
    setState: (patch: Partial<State>, callback?: (s: State) => void) => {
      queue.push({ patch, callback });
      if (queue.length === 1) {
        setTimeout(() => {
          const batch = queue;
          queue = [];
          for (const item of batch) {
            committed = { ...committed, ...item.patch };
          }
          for (const item of batch) {
            item.callback?.(committed);
          }
        });
      }
    },
  };

  return new InMemoryStore(upstream);
}
