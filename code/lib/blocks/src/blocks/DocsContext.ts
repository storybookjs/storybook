/* eslint-disable no-underscore-dangle */
import type { Context } from 'react';
import { createContext } from 'react';

import type { DocsContextProps, Renderer } from 'storybook/internal/types';

import { global } from '@storybook/global';

export type { DocsContextProps };

// We add DocsContext to window. The reason is that in case DocsContext.ts is
// imported multiple times (maybe once directly, and another time from a minified bundle)
// we will have multiple DocsContext definitions - leading to lost context in
// the React component tree.
// This was specifically a problem with the Vite builder.
if (global && global.__DOCS_CONTEXT__ === undefined) {
  global.__DOCS_CONTEXT__ = createContext(null);
  global.__DOCS_CONTEXT__.displayName = 'DocsContext';
}

export const DocsContext: Context<DocsContextProps<Renderer>> = global
  ? global.__DOCS_CONTEXT__
  : createContext(null);
