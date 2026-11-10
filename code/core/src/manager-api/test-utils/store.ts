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
    setState: (patch: Partial<State>, callback: (state: State) => void) => {
      internalState = { ...internalState, ...patch };
      callback(internalState);
      if (onChange) {
        onChange(internalState);
      }
    },
  };

  return new InMemoryStore(upstream);
}

interface QueuedPatch {
  patch: Partial<State>;
  callback: (state: State) => void;
  committed: boolean;
}

export interface CommitOptions {
  /** A write the provider makes during the commit, outside the store (e.g. route fields from props) */
  derived?: Partial<State>;
  /** Runs once the commit is applied and before the `setState` callbacks, like a render */
  beforeCallbacks?: () => void;
}

/** An upstream that, like React, commits `setState` patches later and can commit them out of order. */
export interface LaggingUpstream {
  allowPersistence: false;
  getState: () => State;
  setState: (patch: Partial<State>, callback: (state: State) => void) => void;
  /** Commits every queued patch, in order */
  commit: (options?: CommitOptions) => void;
  /** Commits one queued patch ahead of earlier ones, like a sync-lane update overtaking a default one */
  commitOutOfOrder: (queueIndex: number) => void;
}

/**
 * Creates an upstream that commits like React's class state. Committed state is the base state plus
 * every committed patch in queue order. A patch committed ahead of earlier ones is applied again
 * after them once they commit, so the final state is always every patch applied in order.
 *
 * @param initialState - The initial committed state
 * @param autoCommit - Commit the whole queue on a macrotask after the first queued patch
 * @returns The upstream, with `commit` and `commitOutOfOrder` to control commits by hand
 */
export function createLaggingUpstream(
  initialState: Partial<State> = {},
  { autoCommit = false } = {}
): LaggingUpstream {
  let base = { ...initialState } as State;
  let derived: Partial<State> = {};
  const queue: QueuedPatch[] = [];

  const committedState = () =>
    queue
      .filter((item) => item.committed)
      .reduce<State>((acc, item) => ({ ...acc, ...item.patch }), { ...base, ...derived });

  const settle = (justCommitted: QueuedPatch[], options: CommitOptions = {}) => {
    if (options.derived) {
      derived = { ...derived, ...options.derived };
    }
    while (queue[0]?.committed) {
      base = { ...base, ...queue[0].patch };
      queue.shift();
    }
    if (queue.length === 0) {
      base = { ...base, ...derived };
      derived = {};
    }
    options.beforeCallbacks?.();
    const state = committedState();
    justCommitted.forEach((item) => item.callback(state));
  };

  const upstream: LaggingUpstream = {
    allowPersistence: false,
    getState: committedState,
    setState: (patch, callback) => {
      queue.push({ patch, callback, committed: false });
      if (autoCommit && queue.length === 1) {
        setTimeout(() => upstream.commit());
      }
    },
    commit: (options) => {
      const justCommitted = queue.filter((item) => !item.committed);
      justCommitted.forEach((item) => {
        item.committed = true;
      });
      settle(justCommitted, options);
    },
    commitOutOfOrder: (queueIndex) => {
      const item = queue[queueIndex];
      item.committed = true;
      settle([item]);
    },
  };
  return upstream;
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
  return new InMemoryStore(createLaggingUpstream(initialState, { autoCommit: true }));
}
