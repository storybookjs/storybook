// We need this import to be a singleton, and because it's used in multiple entrypoints
// both in ESM and CJS, importing it via the package name instead of having a local import
// is the only way to achieve it actually being a singleton
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore we must ignore types here as during compilation they are not generated yet
import type { PropsWithChildren } from 'react';
import React from 'react';

import { getRouter } from '@storybook/nextjs/router.mock';

import { RouterContext } from 'next/dist/shared/lib/router-context.shared-runtime';

export const PageRouterProvider: React.FC<PropsWithChildren> = ({ children }) => (
  <RouterContext.Provider value={getRouter()}>{children}</RouterContext.Provider>
);
