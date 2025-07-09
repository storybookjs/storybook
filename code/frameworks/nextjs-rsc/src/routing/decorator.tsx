'use client';

import { type ReactNode } from 'react';

import type { Addon_StoryContext } from 'storybook/internal/types';

import { RedirectBoundary } from 'next/dist/client/components/redirect-boundary';
// @ts-expect-error no types
import * as React from 'next/dist/compiled/react';

import { AppRouterProvider } from './app-router-provider';
import type { RouteParams } from './types';

const defaultRouterParams: RouteParams = {
  pathname: '/',
  query: {},
};

export const RouterDecorator = ({
  children,
  nextjs,
}: {
  children: ReactNode;
  nextjs: Addon_StoryContext['parameters']['nextjs'];
}): ReactNode => {
  if (!AppRouterProvider) {
    return null;
  }
  return (
    <AppRouterProvider
      routeParams={{
        ...defaultRouterParams,
        ...nextjs?.navigation,
      }}
    >
      {/*
        The next.js RedirectBoundary causes flashing UI when used client side.
        Possible use the implementation of the PR: https://github.com/vercel/next.js/pull/49439
        Or wait for next to solve this on their side.
        */}
      <RedirectBoundary>{children}</RedirectBoundary>
    </AppRouterProvider>
  );
};
