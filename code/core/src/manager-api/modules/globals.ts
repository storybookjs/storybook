import { SET_GLOBALS, UPDATE_GLOBALS, GLOBALS_UPDATED } from '@storybook/core/core-events';
import { logger } from '@storybook/core/client-logger';
import { dequal as deepEqual } from 'dequal';
import type { SetGlobalsPayload, Globals, GlobalTypes } from '@storybook/core/types';

import type { ModuleFn } from '../lib/types';

import { getEventMetadata } from '../lib/events';

export interface SubState {
  globals?: Globals;
  globalTypes?: GlobalTypes;
}

export interface SubAPI {
  /**
   * Returns the current global data object.
   * @returns {Globals} The current global data object.
   */
  getGlobals: () => Globals;
  /**
   * Returns the current global types object.
   * @returns {GlobalTypes} The current global types object.
   */
  getGlobalTypes: () => GlobalTypes;
  /**
   * Updates the current global data object with the provided new global data object.
   * @param {Globals} newGlobals - The new global data object to update with.
   * @returns {void}
   */
  updateGlobals: (newGlobals: Globals) => void;
}

export const init: ModuleFn<SubAPI, SubState> = ({ store, fullAPI, provider }) => {
  const api: SubAPI = {
    getGlobals() {
      return store.getState().globals as Globals;
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
    globalTypes: {},
  };
  const updateGlobals = (globals: Globals) => {
    const currentGlobals = store.getState()?.globals;
    if (!deepEqual(globals, currentGlobals)) {
      store.setState({ globals });
    }
  };

  provider.channel?.on(
    GLOBALS_UPDATED,
    function handleGlobalsUpdated(this: any, { globals }: { globals: Globals }) {
      const { ref } = getEventMetadata(this, fullAPI)!;

      if (!ref) {
        updateGlobals(globals);
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
    function handleSetStories(this: any, { globals, globalTypes }: SetGlobalsPayload) {
      const { ref } = getEventMetadata(this, fullAPI)!;
      const currentGlobals = store.getState()?.globals;

      if (!ref) {
        store.setState({ globals, globalTypes });
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
