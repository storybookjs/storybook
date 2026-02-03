import React, { useEffect, useMemo } from 'react';

import type { DecoratorFunction } from '@storybook/react';

import {
  QueryClient,
  QueryClientProvider,
  isCancelledError as isQueryCancelledError,
} from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';

import type { TanStackPreviewOptions } from './types';

const createStoryRouter = (storyElement: React.ReactElement, options: TanStackPreviewOptions) => {
  const routerOptions = options.router ?? {};

  if (!routerOptions.enabled && !routerOptions.instance && !routerOptions.routeTree) {
    return null;
  }

  if (routerOptions.instance) {
    return routerOptions.instance;
  }

  if (routerOptions.routeTree) {
    return createRouter({
      routeTree: routerOptions.routeTree,
      history:
        routerOptions.history ??
        createMemoryHistory({
          initialEntries: routerOptions.initialEntries ?? ['/'],
        }),
    });
  }

  const rootRoute = createRootRoute({
    component: ({ children }) => <>{children}</>,
  });

  const storyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => storyElement,
  });

  const fallbackRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '*',
    component: () => storyElement,
  });

  const routeTree = rootRoute.addChildren([storyRoute, fallbackRoute]);

  const history =
    routerOptions.history ??
    createMemoryHistory({
      initialEntries: routerOptions.initialEntries ?? ['/'],
    });

  return createRouter({
    routeTree,
    history,
  });
};

const TanStackProvider: React.FC<{
  storyElement: React.ReactElement;
  options: TanStackPreviewOptions;
}> = ({ storyElement, options }) => {
  const queryClient = useMemo(
    () => options.queryClient ?? new QueryClient(options.queryClientConfig),
    [options.queryClient, options.queryClientConfig]
  );

  const router = useMemo(() => createStoryRouter(storyElement, options), [storyElement, options]);

  useEffect(() => {
    return () => {
      if (!options.queryClient) {
        queryClient.clear();
      }
    };
  }, [options.queryClient, queryClient]);

  const content = router ? <RouterProvider router={router} /> : storyElement;

  return <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>;
};

export const decorators: DecoratorFunction[] = [
  (Story, context) => {
    const options = (context.parameters?.tanstack ?? {}) as TanStackPreviewOptions;
    const storyElement = <Story />;
    return <TanStackProvider storyElement={storyElement} options={options} />;
  },
];

export const parameters = {
  layout: 'fullscreen',
  tanstack: {
    // surface the cancellation helper for test setup if needed
    isQueryCancelledError,
  },
};
