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
import { fn } from 'storybook/test';

/**
 * Copied from:
 * {@link https://github.com/sveltejs/kit/blob/7bb41aa4263b057a8912f4cdd35db03755d37342/packages/kit/types/index.d.ts#L2552-L2581}
 * There were build issues after adding `@sveltejs/kit` as `devDependency`: Error: namespace child
 * (hoisting) not supported yet
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace App {
  export interface Error {
    message: string;
  }

  export interface Locals {}

  export interface PageData {}

  export interface PageState {}

  export interface Platform {}
}

/**
 * Copied from:
 * {@link https://github.com/sveltejs/kit/blob/7bb41aa4263b057a8912f4cdd35db03755d37342/packages/kit/types/index.d.ts#L1102-L1143}
 */
export interface Page<
  Params extends Record<string, string> = Record<string, string>,
  RouteId extends string | null = string | null,
> {
  url: URL;
  params: Params;
  route: {
    id: RouteId;
  };
  status: number;
  error: App.Error | null;
  data: App.PageData & Record<string, any>;
  state: App.PageState;
  form: any;
}

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

/**
 * Copied from:
 * {@link https://github.com/sveltejs/kit/blob/7bb41aa4263b057a8912f4cdd35db03755d37342/packages/kit/types/index.d.ts#L988}
 */
interface NavigationTarget {
  params: Record<string, string> | null;
  route: {
    id: string | null;
  };
  url: URL;
}

/**
 * Copied from:
 * {@link https://github.com/sveltejs/kit/blob/7bb41aa4263b057a8912f4cdd35db03755d37342/packages/kit/types/index.d.ts#L1017C9-L1017C89}
 */
type NavigationType = 'enter' | 'form' | 'leave' | 'link' | 'goto' | 'popstate';

/**
 * Copied from:
 * {@link @link https://github.com/sveltejs/kit/blob/7bb41aa4263b057a8912f4cdd35db03755d37342/packages/kit/types/index.d.ts#L1017C9-L1017C89}
 */
export interface Navigation {
  from: NavigationTarget | null;
  to: NavigationTarget | null;
  type: Exclude<NavigationType, 'enter'>;
  willUnload: boolean;
  delta?: number;
  complete: Promise<void>;
}

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
