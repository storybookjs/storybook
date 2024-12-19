import type {
  API_StateMerger,
  Addon_BaseType,
  Addon_Collection,
  Addon_Types,
  Addon_TypesMapping,
} from '@storybook/core/types';
import { Addon_TypesEnum } from '@storybook/core/types';

import type { ModuleFn } from '../lib/types';
import type { Options } from '../store';

export interface SubState {
  selectedPanel: string;
  addons: Record<string, never>;
}

export interface SubAPI {
  /**
   * Returns a collection of elements of a specific type.
   *
   * @template T - The type of the elements in the collection.
   * @param {Addon_Types | Addon_TypesEnum.experimental_PAGE} type - The type of the elements to
   *   retrieve.
   * @returns {Addon_Collection<T>} - A collection of elements of the specified type.
   * @protected This is used internally in storybook's manager.
   */
  getElements: <
    T extends
      | Addon_Types
      | Addon_TypesEnum.experimental_PAGE
      | Addon_TypesEnum.experimental_SIDEBAR_BOTTOM
      | Addon_TypesEnum.experimental_TEST_PROVIDER
      | Addon_TypesEnum.experimental_SIDEBAR_TOP = Addon_Types,
  >(
    type: T
  ) => Addon_Collection<Addon_TypesMapping[T]>;
  /**
   * Returns the id of the currently selected panel.
   *
   * @returns {string} - The ID of the currently selected panel.
   */
  getSelectedPanel: () => string;
  /**
   * Sets the currently selected panel via it's ID.
   *
   * @param {string} panelName - The ID of the panel to select.
   * @returns {void}
   */
  setSelectedPanel: (panelName: string) => void;
  /**
   * Sets the state of an addon with the given ID.
   *
   * @deprecated This API might get dropped, if you are using this, please file an issue.
   * @template S - The type of the addon state.
   * @param {string} addonId - The ID of the addon to set the state for.
   * @param {S | API_StateMerger<S>} newStateOrMerger - The new state to set, or a function which
   *   receives the current state and returns the new state.
   * @param {Options} [options] - Optional options for the state update.
   * @returns {Promise<S>} - A promise that resolves with the new state after it has been set.
   */
  setAddonState<S>(
    addonId: string,
    newStateOrMerger: S | API_StateMerger<S>,
    options?: Options
  ): Promise<S>;
  /**
   * Returns the state of an addon with the given ID.
   *
   * @deprecated This API might get dropped, if you are using this, please file an issue.
   * @template S - The type of the addon state.
   * @param {string} addonId - The ID of the addon to get the state for.
   * @returns {S} - The state of the addon with the given ID.
   */
  getAddonState<S>(addonId: string): S;
}

export function ensurePanel(
  panels: Addon_Collection<Addon_BaseType>,
  selectedPanel?: string,
  currentPanel?: string
) {
  const keys = Object.keys(panels);

  if (keys.indexOf(selectedPanel!) >= 0) {
    return selectedPanel;
  }

  if (keys.length) {
    return keys[0];
  }
  return currentPanel;
}

export const init: ModuleFn<SubAPI, SubState> = ({ provider, store, fullAPI }): any => {
  const api: SubAPI = {
    getElements: (type) => provider.getElements(type),
    getSelectedPanel: (): any => {
      const { selectedPanel } = store.getState();
      return ensurePanel(api.getElements(Addon_TypesEnum.PANEL), selectedPanel, selectedPanel);
    },
    setSelectedPanel: (panelName) => {
      store.setState({ selectedPanel: panelName }, { persistence: 'session' });
    },
    setAddonState<S>(
      addonId: string,
      newStateOrMerger: S | API_StateMerger<S>,
      options?: Options
    ): Promise<S> {
      const merger = (
        typeof newStateOrMerger === 'function' ? newStateOrMerger : () => newStateOrMerger
      ) as API_StateMerger<S>;
      return store
        .setState(
          (s) => ({ ...s, addons: { ...s.addons, [addonId]: merger(s.addons[addonId]) } }),
          options
        )
        .then(() => api.getAddonState(addonId));
    },
    getAddonState: (addonId) => {
      return store.getState().addons[addonId] || globalThis?.STORYBOOK_ADDON_STATE[addonId];
    },
  };

  return {
    api,
    state: {
      selectedPanel: ensurePanel(
        api.getElements(Addon_TypesEnum.PANEL),
        store.getState().selectedPanel
      ),
      addons: {},
    },
  };
};
