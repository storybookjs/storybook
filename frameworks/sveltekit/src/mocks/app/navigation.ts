import { getContext, onMount, setContext } from 'svelte';

export async function goto(...args: any[]) {
  const event = new CustomEvent('storybook:goto', {
    detail: args,
  });
  window.dispatchEvent(event);
}

export function setAfterNavigateArgument(afterNavigateArgs: any) {
  setContext('after-navigate-args', afterNavigateArgs);
}

export function afterNavigate(cb: any) {
  const argument = getContext('after-navigate-args');
  onMount(() => {
    if (cb && cb instanceof Function) {
      cb(argument);
    }
  });
}

export function onNavigate() {}

export function beforeNavigate() {}

export function disableScrollHandling() {}

export async function invalidate(...args: any[]) {
  const event = new CustomEvent('storybook:invalidate', {
    detail: args,
  });
  window.dispatchEvent(event);
}

export async function invalidateAll() {
  const event = new CustomEvent('storybook:invalidateAll');
  window.dispatchEvent(event);
}

export function preloadCode() {}

export function preloadData() {}

export async function pushState(...args: any[]) {
  const event = new CustomEvent('storybook:pushState', {
    detail: args,
  });
  window.dispatchEvent(event);
}

export async function replaceState(...args: any[]) {
  const event = new CustomEvent('storybook:replaceState', {
    detail: args,
  });
  window.dispatchEvent(event);
}
