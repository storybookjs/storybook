'use client';

import * as React from 'react';

import type { Addon_StoryContext } from 'storybook/internal/types';

import { RedirectBoundary } from 'next/dist/client/components/redirect-boundary';

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
  children: React.ReactNode;
  nextjs: Addon_StoryContext['parameters']['nextjs'];
}): React.ReactNode => {
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
