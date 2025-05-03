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

/* eslint-disable prefer-const */
import type { Navigation, Page } from '@sveltejs/kit';

let pageData = $state.raw({});
let pageForm = $state.raw(null);
let pageError = $state.raw(null);
let pageParams = $state.raw({});
let pageRoute = $state.raw({ id: null });
let pageState = $state.raw({});
let pageStatus = $state.raw(-1);
let pageUrl = $state.raw(new URL('https://example.com'));

export let page = {
  data: pageData,
  form: pageForm,
  error: pageError,
  params: pageParams,
  route: pageRoute,
  state: pageState,
  status: pageStatus,
  url: pageUrl,
} satisfies Page;

let navigatingFrom = $state.raw<Navigation['from'] | null>(null);
let navigatingTo = $state.raw<Navigation['from'] | null>(null);
let navigatingType = $state.raw<Navigation['type'] | null>(null);
let navigatingWillUnload = $state.raw<Navigation['willUnload'] | null>(null);
let navigatingDelta = $state.raw<Navigation['delta'] | null>(null);
let navigatingComplete = $state.raw<Navigation['complete'] | null>(null);

export let navigating = {
  from: navigatingFrom,
  to: navigatingTo,
  type: navigatingType,
  unload: navigatingWillUnload,
  delta: navigatingDelta,
  complete: navigatingComplete,
};

export let updated = $state.raw(false);

Object.assign(updated, {
  check: () => new Promise<boolean>((resolve) => resolve(updated)),
});
