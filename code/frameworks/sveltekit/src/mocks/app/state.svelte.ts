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
import { fn } from 'storybook/test';

let pageData = $state.raw<Page['data']>({});
let pageForm = $state.raw<Page['form']>(null);
let pageError = $state.raw<Page['error']>(null);
let pageParams = $state.raw<Page['params']>({});
let pageRoute = $state.raw<Page['route']>({ id: null });
let pageState = $state.raw<Page['state']>({});
let pageStatus = $state.raw<Page['status']>(-1);
let pageUrl = $state.raw<Page['url']>(new URL('https://example.com'));

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
let navigatingTo = $state.raw<Navigation['to'] | null>(null);
let navigatingType = $state.raw<Navigation['type'] | null>(null);
let navigatingWillUnload = $state.raw<Navigation['willUnload'] | null>(null);
let navigatingDelta = $state.raw<Navigation['delta'] | null>(null);
let navigatingComplete = $state.raw<Navigation['complete'] | null>(null);

export let navigating = {
  from: navigatingFrom,
  to: navigatingTo,
  type: navigatingType,
  willUnload: navigatingWillUnload,
  delta: navigatingDelta,
  complete: navigatingComplete,
};

let updatedCurrent = $state.raw(false);

export let updated = {
  current: updatedCurrent,
  check: fn(() => Promise.resolve(updatedCurrent)),
};
