/**
 * Inspired by the the code:
 * {@link https://github.com/sveltejs/kit/blob/main/packages/kit/src/runtime/client/state.svelte.js}
 *
 * The differences:
 *
 * - Legacy Svelte support is not included
 * - Not using classes (internal coding style preference)
 *
 * @module
 */
import { fn } from 'storybook/test';

/**
 * @typedef {Object} App
 * @property {Object} Error
 * @property {string} Error.message
 * @property {Object} Locals
 * @property {Object} PageData
 * @property {Object} PageState
 * @property {Object} Platform
 */

/**
 * @typedef {Object} Page
 * @property {URL} url
 * @property {Record<string, string>} params
 * @property {Object} route
 * @property {string | null} route.id
 * @property {number} status
 * @property {App.Error | null} error
 * @property {App.PageData & Record<string, any>} data
 * @property {App.PageState} state
 * @property {any} form
 */

/** @type {Page['data']} */
let pageData = $state.raw({});
/** @type {Page['form']} */
let pageForm = $state.raw(null);
/** @type {Page['error']} */
let pageError = $state.raw(null);
/** @type {Page['params']} */
let pageParams = $state.raw({});
/** @type {Page['route']} */
let pageRoute = $state.raw({ id: null });
/** @type {Page['state']} */
let pageState = $state.raw({});
/** @type {Page['status']} */
let pageStatus = $state.raw(-1);
/** @type {Page['url']} */
let pageUrl = $state.raw(new URL(location.origin));

/** @type {Page} */
export let page = {
  data: pageData,
  form: pageForm,
  error: pageError,
  params: pageParams,
  route: pageRoute,
  state: pageState,
  status: pageStatus,
  url: pageUrl,
};

/**
 * @typedef {Object} NavigationTarget
 * @property {Record<string, string> | null} params
 * @property {Object} route
 * @property {string | null} route.id
 * @property {URL} url
 */

/** @typedef {'enter' | 'form' | 'leave' | 'link' | 'goto' | 'popstate'} NavigationType */

/**
 * @typedef {Object} Navigation
 * @property {NavigationTarget | null} from
 * @property {NavigationTarget | null} to
 * @property {Exclude<NavigationType, 'enter'>} type
 * @property {boolean} willUnload
 * @property {number} [delta]
 * @property {Promise<void>} complete
 */

/** @type {Navigation['from'] | null} */
let navigatingFrom = $state.raw(null);
/** @type {Navigation['to'] | null} */
let navigatingTo = $state.raw(null);
/** @type {Navigation['type'] | null} */
let navigatingType = $state.raw(null);
/** @type {Navigation['willUnload'] | null} */
let navigatingWillUnload = $state.raw(null);
/** @type {Navigation['delta'] | null} */
let navigatingDelta = $state.raw(null);
/** @type {Navigation['complete'] | null} */
let navigatingComplete = $state.raw(null);

/** @type {Navigation} */
export let navigating = {
  from: navigatingFrom,
  to: navigatingTo,
  type: navigatingType,
  willUnload: navigatingWillUnload,
  delta: navigatingDelta,
  complete: navigatingComplete,
};

/** @type {boolean} */
let updatedCurrent = $state.raw(false);

export let updated = {
  current: updatedCurrent,
  check: fn(() => Promise.resolve(updatedCurrent)),
};
