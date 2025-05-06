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
  get data() {
    return pageData;
  },
  /**
   * @type {(newPageData: typeof pageData)=>void}
   */
  set data(newPageData) {
    pageData = newPageData;
  },
  get form() {
    return pageForm;
  },
  /**
   * @type {(newPageForm: typeof pageForm)=>void}
   */
  set form(newPageForm) {
    pageForm = newPageForm;
  },
  get error() {
    return pageError;
  },
  /**
   * @type {(newPageError: typeof pageError)=>void}
   */
  set error(newPageError) {
    pageError = newPageError;
  },
  get params() {
    return pageParams;
  },
  /**
   * @type {(newPageParams: typeof pageParams)=>void}
   */
  set params(newPageParams) {
    pageParams = newPageParams;
  },
  get route() {
    return pageRoute;
  },
  /**
   * @type {(newPageRoute: typeof pageRoute)=>void}
   */
  set route(newPageRoute) {
    pageRoute = newPageRoute;
  },
  get state() {
    return pageState;
  },
  /**
   * @type {(newPageState: typeof pageState)=>void}
   */
  set state(newPageState) {
    pageState = newPageState;
  },
  get status() {
    return pageStatus;
  },
  /**
   * @type {(newPageStatus: typeof pageStatus)=>void}
   */
  set status(newPageStatus) {
    pageStatus = newPageStatus;
  },
  get url() {
    return pageUrl;
  },
  /**
   * @type {(newPageUrl: typeof pageUrl)=>void}
   */
  set url(newPageUrl) {
    pageUrl = newPageUrl;
  },
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
  get from() {
    return navigatingFrom;
  },
  /**
   * @type {(newNavigatingFrom: typeof navigatingFrom)=>void}
   */
  set from(newNavigatingFrom) {
    navigatingFrom = newNavigatingFrom;
  },
  get to() {
    return navigatingTo;
  },
  /**
   * @type {(newNavigatingTo: typeof navigatingTo)=>void}
   */
  set to(newNavigatingTo) {
    navigatingTo = newNavigatingTo;
  },
  get type() {
    return navigatingType;
  },
  /**
   * @type {(newNavigatingType: typeof navigatingType)=>void}
   */
  set type(newNavigatingType) {
    navigatingType = newNavigatingType;
  },
  get willUnload() {
    return navigatingWillUnload;
  },
  /**
   * @type {(newNavigatingWillUnload: typeof navigatingWillUnload)=>void}
   */
  set willUnload(newNavigatingWillUnload) {
    navigatingWillUnload = newNavigatingWillUnload;
  },
  get delta() {
    return navigatingDelta;
  },
  /**
   * @type {(newNavigatingDelta: typeof navigatingDelta)=>void}
   */
  set delta(newNavigatingDelta) {
    navigatingDelta = newNavigatingDelta;
  },
  get complete() {
    return navigatingComplete;
  },
  /**
   * @type {(newNavigatingComplete: typeof navigatingComplete)=>void}
   */
  set complete(newNavigatingComplete) {
    navigatingComplete = newNavigatingComplete;
  },
};


/** @type {boolean} */
let updatedCurrent = $state.raw(false);

export let updated = {
  current: updatedCurrent,
  check: fn(() => Promise.resolve(updatedCurrent)),
};
