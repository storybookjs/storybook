import type { State } from '../root.tsx';
import Store, { type Upstream } from '../store.ts';

// Never reads from storage.
class InMemoryStore extends Store {
  constructor({ setState, getState }: Upstream) {
    super({ allowPersistence: false, setState, getState });
  }

  getInitialState(base: State) {
    return base;
  }
}

// Commits synchronously; onChange runs after each commit.
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
  // A write the provider makes during the commit, outside the store (e.g. route fields from props)
  derived?: Partial<State>;
  // Runs once the commit is applied and before the `setState` callbacks, like a render
  beforeCallbacks?: () => void;
}

// Like React, commits `setState` patches later and can commit them out of order.
export interface LaggingUpstream {
  allowPersistence: false;
  getState: () => State;
  setState: (patch: Partial<State>, callback: (state: State) => void) => void;
  // Commits every queued patch, in order
  commit: (options?: CommitOptions) => void;
  // Commits one queued patch ahead of earlier ones, like a sync-lane update overtaking a default one
  commitOutOfOrder: (queueIndex: number) => void;
}

// Committed state is the base state plus every committed patch in queue order. A patch committed
// ahead of earlier ones is applied again after them once they commit, so the final state is every
// patch in order. `autoCommit` commits the whole queue on a macrotask after the first queued patch.
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

// Commits on a macrotask, in order, before the `setState` callbacks run.
export function createCommitLaggingStore(initialState: Partial<State> = {}): Store {
  return new InMemoryStore(createLaggingUpstream(initialState, { autoCommit: true }));
}
