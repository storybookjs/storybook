import { SET_CONFIG } from 'storybook/internal/core-events';
import type {
  API_Layout,
  API_LayoutCustomisations,
  API_PanelPositions,
  API_UI,
} from 'storybook/internal/types';

import { global } from '@storybook/global';

import { isEqual as deepEqual, pick, toMerged } from 'es-toolkit';
import type { ThemeVars } from 'storybook/theming';
import { create } from 'storybook/theming/create';

import merge from '../lib/merge';
import type { ModuleFn } from '../lib/types';
import type { State } from '../root';

const { document } = global;

const isFunction = (val: unknown): val is CallableFunction => typeof val === 'function';

export const ActiveTabs = {
  SIDEBAR: 'sidebar' as const,
  CANVAS: 'canvas' as const,
  ADDONS: 'addons' as const,
};

export interface SubState {
  layout: API_Layout;
  layoutCustomisations: API_LayoutCustomisations;
  ui: API_UI;
  selectedPanel: string | undefined;
  theme: ThemeVars;
}

export interface SubAPI {
  /**
   * Toggles the fullscreen mode of the Storybook UI.
   *
   * @param toggled - Optional boolean value to set the fullscreen mode to. If not provided, it will
   *   toggle the current state.
   */
  toggleFullscreen: (toggled?: boolean) => void;
  /**
   * Toggles the visibility of the panel in the Storybook UI.
   *
   * @param toggled - Optional boolean value to set the panel visibility to. If not provided, it
   *   will toggle the current state.
   */
  togglePanel: (toggled?: boolean) => void;
  /**
   * Toggles the position of the panel in the Storybook UI.
   *
   * @param position - Optional string value to set the panel position to. If not provided, it will
   *   toggle between 'bottom' and 'right'.
   */
  togglePanelPosition: (position?: API_PanelPositions) => void;
  /**
   * Toggles the visibility of the navigation bar in the Storybook UI.
   *
   * @param toggled - Optional boolean value to set the navigation bar visibility to. If not
   *   provided, it will toggle the current state.
   */
  toggleNav: (toggled?: boolean) => void;
  /**
   * Toggles the visibility of the toolbar in the Storybook UI.
   *
   * @param toggled - Optional boolean value to set the toolbar visibility to. If not provided, it
   *   will toggle the current state.
   */
  toggleToolbar: (toggled?: boolean) => void;
  /**
   * Sets the options for the Storybook UI.
   *
   * @param options - An object containing the options to set.
   */
  setOptions: (options: any) => void;
  /** Sets the sizes of the resizable elements in the layout. */
  setSizes: (
    options: Partial<Pick<API_Layout, 'navSize' | 'bottomPanelHeight' | 'rightPanelWidth'>>
  ) => void;
  /** GetIsFullscreen - Returns the current fullscreen mode of the Storybook UI. */
  getIsFullscreen: () => boolean;
  /** GetIsPanelShown - Returns the current visibility of the panel in the Storybook UI. */
  getIsPanelShown: () => boolean;
  /** GetIsNavShown - Returns the current visibility of the navigation bar in the Storybook UI. */
  getIsNavShown: () => boolean;
  /**
   * GetShowToolbarWithCustomisations - Returns the current visibility of the toolbar, taking into
   * account customisations requested by the end user via a layoutCustomisations function.
   */
  getShowToolbarWithCustomisations: (showToolbar: boolean) => boolean;
  /**
   * GetNavSizeWithCustomisations - Returns the size to apply to the sidebar/nav, taking into
   * account customisations requested by the end user via a layoutCustomisations function.
   */
  getNavSizeWithCustomisations: (navSize: number) => number;
}

type PartialSubState = Partial<SubState>;

export const defaultLayoutState: SubState = {
  ui: {
    enableShortcuts: true,
  },
  layout: {
    initialActive: ActiveTabs.CANVAS,
    showToolbar: true,
    navSize: 300,
    bottomPanelHeight: 300,
    rightPanelWidth: 400,
    recentVisibleSizes: {
      navSize: 300,
      bottomPanelHeight: 300,
      rightPanelWidth: 400,
    },
    panelPosition: 'bottom',
    showTabs: true,
  },
  layoutCustomisations: {
    showSidebar: undefined,
    showToolbar: undefined,
  },
  selectedPanel: undefined,
  theme: create(),
};

export const focusableUIElements = {
  storySearchField: 'storybook-explorer-searchfield',
  storyListMenu: 'storybook-explorer-menu',
  storyPanelRoot: 'storybook-panel-root',
};

const getIsNavShown = (state: State) => {
  return state.layout.navSize > 0;
};
const getIsPanelShown = (state: State) => {
  const { bottomPanelHeight, rightPanelWidth, panelPosition } = state.layout;

  return (
    (panelPosition === 'bottom' && bottomPanelHeight > 0) ||
    (panelPosition === 'right' && rightPanelWidth > 0)
  );
};
const getIsFullscreen = (state: State) => {
  return !getIsNavShown(state) && !getIsPanelShown(state);
};

const getRecentVisibleSizes = (layoutState: API_Layout) => {
  return {
    navSize: layoutState.navSize > 0 ? layoutState.navSize : layoutState.recentVisibleSizes.navSize,
    bottomPanelHeight:
      layoutState.bottomPanelHeight > 0
        ? layoutState.bottomPanelHeight
        : layoutState.recentVisibleSizes.bottomPanelHeight,
    rightPanelWidth:
      layoutState.rightPanelWidth > 0
        ? layoutState.rightPanelWidth
        : layoutState.recentVisibleSizes.rightPanelWidth,
  };
};

export const init: ModuleFn<SubAPI, SubState> = ({ store, provider, singleStory }) => {
  const api = {
    toggleFullscreen(nextState?: boolean) {
      return store.setState(
        (state: State) => {
          const isFullscreen = getIsFullscreen(state);
          const shouldFullscreen = typeof nextState === 'boolean' ? nextState : !isFullscreen;

          if (shouldFullscreen === isFullscreen) {
            return { layout: state.layout };
          }

          return shouldFullscreen
            ? {
                layout: {
                  ...state.layout,
                  navSize: 0,
                  bottomPanelHeight: 0,
                  rightPanelWidth: 0,
                  recentVisibleSizes: getRecentVisibleSizes(state.layout),
                },
              }
            : {
                layout: {
                  ...state.layout,
                  navSize: state.singleStory ? 0 : state.layout.recentVisibleSizes.navSize,
                  bottomPanelHeight: state.layout.recentVisibleSizes.bottomPanelHeight,
                  rightPanelWidth: state.layout.recentVisibleSizes.rightPanelWidth,
                },
              };
        },
        { persistence: 'session' }
      );
    },

    togglePanel(nextState?: boolean) {
      return store.setState(
        (state: State) => {
          const isPanelShown = getIsPanelShown(state);

          const shouldShowPanel = typeof nextState === 'boolean' ? nextState : !isPanelShown;

          if (shouldShowPanel === isPanelShown) {
            return { layout: state.layout };
          }

          return shouldShowPanel
            ? {
                layout: {
                  ...state.layout,
                  bottomPanelHeight: state.layout.recentVisibleSizes.bottomPanelHeight,
                  rightPanelWidth: state.layout.recentVisibleSizes.rightPanelWidth,
                },
              }
            : {
                layout: {
                  ...state.layout,
                  bottomPanelHeight: 0,
                  rightPanelWidth: 0,
                  recentVisibleSizes: getRecentVisibleSizes(state.layout),
                },
              };
        },
        { persistence: 'session' }
      );
    },

    togglePanelPosition(position?: 'bottom' | 'right') {
      return store.setState(
        (state: State) => {
          const nextPosition =
            position || (state.layout.panelPosition === 'right' ? 'bottom' : 'right');

          return {
            layout: {
              ...state.layout,
              panelPosition: nextPosition,
              bottomPanelHeight: state.layout.recentVisibleSizes.bottomPanelHeight,
              rightPanelWidth: state.layout.recentVisibleSizes.rightPanelWidth,
            },
          };
        },
        { persistence: 'permanent' }
      );
    },

    toggleNav(nextState?: boolean) {
      return store.setState(
        (state: State) => {
          if (state.singleStory) {
            return { layout: state.layout };
          }

          const isNavShown = getIsNavShown(state);

          const shouldShowNav = typeof nextState === 'boolean' ? nextState : !isNavShown;

          if (shouldShowNav === isNavShown) {
            return { layout: state.layout };
          }

          return shouldShowNav
            ? {
                layout: {
                  ...state.layout,
                  navSize: state.layout.recentVisibleSizes.navSize,
                },
              }
            : {
                layout: {
                  ...state.layout,
                  navSize: 0,
                  recentVisibleSizes: getRecentVisibleSizes(state.layout),
                },
              };
        },
        { persistence: 'session' }
      );
    },

    toggleToolbar(toggled?: boolean) {
      return store.setState(
        (state: State) => {
          const value = typeof toggled !== 'undefined' ? toggled : !state.layout.showToolbar;

          return {
            layout: {
              ...state.layout,
              showToolbar: value,
            },
          };
        },
        { persistence: 'session' }
      );
    },

    setSizes({
      navSize,
      bottomPanelHeight,
      rightPanelWidth,
    }: Partial<Pick<API_Layout, 'navSize' | 'bottomPanelHeight' | 'rightPanelWidth'>>) {
      return store.setState(
        (state: State) => {
          const nextLayoutState = {
            ...state.layout,
            navSize: navSize ?? state.layout.navSize,
            bottomPanelHeight: bottomPanelHeight ?? state.layout.bottomPanelHeight,
            rightPanelWidth: rightPanelWidth ?? state.layout.rightPanelWidth,
          };
          return {
            layout: {
              ...nextLayoutState,
              recentVisibleSizes: getRecentVisibleSizes(nextLayoutState),
            },
          };
        },
        { persistence: 'session' }
      );
    },

    focusOnUIElement(elementId?: string, select?: boolean) {
      if (!elementId) {
        return;
      }
      const element = document.getElementById(elementId);
      if (element) {
        element.focus();
        if (select) {
          (element as any).select();
        }
      }
    },

    getInitialOptions() {
      const { theme, selectedPanel, layoutCustomisations, ...options } = provider.getConfig();

      return {
        ...defaultLayoutState,
        layout: {
          ...toMerged(
            defaultLayoutState.layout,
            pick(options, Object.keys(defaultLayoutState.layout))
          ),
          ...(singleStory && { navSize: 0 }),
        },
        layoutCustomisations: {
          ...defaultLayoutState.layoutCustomisations,
          ...(layoutCustomisations ?? {}),
        },
        ui: toMerged(defaultLayoutState.ui, pick(options, Object.keys(defaultLayoutState.ui))),
        selectedPanel: selectedPanel || defaultLayoutState.selectedPanel,
        theme: theme || defaultLayoutState.theme,
      };
    },

    getIsFullscreen() {
      return getIsFullscreen(store.getState());
    },
    getIsPanelShown() {
      return getIsPanelShown(store.getState());
    },
    getIsNavShown() {
      return getIsNavShown(store.getState());
    },

    getShowToolbarWithCustomisations(showToolbar: boolean) {
      const state = store.getState();

      if (isFunction(state.layoutCustomisations.showToolbar)) {
        return state.layoutCustomisations.showToolbar(state, showToolbar) ?? showToolbar;
      }

      return showToolbar;
    },

    getNavSizeWithCustomisations(navSize: number) {
      const state = store.getState();

      if (isFunction(state.layoutCustomisations.showSidebar)) {
        const shouldShowNav = state.layoutCustomisations.showSidebar(state, navSize !== 0);
        if (navSize === 0 && shouldShowNav === true) {
          return state.layout.recentVisibleSizes.navSize;
        } else if (navSize !== 0 && shouldShowNav === false) {
          return 0;
        }
      }

      return navSize;
    },

    setOptions: (options: any) => {
      const { layout, ui, selectedPanel, theme } = store.getState();

      if (!options) {
        return;
      }

      const updatedLayout = {
        ...layout,
        ...(options.layout || {}),
        ...pick(options, Object.keys(layout)),
        ...(singleStory && { navSize: 0 }),
      };

      const updatedUi = {
        ...ui,
        ...options.ui,
        ...toMerged(options.ui || {}, pick(options, Object.keys(ui))),
      };

      const updatedTheme = {
        ...theme,
        ...options.theme,
      };

      const modification: PartialSubState = {};

      if (!deepEqual(ui, updatedUi)) {
        modification.ui = updatedUi;
      }
      if (!deepEqual(layout, updatedLayout)) {
        modification.layout = updatedLayout;
      }
      if (options.selectedPanel && !deepEqual(selectedPanel, options.selectedPanel)) {
        modification.selectedPanel = options.selectedPanel;
      }

      if (Object.keys(modification).length) {
        store.setState(modification, { persistence: 'permanent' });
      }
      if (!deepEqual(theme, updatedTheme)) {
        store.setState({ theme: updatedTheme });
      }
    },
  };

  const persisted = pick(store.getState(), ['layout', 'selectedPanel']);

  provider.channel?.on(SET_CONFIG, () => {
    api.setOptions(merge(api.getInitialOptions(), persisted));
  });

  return {
    api,
    state: merge(api.getInitialOptions(), persisted),
  };
};
