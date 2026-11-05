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

// A function, so a story that mutates `page.data` doesn't change the defaults of the next story
/** @type {() => Page} */
const defaultStatePageValues = () => ({
  data: {},
  form: null,
  error: null,
  params: {},
  route: { id: null },
  state: {},
  status: -1,
  url: new URL(location.origin),
});

const initialPage = defaultStatePageValues();

/** @type {Page['data']} */
let pageData = $state.raw(initialPage.data);
/** @type {Page['form']} */
let pageForm = $state.raw(initialPage.form);
/** @type {Page['error']} */
let pageError = $state.raw(initialPage.error);
/** @type {Page['params']} */
let pageParams = $state.raw(initialPage.params);
/** @type {Page['route']} */
let pageRoute = $state.raw(initialPage.route);
/** @type {Page['state']} */
let pageState = $state.raw(initialPage.state);
/** @type {Page['status']} */
let pageStatus = $state.raw(initialPage.status);
/** @type {Page['url']} */
let pageUrl = $state.raw(initialPage.url);

/** @type {Page} */
// oxlint-disable-next-line prefer-const -- mirrors upstream SvelteKit state.svelte.js, where this is a mutable `let` binding
export let page = {
  get data() {
    return pageData;
  },
  set data(newPageData) {
    pageData = newPageData;
  },
  get form() {
    return pageForm;
  },
  set form(newPageForm) {
    pageForm = newPageForm;
  },
  get error() {
    return pageError;
  },
  set error(newPageError) {
    pageError = newPageError;
  },
  get params() {
    return pageParams;
  },
  set params(newPageParams) {
    pageParams = newPageParams;
  },
  get route() {
    return pageRoute;
  },
  set route(newPageRoute) {
    pageRoute = newPageRoute;
  },
  get state() {
    return pageState;
  },
  set state(newPageState) {
    pageState = newPageState;
  },
  get status() {
    return pageStatus;
  },
  set status(newPageStatus) {
    pageStatus = newPageStatus;
  },
  get url() {
    return pageUrl;
  },
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

const defaultStateNavigatingValues = {
  from: null,
  to: null,
  type: null,
  willUnload: null,
  delta: null,
  complete: null,
};

/** @type {Navigation['from'] | null} */
let navigatingFrom = $state.raw(defaultStateNavigatingValues.from);
/** @type {Navigation['to'] | null} */
let navigatingTo = $state.raw(defaultStateNavigatingValues.to);
/** @type {Navigation['type'] | null} */
let navigatingType = $state.raw(defaultStateNavigatingValues.type);
/** @type {Navigation['willUnload'] | null} */
let navigatingWillUnload = $state.raw(defaultStateNavigatingValues.willUnload);
/** @type {Navigation['delta'] | null} */
let navigatingDelta = $state.raw(defaultStateNavigatingValues.delta);
/** @type {Navigation['complete'] | null} */
let navigatingComplete = $state.raw(defaultStateNavigatingValues.complete);

/** @type {Navigation} */
// oxlint-disable-next-line prefer-const -- mirrors upstream SvelteKit state.svelte.js, where this is a mutable `let` binding
export let navigating = {
  get from() {
    return navigatingFrom;
  },
  set from(newNavigatingFrom) {
    navigatingFrom = newNavigatingFrom;
  },
  get to() {
    return navigatingTo;
  },
  set to(newNavigatingTo) {
    navigatingTo = newNavigatingTo;
  },
  get type() {
    return navigatingType;
  },
  set type(newNavigatingType) {
    navigatingType = newNavigatingType;
  },
  get willUnload() {
    return navigatingWillUnload;
  },
  set willUnload(newNavigatingWillUnload) {
    navigatingWillUnload = newNavigatingWillUnload;
  },
  get delta() {
    return navigatingDelta;
  },
  set delta(newNavigatingDelta) {
    navigatingDelta = newNavigatingDelta;
  },
  get complete() {
    return navigatingComplete;
  },
  set complete(newNavigatingComplete) {
    navigatingComplete = newNavigatingComplete;
  },
};

/** @type {boolean} */
let updatedCurrent = $state.raw(false);

// oxlint-disable-next-line prefer-const -- mirrors upstream SvelteKit state.svelte.js, where this is a mutable `let` binding
export let updated = {
  get current() {
    return updatedCurrent;
  },
  set current(newCurrent) {
    updatedCurrent = newCurrent;
  },
  check: fn(() => Promise.resolve(updatedCurrent)),
};

/** Resets `page`, `navigating` and `updated` to their defaults. The framework calls it before every story. */
export function resetAppState() {
  Object.assign(page, defaultStatePageValues());
  Object.assign(navigating, defaultStateNavigatingValues);
  updated.current = false;
}
