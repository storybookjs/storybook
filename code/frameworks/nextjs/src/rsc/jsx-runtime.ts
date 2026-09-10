import * as ReactJSXRuntime from 'sb-original/react/jsx-runtime';

import { wrapAsyncComponent } from '@storybook/react/internal/rsc';

/**
 * Drop-in replacement for `react/jsx-runtime` that swaps async (server) components for a cached
 * client component. Enabled by the `experimentalRSC` feature flag, see `./webpack.ts`.
 */

export const Fragment = ReactJSXRuntime.Fragment;

export const jsx: typeof ReactJSXRuntime.jsx = (type, props, key) =>
  ReactJSXRuntime.jsx(wrapAsyncComponent(type), props, key);

export const jsxs: typeof ReactJSXRuntime.jsxs = (type, props, key) =>
  ReactJSXRuntime.jsxs(wrapAsyncComponent(type), props, key);
