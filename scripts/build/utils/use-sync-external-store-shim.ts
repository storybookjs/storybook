/**
 * Stand-in for `use-sync-external-store/shim`, which react-aria and react-stately import. Every
 * React that Storybook supports (18 and later) ships `useSyncExternalStore`, and the shim package
 * only falls back to it there, so the build points the shim here instead of making it a dependency.
 */
export { useSyncExternalStore } from 'react';
