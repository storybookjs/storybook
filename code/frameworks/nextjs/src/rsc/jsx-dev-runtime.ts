import * as ReactJSXDevRuntime from 'sb-original/react/jsx-dev-runtime';

import { wrapAsyncComponent } from '@storybook/react/internal/rsc';

/**
 * Drop-in replacement for `react/jsx-dev-runtime` that swaps async (server) components for a
 * cached client component. Enabled by the `experimentalRSC` feature flag, see `./webpack.ts`.
 */

export const Fragment = ReactJSXDevRuntime.Fragment;

export const jsxDEV: typeof ReactJSXDevRuntime.jsxDEV = (type, ...rest) =>
  ReactJSXDevRuntime.jsxDEV(wrapAsyncComponent(type), ...rest);
