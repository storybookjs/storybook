import { SET_GLOBALS, UPDATE_GLOBALS, GLOBALS_UPDATED } from '@storybook/core-events';
import { logger } from '@storybook/client-logger';
import { dequal as deepEqual } from 'dequal';
import type { SetGlobalsPayload, Globals, GlobalTypes } from '@storybook/types';

import type { ModuleFn } from '../lib/types';

import { getEventMetadata } from '../lib/events';

export interface SubState {
  globals?: Globals;
  userGlobals?: Globals;
  globalTypes?: GlobalTypes;
}

export interface SubAPI {
  /**
   * Returns the current globals, including overrides.
   * @returns {Globals} The current globals.
   */
  getGlobals: () => Globals;
  /**
   * Returns the current globals, as set by the user (a story may have override values)
   * @returns {Globals} The current user globals.
   */
  getUserGlobals: () => Globals /**
   * Returns the globalTypes, as defined at the project level.
   * @returns {GlobalTypes} The globalTypes.
   */;
  getGlobalTypes: () => GlobalTypes;
  /**
   * Updates the current globals with the provided new globals.
   * @param {Globals} newGlobals - The new globals to update with.
   * @returns {void}
   */
  updateGlobals: (newGlobals: Globals) => void;
}

export const init: ModuleFn<SubAPI, SubState> = ({ store, fullAPI, provider }) => {
  const api: SubAPI = {
    getGlobals() {
      return store.getState().globals as Globals;
    },
    getUserGlobals() {
      return store.getState().userGlobals as Globals;
    },
    getGlobalTypes() {
      return store.getState().globalTypes as GlobalTypes;
    },
    updateGlobals(newGlobals) {
      // Only emit the message to the local ref
      provider.channel?.emit(UPDATE_GLOBALS, {
        globals: newGlobals,
        options: {
          target: 'storybook-preview-iframe',
        },
      });
    },
  };

  const state: SubState = {
    globals: {},
    userGlobals: {},
    globalTypes: {},
  };
  const updateGlobals = ({ globals, userGlobals }: { globals: Globals; userGlobals: Globals }) => {
    const { globals: currentGlobals, userGlobals: currentUserGlobals } = store.getState();
    if (!deepEqual(globals, currentGlobals)) {
      store.setState({ globals });
    }
    if (!deepEqual(userGlobals, currentUserGlobals)) {
      store.setState({ userGlobals });
    }
  };

  provider.channel?.on(
    GLOBALS_UPDATED,
    function handleGlobalsUpdated(
      this: any,
      { globals, userGlobals }: { globals: Globals; userGlobals: Globals }
    ) {
      const { ref } = getEventMetadata(this, fullAPI)!;

      if (!ref) {
        updateGlobals({ globals, userGlobals });
      } else {
        logger.warn(
          'received a GLOBALS_UPDATED from a non-local ref. This is not currently supported.'
        );
      }
    }
  );

  // Emitted by the preview on initialization
  provider.channel?.on(
    SET_GLOBALS,
    function handleSetGlobals(this: any, { globals, globalTypes }: SetGlobalsPayload) {
      const { ref } = getEventMetadata(this, fullAPI)!;
      const currentGlobals = store.getState()?.globals;

      if (!ref) {
        store.setState({ globals, userGlobals: globals, globalTypes });
      } else if (Object.keys(globals).length > 0) {
        logger.warn('received globals from a non-local ref. This is not currently supported.');
      }

      if (
        currentGlobals &&
        Object.keys(currentGlobals).length !== 0 &&
        !deepEqual(globals, currentGlobals)
      ) {
        api.updateGlobals(currentGlobals);
      }
    }
  );

  return {
    api,
    state,
  };
};
