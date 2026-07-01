import { SET_CONFIG } from 'storybook/internal/core-events';
import type {
  API_Layout,
  API_LayoutCustomisations,
  API_PanelPositions,
  API_UI,
  API_ViewMode,
} from 'storybook/internal/types';

import { global } from '@storybook/global';

import { pick, toMerged } from 'es-toolkit/object';
import { isEqual as deepEqual } from 'es-toolkit/predicate';
import type { ThemeVars } from 'storybook/theming';
import { deprecate } from 'storybook/internal/client-logger';
import { create } from 'storybook/theming/create';

import { isReviewManagerRoute } from '../../shared/review/routes.ts';
import merge from '../lib/merge.ts';
import type { ModuleFn } from '../lib/types.tsx';
import type { State } from '../root.tsx';

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
  /**
   * Whether the mobile navigation drawer is open. Below the mobile breakpoint the sidebar is a
   * drawer owned by the manager UI rather than the desktop nav size, so its open/closed state lives
   * here as the single source of truth. Kept top-level (not inside `layout`) so it is excluded from
   * the persisted layout slice and always defaults to `false`.
   */
  showMobileNavigation: boolean;
}

/**
 * Availability of the sidebar/nav: 'unavailable' means the current route suppresses the nav
 * entirely (review routes), otherwise it is 'shown' or 'hidden' based on the layout state.
 */
export type NavAvailability = 'shown' | 'hidden' | 'unavailable';

/** True when the route renders a full-screen page (e.g. settings) instead of the preview canvas. */
export const isPagesViewMode = (viewMode: API_ViewMode): boolean =>
  viewMode !== undefined && viewMode !== 'story' && viewMode !== 'docs' && viewMode !== 'review';

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
   * Sets the open/closed state of the mobile navigation drawer directly, without going through the
   * `toggleNav` desktop/mobile branching. Use this to imperatively open or close the drawer (e.g.
   * resetting it to closed when leaving the mobile layout). `toggleNav` remains the toggle
   * entry-point.
   *
   * @param show - Whether the mobile navigation drawer should be open.
   */
  setMobileNavigation: (show: boolean) => void;
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
   * GetNavAvailability - Returns whether the sidebar/nav is shown, hidden (but can be shown by the
   * user), or unavailable because the current route suppresses it entirely (review routes).
   */
  getNavAvailability: () => NavAvailability;
  /**
   * GetShowToolbarWithCustomisations - Returns the current visibility of the toolbar, taking into
   * account customisations requested by the end user via a layoutCustomisations function.
   */
  getShowToolbarWithCustomisations: (showToolbar: boolean) => boolean;
  /**
   * GetShowPanelWithCustomisations - Returns the current visibility of the addon panel, taking into
   * account customisations requested by the end user via a layoutCustomisations function.
   */
  getShowPanelWithCustomisations: (showPanel: boolean) => boolean;
  /**
   * GetNavSizeWithCustomisations - Returns the size to apply to the sidebar/nav, taking into
   * account customisations requested by the end user via a layoutCustomisations function.
   */
  getNavSizeWithCustomisations: (navSize: number) => number;
  /**
   * Attempts to focus an element identified by its ID.
   *
   * @param elementId - The id of the element to focus.
   * @param options - Options for focusing the element.
   * @param options.forceFocus - Whether to make the element focusable even though it wasn't.
   * @param options.select - Whether to call select() on the element after focusing it.
   * @param options.poll - Whether to poll for the element if it is not immediately available.
   *   Defaults to true. When true, polls every 50ms for up to 500ms.
   * @returns Whether the element was successfully focused. Returns a Promise when polling.
   */
  focusOnUIElement: (
    elementId?: string,
    options?: boolean | { forceFocus?: boolean; select?: boolean; poll?: boolean }
  ) => boolean | Promise<boolean>;
}

type PartialSubState = Partial<SubState>;

export const DEFAULT_NAV_SIZE = 300;
export const DEFAULT_BOTTOM_PANEL_HEIGHT = 300;
export const DEFAULT_RIGHT_PANEL_WIDTH = 400;

export const getDefaultLayoutState: () => SubState = () => {
  return {
    ui: {
      enableShortcuts: true,
    },
    layout: {
      initialActive: ActiveTabs.CANVAS,
      navSize: DEFAULT_NAV_SIZE,
      bottomPanelHeight: DEFAULT_BOTTOM_PANEL_HEIGHT,
      rightPanelWidth: DEFAULT_RIGHT_PANEL_WIDTH,
      recentVisibleSizes: {
        navSize: DEFAULT_NAV_SIZE,
        bottomPanelHeight: DEFAULT_BOTTOM_PANEL_HEIGHT,
        rightPanelWidth: DEFAULT_RIGHT_PANEL_WIDTH,
      },
      panelPosition: 'bottom',
      showNav: true,
      showPanel: true,
      showTabs: true,
      showToolbar: true,
    },
    layoutCustomisations: {
      showPanel: undefined,
      showSidebar: undefined,
      showToolbar: undefined,
    },
    selectedPanel: undefined,
    theme: create(),
    showMobileNavigation: false,
  };
};

export const focusableUIElements = {
  addonPanel: 'storybook-panel-region',
  storySearchField: 'storybook-explorer-searchfield',
  storyListMenu: 'storybook-explorer-menu',
  storyPanelRoot: 'storybook-panel-root',
  showAddonPanel: 'storybook-show-addon-panel',
  sidebarRegion: 'storybook-sidebar-region',
  showSidebar: 'storybook-show-sidebar',
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

/**
 * Merges layout options into the existing layout state and translates
 * `showNav` / `showPanel` booleans into the underlying size fields.
 *
 * Layout keys can be provided either at the top level (deprecated) or under
 * `options.layout` (preferred). Nested layout keys take precedence.
 *
 * Numeric sizes are merged in before applying show/hide flags, so
 * `recentVisibleSizes` is captured from the latest size values.
 */
const applyLayoutOptions = (
  layoutState: API_Layout,
  options: { layout?: Partial<API_Layout>; [key: string]: any },
  singleStory: boolean
) => {
  const layoutKeys = Object.keys(layoutState);
  const layoutAtTopLevel = pick(options, layoutKeys);

  for (const key of Object.keys(layoutAtTopLevel)) {
    deprecate(
      `Calling \`setConfig({ ${key}: ... })\` is deprecated. Please call \`setConfig({ layout: { ${key}: ... } })\` instead.`
    );
  }

  const mergedLayoutOptions = toMerged(layoutAtTopLevel, options.layout || {});
  const { showPanel, showNav } = mergedLayoutOptions;

  // Safety net: drop any unknown keys that aren't part of API_Layout.
  const typedLayoutKeys = layoutKeys as (keyof API_Layout)[];
  const nextLayoutState = toMerged(layoutState, pick(mergedLayoutOptions, typedLayoutKeys));

  // singleStory always hides the sidebar; otherwise honor showSidebar.
  if (showNav === false || singleStory) {
    nextLayoutState.recentVisibleSizes = getRecentVisibleSizes(nextLayoutState);
    nextLayoutState.navSize = 0;
  } else if (showNav === true) {
    nextLayoutState.navSize = nextLayoutState.recentVisibleSizes.navSize;
  }

  if (showPanel === false) {
    nextLayoutState.recentVisibleSizes = getRecentVisibleSizes(nextLayoutState);
    nextLayoutState.bottomPanelHeight = 0;
    nextLayoutState.rightPanelWidth = 0;
  } else if (showPanel === true) {
    nextLayoutState.bottomPanelHeight = nextLayoutState.recentVisibleSizes.bottomPanelHeight;
    nextLayoutState.rightPanelWidth = nextLayoutState.recentVisibleSizes.rightPanelWidth;
  }

  return nextLayoutState;
};

/**
 * Merges ui options into the existing ui state.
 *
 * Ui keys can be provided either at the top level (deprecated) or under
 * `options.ui` (preferred). Nested ui keys take precedence.
 *
 * Numeric sizes are merged in before applying show/hide flags, so
 * `recentVisibleSizes` is captured from the latest size values.
 */
const applyUiOptions = (uiState: API_UI, options: { ui?: Partial<API_UI>; [key: string]: any }) => {
  const uiKeys = Object.keys(uiState);
  const uiAtTopLevel = pick(options, uiKeys);

  for (const key of Object.keys(uiAtTopLevel)) {
    deprecate(
      `Calling \`setConfig({ ${key}: ... })\` is deprecated. Please call \`setConfig({ ui: { ${key}: ... } })\` instead.`
    );
  }

  // Safety net: drop any unknown keys that aren't part of API_UI.
  const typedUiKeys = uiKeys as (keyof API_UI)[];
  return toMerged(uiState, pick(toMerged(uiAtTopLevel, options.ui || {}), typedUiKeys));
};

/**
 * Whether the viewport is at or above the manager's desktop breakpoint (600px). Below it the
 * sidebar is rendered as a drawer owned by the manager UI rather than the desktop nav.
 */
export const isDesktopViewport = () => global.matchMedia?.('(min-width: 600px)')?.matches ?? true;

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
      // On mobile the sidebar is a drawer owned by the manager UI, not the desktop nav size, so
      // toggle the drawer's dedicated state instead of resizing the hidden desktop nav.
      if (!isDesktopViewport()) {
        return store.setState((s: State) => ({
          showMobileNavigation:
            typeof nextState === 'boolean' ? nextState : !s.showMobileNavigation,
        }));
      }

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

    setMobileNavigation(show: boolean) {
      return store.setState(() => ({ showMobileNavigation: show }));
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

    /**
     * Attempts to focus (and select) an element identified by its ID. It is the responsibility of
     * the callee to ensure that the element is present in the DOM and that no focus trap is
     * available. When polling is enabled, this API polls and attempts to perform the focus for a
     * set duration (max 500ms), so that race conditions can be avoided with the current API
     * design.
     *
     * @param elementId The id of the element to focus.
     * @param options When a boolean, treated as the `select` option for backwards compatibility.
     *   When an object, may contain `select` and `poll` options.
     * @returns Whether the element was successfully focused. Returns a Promise when polling.
     */
    focusOnUIElement(
      elementId?: string,
      options?: boolean | { forceFocus?: boolean; select?: boolean; poll?: boolean }
    ): boolean | Promise<boolean> {
      // See RFC https://github.com/storybookjs/storybook/discussions/32983 for
      // ways to make this API more robust to focus-trap race conditions.

      const {
        forceFocus = false,
        select = false,
        poll = true,
      } = typeof options === 'boolean' ? { select: options } : (options ?? {});

      if (!elementId) {
        return false;
      }

      const attemptFocus = () => {
        const element = document.getElementById(elementId);
        if (!element) {
          return false;
        }

        element.focus();
        if (
          element !== document.activeElement &&
          forceFocus &&
          element.getAttribute('tabindex') === null
        ) {
          element.setAttribute('tabindex', '-1');
          element.focus();
        }

        if (element !== document.activeElement && element.id !== document.activeElement?.id) {
          return false;
        }

        if (select) {
          (element as any).select?.();
        }
        return true;
      };

      if (attemptFocus()) {
        return true;
      }

      if (!poll) {
        return false;
      }

      // Poll every 50ms for up to 500ms to account for race conditions.
      return new Promise<boolean>((resolve) => {
        const startTime = Date.now();
        const maxDuration = 500;
        const pollInterval = 50;

        const intervalId = setInterval(() => {
          const elapsed = Date.now() - startTime;

          if (attemptFocus()) {
            clearInterval(intervalId);
            resolve(true);
            return;
          }

          if (elapsed >= maxDuration) {
            clearInterval(intervalId);
            resolve(false);
          }
        }, pollInterval);
      });
    },

    getInitialOptions() {
      const userConfig = provider.getConfig();
      const defaultLayoutState = getDefaultLayoutState();

      const { theme, selectedPanel, layoutCustomisations } = userConfig;

      return {
        ...defaultLayoutState,
        layout: applyLayoutOptions(defaultLayoutState.layout, userConfig, !!singleStory),
        layoutCustomisations: {
          ...defaultLayoutState.layoutCustomisations,
          ...(layoutCustomisations ?? {}),
        },
        ui: applyUiOptions(defaultLayoutState.ui, userConfig),
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
    getNavAvailability(): NavAvailability {
      const state = store.getState();
      if (isReviewManagerRoute(state.path, state.customQueryParams)) {
        return 'unavailable';
      }
      return getIsNavShown(state) ? 'shown' : 'hidden';
    },

    getShowToolbarWithCustomisations(showToolbar: boolean) {
      const state = store.getState();

      if (isFunction(state.layoutCustomisations.showToolbar)) {
        return state.layoutCustomisations.showToolbar(state, showToolbar) ?? showToolbar;
      }

      return showToolbar;
    },

    getShowPanelWithCustomisations(showPanel: boolean) {
      const state = store.getState();

      if (isFunction(state.layoutCustomisations.showPanel)) {
        return state.layoutCustomisations.showPanel(state, showPanel) ?? showPanel;
      }

      return showPanel;
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

      const updatedLayout = applyLayoutOptions(layout, options, !!singleStory);

      const updatedUi = applyUiOptions(ui, options);

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
