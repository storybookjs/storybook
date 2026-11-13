// An explicit export shadows the same name from an `export *`, whatever the statement order.
export * from './legacy';
export { default as Button } from './Button.svelte';
