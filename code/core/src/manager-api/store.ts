import { global } from '@storybook/global';

import type { StoreAPI } from 'store2';
import store from 'store2';

import storeSetup from './lib/store-setup';
import type { State } from './root';
import { version as currentVersion } from './version';

// setting up the store, overriding set and get to use telejson
storeSetup(store._);

const STORAGE_KEY_BASE = '@storybook/manager/store';

/**
 * Storage key scoped per Storybook instance via `STORYBOOK_INSTANCE_ID` (a Git-derived project
 * hash).
 */
export const STORAGE_KEY = `${STORAGE_KEY_BASE}/${global.STORYBOOK_INSTANCE_ID || 'anonymous'}`;

/**
 * Key used to store the Storybook version alongside persisted data. This allows future migration
 * logic to be version-aware when the storage format changes.
 */
const VERSION_KEY = `${STORAGE_KEY}/__version__`;

function persistVersion(storage: StoreAPI) {
  storage.set(VERSION_KEY, currentVersion);
}

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
type SetState = (a: any, b: any) => any;

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

type InputFnPatch = (s: State) => Patch;
type InputPatch = Patch | InputFnPatch;

export interface Options {
  persistence: 'none' | 'session' | string;
}
type CallBack = (s: State) => void;
type CallbackOrOptions = CallBack | Options;

// Our store piggybacks off the internal React state of the Context Provider
// It has been augmented to persist state to local/sessionStorage
export default class Store {
  upstreamPersistence: boolean;
  upstreamGetState: GetState;
  upstreamSetState: SetState;

  constructor({ allowPersistence, setState, getState }: Upstream) {
    this.upstreamPersistence = allowPersistence ?? true;
    this.upstreamSetState = setState;
    this.upstreamGetState = getState;
  }

  // The assumption is that this will be called once, to initialize the React state
  // when the module is instantiated
  getInitialState(base: State) {
    // We don't only merge at the very top level (the same way as React setState)
    // when you set keys, so it makes sense to do the same in combining the two storage modes
    // Really, you shouldn't store the same key in both places
    const initialState = { ...base, ...get(store.local), ...get(store.session) };

    // Record the current version in localStorage so future migrations can be version-aware
    persistVersion(store.local);

    return initialState;
  }

  getState() {
    return this.upstreamGetState();
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

    let patch: Patch = {};
    // What did the patch actually return
    let delta: Patch = {};
    if (typeof inputPatch === 'function') {
      // Pass the same function, but set delta on the way
      patch = (state: State) => {
        const getDelta = inputPatch as InputFnPatch;
        delta = getDelta(state);
        return delta;
      };
    } else {
      patch = inputPatch;
      delta = patch;
    }

    const newState: State = await new Promise((resolve) => {
      this.upstreamSetState(patch, () => {
        resolve(this.getState());
      });
    });

    if (persistence !== 'none' && this.upstreamPersistence) {
      const storage = persistence === 'session' ? store.session : store.local;
      await update(storage, delta);
    }

    if (callback) {
      callback(newState);
    }

    return newState;
  }
}
