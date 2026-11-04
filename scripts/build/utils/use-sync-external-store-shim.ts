/**
 * Stand-in for `use-sync-external-store/shim/index.js`, which react-aria and react-stately import.
 * That shim backfills the hook for React 16 and 17. Storybook requires React 18 (and Preact 10.9 in
 * `preact/compat`), which have it built in, so the build resolves the shim here instead of making
 * `storybook` depend on it.
 */
export { useSyncExternalStore } from 'react';
