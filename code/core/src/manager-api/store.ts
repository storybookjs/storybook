import type { StoreAPI } from 'store2';
import store from 'store2';

import storeSetup from './lib/store-setup.ts';
import type { State } from './root.tsx';

// setting up the store, overriding set and get to use telejson
storeSetup(store._);

export const STORAGE_KEY = '@storybook/manager/store';

function get(storage: StoreAPI) {
  const data = storage.get(STORAGE_KEY);
  return data || {};
}

function set(storage: StoreAPI, value: Patch) {
  return storage.set(STORAGE_KEY, value);
}

function update(storage: StoreAPI, patch: Patch) {
  const previous = get(storage);
  // Apply the same behaviour as react here
  return set(storage, { ...previous, ...patch });
}

type GetState = () => State;
type SetState = (patch: Partial<State>, callback: (state: State) => void) => void;

export interface Upstream {
  /**
   * Whether to allow persistence of state to local/sessionStorage. This is used to disable
   * persistence in Storybook's own tests. True by default.
   */
  allowPersistence?: boolean;
  getState: GetState;
  setState: SetState;
}

type Patch = Partial<State>;

interface PendingPatch {
  patch: Patch;
  committed: boolean;
}

type InputFnPatch = (s: State) => Patch;
type InputPatch = Patch | InputFnPatch;

export type PersistenceHandler = (
  patch: Partial<State>,
  serialize: ((s: State) => Partial<Record<string, string | null | undefined>>) | undefined
) => void | Promise<void>;

export interface Options {
  persistence: 'none' | 'session' | 'url' | string;
  serialize?: (s: State) => Partial<Record<string, string | null | undefined>>;
}
type CallBack = (s: State) => void;
type CallbackOrOptions = CallBack | Options;

// Run an updater once, now, against the latest state, and keep only the keys it changed. A key it
// returns unchanged (e.g. from spreading the whole state) would otherwise pin that value while the
// patch is pending, hiding a newer one such as a route field set by the provider.
function resolveUpdater(updater: InputFnPatch, state: State): Patch {
  const result = updater(state);
  return Object.fromEntries(
    Object.entries(result).filter(([key, value]) => value !== state[key as keyof State])
  ) as Patch;
}

// Our store piggybacks off the internal React state of the Context Provider
// It has been augmented to persist state to local/sessionStorage
export default class Store {
  upstreamPersistence: boolean;
  upstreamGetState: GetState;
  upstreamSetState: SetState;
  private persistenceHandlers: Map<string, PersistenceHandler> = new Map();
  // Patches handed to React, oldest first, from the oldest one it has not committed yet. React can
  // commit a later patch first (e.g. a click before a channel event), so committed patches stay
  // until every earlier one has committed: re-applying them in order then gives React's final state.
  // `getState()` applies these on top of the committed state, so `api.*` reads see every earlier
  // write, even while the rendered context is still a commit behind.
  private pendingPatches: PendingPatch[] = [];

  constructor({ allowPersistence, setState, getState }: Upstream) {
    this.upstreamPersistence = allowPersistence ?? true;
    this.upstreamSetState = setState;
    this.upstreamGetState = getState;
  }

  registerPersistenceHandler(key: string, handler: PersistenceHandler) {
    this.persistenceHandlers.set(key, handler);
  }

  // The assumption is that this will be called once, to initialize the React state
  // when the module is instantiated
  getInitialState(base: State) {
    // TODO: Remove in SB 12
    const persisted = get(store.local);
    const { includedTagFilters: _included, excludedTagFilters: _excluded, ...local } = persisted;
    if ('includedTagFilters' in persisted || 'excludedTagFilters' in persisted) {
      set(store.local, local);
    }
    const session = get(store.session);
    // We don't only merge at the very top level (the same way as React setState),
    // when you set keys, so it makes sense to do the same in combining the two storage modes
    // Really, you shouldn't store the same key in both places
    return { ...base, ...local, ...session };
  }

  getState(): State {
    const committed = this.upstreamGetState();
    if (this.pendingPatches.length === 0) {
      return committed;
    }
    return this.pendingPatches.reduce<State>((acc, { patch }) => ({ ...acc, ...patch }), committed);
  }

  async setState(inputPatch: InputPatch, options?: Options): Promise<State>;

  async setState(inputPatch: InputPatch, callback?: CallBack, options?: Options): Promise<State>;

  async setState(
    inputPatch: InputPatch,
    cbOrOptions?: CallbackOrOptions,
    inputOptions?: Options
  ): Promise<State> {
    let callback;
    let options;
    if (typeof cbOrOptions === 'function') {
      callback = cbOrOptions;
      options = inputOptions;
    } else {
      options = cbOrOptions;
    }
    const { persistence = 'none' } = options || {};

    const delta: Patch =
      typeof inputPatch === 'function' ? resolveUpdater(inputPatch, this.getState()) : inputPatch;
    // Nothing to commit or persist: every React setState re-renders the provider, and persisting
    // rewrites the whole stored state.
    if (Object.keys(delta).length === 0) {
      const state = this.getState();
      callback?.(state);
      return state;
    }
    const pending: PendingPatch = { patch: delta, committed: false };
    this.pendingPatches.push(pending);

    const newState: State = await new Promise((resolve) => {
      try {
        this.upstreamSetState(delta, () => {
          pending.committed = true;
          while (this.pendingPatches[0]?.committed) {
            this.pendingPatches.shift();
          }
          resolve(this.getState());
        });
      } catch (error) {
        this.pendingPatches.splice(this.pendingPatches.indexOf(pending), 1);
        throw error;
      }
    });

    if (persistence !== 'none' && this.upstreamPersistence) {
      if (persistence === 'url') {
        const handler = this.persistenceHandlers.get('url');
        if (handler) {
          await handler(delta, (options as Options | undefined)?.serialize);
        }
      } else {
        const storage = persistence === 'session' ? store.session : store.local;
        await update(storage, delta);
      }
    }

    if (callback) {
      callback(newState);
    }

    return newState;
  }
}
