import type {
  GlobalTypes,
  Globals,
  GlobalsUpdatedPayload,
  SetGlobalsPayload,
} from '@storybook/core/types';

import { logger } from '@storybook/core/client-logger';
import { GLOBALS_UPDATED, SET_GLOBALS, UPDATE_GLOBALS } from '@storybook/core/core-events';

import { dequal as deepEqual } from 'dequal';

import { getEventMetadata } from '../lib/events';
import type { ModuleFn } from '../lib/types';

export interface SubState {
  globals?: Globals;
  userGlobals?: Globals;
  storyGlobals?: Globals;
  globalTypes?: GlobalTypes;
}

export interface SubAPI {
  /**
   * Returns the current globals, which is the user globals overlaid with the story globals
   * @returns {Globals} The current globals.
   */
  getGlobals: () => Globals;
  /**
   * Returns the current globals, as set by the user (a story may have override values)
   * @returns {Globals} The current user globals.
   */
  getUserGlobals: () => Globals /**
  /**
   * Returns the current globals, as set by the story
   * @returns {Globals} The current story globals.
   */;
  getStoryGlobals: () => Globals /**
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
    getStoryGlobals() {
      return store.getState().storyGlobals as Globals;
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
    storyGlobals: {},
    globalTypes: {},
  };
  const updateGlobals = ({
    globals,
    storyGlobals,
    userGlobals,
  }: {
    globals: Globals;
    storyGlobals: Globals;
    userGlobals: Globals;
  }) => {
    const {
      globals: currentGlobals,
      userGlobals: currentUserGlobals,
      storyGlobals: currentStoryGlobals,
    } = store.getState();
    if (!deepEqual(globals, currentGlobals)) {
      store.setState({ globals });
    }
    if (!deepEqual(userGlobals, currentUserGlobals)) {
      store.setState({ userGlobals });
    }
    if (!deepEqual(storyGlobals, currentStoryGlobals)) {
      store.setState({ storyGlobals });
    }
  };

  provider.channel?.on(
    GLOBALS_UPDATED,
    function handleGlobalsUpdated(
      this: any,
      { globals, storyGlobals, userGlobals }: GlobalsUpdatedPayload
    ) {
      const { ref } = getEventMetadata(this, fullAPI)!;

      if (!ref) {
        updateGlobals({ globals, storyGlobals, userGlobals });
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

      // If we have stored globals different to what the preview just inited with,
      // we should update it to those values
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
