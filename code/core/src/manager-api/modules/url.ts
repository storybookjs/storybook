import {
  NAVIGATE_URL,
  STORY_ARGS_UPDATED,
  SET_CURRENT_STORY,
  GLOBALS_UPDATED,
  UPDATE_QUERY_PARAMS,
} from '@storybook/core/core-events';
import type { NavigateOptions } from '@storybook/core/router';
import { queryFromLocation, buildArgsParam } from '@storybook/core/router';
import { dequal as deepEqual } from 'dequal';
import { global } from '@storybook/global';

import type { API_Layout, API_UI, Args } from '@storybook/core/types';
import type { ModuleArgs, ModuleFn } from '../lib/types';
import { defaultLayoutState } from './layout';

const { window: globalWindow } = global;

export interface SubState {
  customQueryParams: QueryParams;
}

const parseBoolean = (value: string) => {
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return undefined;
};

// Initialize the state based on the URL.
// NOTE:
//   Although we don't change the URL when you change the state, we do support setting initial state
//   via the following URL parameters:
//     - full: 0/1 -- show fullscreen
//     - panel: bottom/right/0 -- set addons panel position (or hide)
//     - nav: 0/1 -- show or hide the story list
//
//   We also support legacy URLs from storybook <5
let prevParams: ReturnType<typeof queryFromLocation>;
const initialUrlSupport = ({
  state: { location, path, viewMode, storyId: storyIdFromUrl },
  singleStory,
}: ModuleArgs) => {
  const {
    full,
    panel,
    nav,
    shortcuts,
    addonPanel,
    tabs,
    path: queryPath,
    ...otherParams // the rest gets passed to the iframe
  } = queryFromLocation(location);

  let navSize;
  let bottomPanelHeight;
  let rightPanelWidth;

  // set sizes based on fullscreen
  if (parseBoolean(full) === true) {
    navSize = 0;
    bottomPanelHeight = 0;
    rightPanelWidth = 0;
  } else if (parseBoolean(full) === false) {
    navSize = defaultLayoutState.layout.navSize;
    bottomPanelHeight = defaultLayoutState.layout.bottomPanelHeight;
    rightPanelWidth = defaultLayoutState.layout.rightPanelWidth;
  }
  // set sizes based on nav
  if (!singleStory) {
    if (parseBoolean(nav) === true) {
      navSize = defaultLayoutState.layout.navSize;
    }
    if (parseBoolean(nav) === false) {
      navSize = 0;
    }
  }
  // set sizes based on panel
  if (parseBoolean(panel) === false) {
    bottomPanelHeight = 0;
    rightPanelWidth = 0;
  }

  const layout: Partial<API_Layout> = {
    navSize,
    bottomPanelHeight,
    rightPanelWidth,
    panelPosition: ['right', 'bottom'].includes(panel) ? panel : undefined,
    showTabs: parseBoolean(tabs),
  };
  const ui: Partial<API_UI> = {
    enableShortcuts: parseBoolean(shortcuts),
  };
  const selectedPanel = addonPanel || undefined;

  const storyId = storyIdFromUrl;
  // Avoid returning a new object each time if no params actually changed.
  const customQueryParams = deepEqual(prevParams, otherParams) ? prevParams : otherParams;
  prevParams = customQueryParams;

  return { viewMode, layout, ui, selectedPanel, location, path, customQueryParams, storyId };
};

export interface QueryParams {
  [key: string]: string | undefined;
}

/**
 * SubAPI for managing URL navigation and state.
 */
export interface SubAPI {
  /**
   * Navigate to a new URL.
   * @param {string} url - The URL to navigate to.
   * @param {NavigateOptions} options - Options for the navigation.
   * @returns {void}
   */
  navigateUrl: (url: string, options: NavigateOptions) => void;
  /**
   * Get the value of a query parameter from the current URL.
   * @param {string} key - The key of the query parameter to get.
   * @returns {string | undefined} The value of the query parameter, or undefined if it does not exist.
   */
  getQueryParam: (key: string) => string | undefined;
  /**
   * Returns an object containing the current state of the URL.
   * @returns {{
   *   queryParams: QueryParams,
   *   path: string,
   *   viewMode?: string,
   *   storyId?: string,
   *   url: string
   * }} An object containing the current state of the URL.
   */
  getUrlState: () => {
    queryParams: QueryParams;
    path: string;
    viewMode?: string;
    storyId?: string;
    url: string;
  };
  /**
   * Set the query parameters for the current URL.
   * @param {QueryParams} input - An object containing the query parameters to set.
   * @returns {void}
   */
  setQueryParams: (input: QueryParams) => void;
  /**
   * Set the query parameters for the current URL & navigates.
   * @param {QueryParams} input - An object containing the query parameters to set.
   * @returns {void}
   */
  applyQueryParams: (input: QueryParams) => void;
}

export const init: ModuleFn<SubAPI, SubState> = (moduleArgs) => {
  const { store, navigate, provider, fullAPI } = moduleArgs;

  const navigateTo = (
    path: string,
    queryParams: Record<string, string> = {},
    options: NavigateOptions = {}
  ) => {
    const params = Object.entries(queryParams)
      .filter(([, v]) => v)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${k}=${v}`);
    const to = [path, ...params].join('&');
    return navigate(to, options);
  };

  const api: SubAPI = {
    getQueryParam(key) {
      const { customQueryParams } = store.getState();
      return customQueryParams ? customQueryParams[key] : undefined;
    },
    getUrlState() {
      const { path, customQueryParams, storyId, url, viewMode } = store.getState();
      return { path, queryParams: customQueryParams, storyId, url, viewMode };
    },
    setQueryParams(input) {
      const { customQueryParams } = store.getState();
      const queryParams: QueryParams = {};
      const update = {
        ...customQueryParams,
        ...Object.entries(input).reduce((acc, [key, value]) => {
          if (value !== null) {
            acc[key] = value;
          }
          return acc;
        }, queryParams),
      };
      if (!deepEqual(customQueryParams, update)) {
        store.setState({ customQueryParams: update });
        provider.channel?.emit(UPDATE_QUERY_PARAMS, update);
      }
    },
    applyQueryParams(input) {
      const { path, queryParams } = api.getUrlState();

      navigateTo(path, { ...queryParams, ...input } as any);
      api.setQueryParams(input);
    },
    navigateUrl(url, options) {
      navigate(url, { plain: true, ...options });
    },
  };

  /**
   * Sets `args` parameter in URL, omitting any args that have their initial value or cannot be unserialized safely.
   */
  const updateArgsParam = () => {
    const { path, queryParams, viewMode } = api.getUrlState();
    if (viewMode !== 'story') return;

    const currentStory = fullAPI.getCurrentStoryData();
    if (currentStory?.type !== 'story') return;

    const { args, initialArgs } = currentStory;
    const argsString = buildArgsParam(initialArgs, args as Args);
    navigateTo(path, { ...queryParams, args: argsString }, { replace: true });
    api.setQueryParams({ args: argsString });
  };

  provider.channel?.on(SET_CURRENT_STORY, () => updateArgsParam());

  let handleOrId: any;
  provider.channel?.on(STORY_ARGS_UPDATED, () => {
    if ('requestIdleCallback' in globalWindow) {
      if (handleOrId) globalWindow.cancelIdleCallback(handleOrId);
      handleOrId = globalWindow.requestIdleCallback(updateArgsParam, { timeout: 1000 });
    } else {
      if (handleOrId) clearTimeout(handleOrId);
      setTimeout(updateArgsParam, 100);
    }
  });

  provider.channel?.on(GLOBALS_UPDATED, ({ userGlobals, initialGlobals }: any) => {
    const { path, queryParams } = api.getUrlState();
    const globalsString = buildArgsParam(initialGlobals, userGlobals);
    navigateTo(path, { ...queryParams, globals: globalsString }, { replace: true });
    api.setQueryParams({ globals: globalsString });
  });

  provider.channel?.on(NAVIGATE_URL, (url: string, options: NavigateOptions) => {
    api.navigateUrl(url, options);
  });

  return {
    api,
    state: initialUrlSupport(moduleArgs),
  };
};
