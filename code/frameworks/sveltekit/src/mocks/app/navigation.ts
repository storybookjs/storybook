import { onMount } from 'svelte';

import { fn } from 'storybook/test';

import type { AfterNavigate } from '../types.ts';

/*
 * Mock of SvelteKit's `$app/navigation`, which the framework aliases to this module. Stories import
 * the same functions from `$app/navigation` to assert on them or to change them with `mocked()`.
 *
 * Calls that navigate or reload are named, so they show in the Actions panel. Functions that a
 * component calls while it initializes (`afterNavigate`, `beforeNavigate`, `onNavigate`,
 * `snapshot`) are not named, so mounting a component doesn't log anything.
 */

type Url = string | URL;

export const goto = fn<(url: Url, opts?: Record<string, unknown>) => Promise<void>>(
  async () => {}
).mockName('$app/navigation::goto');

export const invalidate = fn<(resource: Url | ((url: URL) => boolean)) => Promise<void>>(
  async () => {}
).mockName('$app/navigation::invalidate');

export const invalidateAll = fn(async () => {}).mockName('$app/navigation::invalidateAll');

export const refreshAll = fn<(opts?: { includeLoadFunctions?: boolean }) => Promise<void>>(
  async () => {}
).mockName('$app/navigation::refreshAll');

export const preloadData = fn<
  (href: string) => Promise<{ type: 'loaded'; status: number; data: Record<string, unknown> }>
>(async () => ({ type: 'loaded', status: 200, data: {} })).mockName('$app/navigation::preloadData');

export const preloadCode = fn<(pathname: string) => Promise<void>>(async () => {}).mockName(
  '$app/navigation::preloadCode'
);

export const pushState = fn<(url: Url, state: Record<string, unknown>) => void>(() => {}).mockName(
  '$app/navigation::pushState'
);

export const replaceState = fn<(url: Url, state: Record<string, unknown>) => void>(
  () => {}
).mockName('$app/navigation::replaceState');

export const disableScrollHandling = fn(() => {}).mockName(
  '$app/navigation::disableScrollHandling'
);

export const beforeNavigate = fn<(callback: (navigation: unknown) => void) => void>(() => {});

export const onNavigate = fn<(callback: (navigation: unknown) => unknown) => void>(() => {});

export const snapshot = fn<
  (options: { capture: () => unknown; restore: (value: unknown) => void }) => void
>(() => {});

const defaultAfterNavigate = (): AfterNavigate => ({
  type: 'enter',
  from: null,
  to: null,
  shallow: false,
  willUnload: false,
  complete: Promise.resolve(),
});

let afterNavigateNavigation = defaultAfterNavigate();

/**
 * Sets the navigation that `afterNavigate` callbacks receive when the component mounts. It merges
 * `navigation` into the default, an `enter` navigation from nowhere, like a fresh page load. Call it
 * in `beforeEach`; the framework resets it before every story.
 *
 * @example
 *
 * ```ts
 * import { setAfterNavigate } from '@storybook/sveltekit/navigation.mock';
 *
 * export const FromSearch = {
 *   beforeEach() {
 *     setAfterNavigate({ type: 'link', from: { url: new URL('http://localhost/search?q=shoes') } });
 *   },
 * };
 * ```
 */
export function setAfterNavigate(navigation: Partial<AfterNavigate>) {
  afterNavigateNavigation = { ...defaultAfterNavigate(), ...navigation } as AfterNavigate;
}

// Like SvelteKit, calls the callback once the component has mounted. Storybook never navigates, so
// it is the only call.
export const afterNavigate = fn((callback: (navigation: AfterNavigate) => void) => {
  // Read while the component initializes, right after its story's `beforeEach`, so that in docs
  // mode, a story that sets up later doesn't change it
  const navigation = afterNavigateNavigation;
  onMount(() => {
    callback(navigation);
  });
});

/**
 * Called when a link in the story is clicked, instead of navigating the preview. SvelteKit's router
 * handles link clicks without `goto`, so they have their own spy. Assert on it in `play`, or give it
 * an implementation in `beforeEach`.
 *
 * @example
 *
 * ```ts
 * import { link } from '@storybook/sveltekit/navigation.mock';
 *
 * await userEvent.click(canvas.getByRole('link', { name: 'Settings' }));
 * await expect(link).toHaveBeenCalledWith('/settings', expect.anything());
 * ```
 */
export const link = fn<(href: string, event: MouseEvent) => void>(() => {}).mockName(
  '$app/navigation::link'
);
