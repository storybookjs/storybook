import type { State } from '../root';
import Store, { type Upstream } from '../store';

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
