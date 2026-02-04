import React, { useEffect, useMemo } from 'react';

import type { DecoratorFunction } from '@storybook/react';

import {
  QueryClient,
  QueryClientProvider,
  isCancelledError as isQueryCancelledError,
} from '@tanstack/react-query';
import {
  type Router,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';

import type { TanStackPreviewOptions } from './types';

const buildInitialEntry = (path: string, search?: Record<string, unknown>) => {
  if (!search || Object.keys(search).length === 0) {
    return path;
  }
  const params = new URLSearchParams();
  Object.entries(search).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, String(v)));
      return;
    }
    params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
};

const applyDefaultLocation = (
  router: Router<any>,
  options: TanStackPreviewOptions['router'] = {}
) => {
  const { defaultParams, defaultSearch } = options;
  const hasDefaultParams = defaultParams && Object.keys(defaultParams).length > 0;
  const hasDefaultSearch = defaultSearch && Object.keys(defaultSearch).length > 0;

  if (!hasDefaultParams && !hasDefaultSearch) {
    return;
  }

  const { location } = router.state;
  const nextParams =
    hasDefaultParams && (!location.params || Object.keys(location.params).length === 0)
      ? defaultParams
      : undefined;
  const nextSearch =
    hasDefaultSearch && (!location.search || Object.keys(location.search).length === 0)
      ? defaultSearch
      : undefined;

  if (!nextParams && !nextSearch) {
    return;
  }

  void router.navigate({
    to: location.pathname,
    params: nextParams as any,
    search: nextSearch as any,
    replace: true,
  });
};

const createStoryRouter = (storyElement: React.ReactElement, options: TanStackPreviewOptions) => {
  const routerOptions = options.router ?? {};

  const mode =
    routerOptions.mode ??
    (routerOptions.instance
      ? 'instance'
      : routerOptions.routeTree
        ? 'routeTree'
        : routerOptions.enabled
          ? 'story'
          : undefined);

  if (!mode) {
    return null;
  }

  if (mode === 'instance') {
    return routerOptions.instance ?? null;
  }

  const createRouterFactory = routerOptions.createRouter ?? createRouter;
  const createHistory = () =>
    routerOptions.history ??
    createMemoryHistory({
      initialEntries: routerOptions.initialEntries ?? [
        buildInitialEntry(routerOptions.storyPath ?? '/', routerOptions.defaultSearch),
      ],
      initialIndex: routerOptions.initialIndex,
    });

  if (mode === 'routeTree' && routerOptions.routeTree) {
    const router = createRouterFactory({
      routeTree: routerOptions.routeTree,
      history: createHistory(),
      context: routerOptions.context,
    });
    applyDefaultLocation(router, routerOptions);
    return router;
  }

  const storyPath = routerOptions.storyPath ?? '/';

  const rootRoute = createRootRoute({
    component: ({ children }) => <>{children}</>,
  });

  const storyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: storyPath,
    component: () => storyElement,
  });

  const fallbackRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '*',
    component: () => storyElement,
  });

  const routeTree = rootRoute.addChildren([storyRoute, fallbackRoute]);

  const router = createRouterFactory({
    routeTree,
    history: createHistory(),
    context: routerOptions.context,
  });

  applyDefaultLocation(router, routerOptions);
  return router;
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
