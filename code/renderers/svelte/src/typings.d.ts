declare var STORYBOOK_ENV: 'svelte';
declare var LOGLEVEL: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent' | undefined;

declare module '*.svelte' {
  import type { Component } from 'svelte';

  const component: Component;
  export default component;
}
