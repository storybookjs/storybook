import React, { useEffect, useMemo, useRef } from 'react';

import type { Decorator } from '@storybook/react';

import {
  QueryClient,
  QueryClientProvider,
  isCancelledError as isQueryCancelledError,
} from '@tanstack/react-query';
import {
  type AnyRouter,
  type Router,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';

import type { TanStackPreviewOptions } from './types';

// Module-level router registry
const routerRegistry = new Map<string, Router<any>>();
let lastRegisteredRouter: Router<any> | null = null;

/** Returns the last registered router across all stories. */
export const getRouter = (): Router<any> | null => lastRegisteredRouter;

/** Returns the router for a specific story ID. */
export const getRouterForStory = (storyId: string): Router<any> | undefined =>
  routerRegistry.get(storyId);

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

/**
 * Patches a route tree by walking all routes and applying mocks/forced states. Returns a restore
 * function to revert changes (no-op if isFactory is true).
 */
const patchRouteTree = (
  routeTree: AnyRouter['routeTree'],
  options: TanStackPreviewOptions['router'] = {},
  isFactory: boolean
): (() => void) => {
  const restoreFns: Array<() => void> = [];

  const walkRoute = (route: any) => {
    // Check for wildcard route if forceNotFound is enabled
    if (options.forceNotFound && (route.path === '*' || route.id === '*')) {
      console.warn(
        '[@storybook/tanstack-react] forceNotFound: a wildcard (*) route was detected in the route tree. The sentinel navigation may be matched by the wildcard instead of triggering a not-found state.'
      );
    }

    let newLoader: any = undefined;
    let newBeforeLoad: any = undefined;

    // Priority 1: forceError
    if (options.forceError) {
      newLoader = () => {
        throw options.forceError;
      };
      newBeforeLoad = () => {
        throw options.forceError;
      };
    }
    // Priority 2: forcePending
    else if (options.forcePending) {
      newLoader = () => new Promise(() => {});
    }
    // Priority 3: mockLoaders / mockBeforeLoad
    else {
      // Check route.id, then route.path, then route.fullPath for mock keys
      if (options.mockLoaders) {
        const key =
          (route.id && options.mockLoaders[route.id] && route.id) ||
          (route.path && options.mockLoaders[route.path] && route.path) ||
          (route.fullPath && options.mockLoaders[route.fullPath] && route.fullPath);
        if (key) {
          newLoader = options.mockLoaders[key];
        }
      }

      if (options.mockBeforeLoad) {
        const key =
          (route.id && options.mockBeforeLoad[route.id] && route.id) ||
          (route.path && options.mockBeforeLoad[route.path] && route.path) ||
          (route.fullPath && options.mockBeforeLoad[route.fullPath] && route.fullPath);
        if (key) {
          newBeforeLoad = options.mockBeforeLoad[key];
        }
      }
    }

    // Priority 4: bypassGuards (only if forceError hasn't already set beforeLoad)
    if (options.bypassGuards && !options.forceError) {
      newBeforeLoad = async () => {};
    }

    // Apply patches via route.update()
    if (newLoader !== undefined || newBeforeLoad !== undefined) {
      // Save originals for restore (only if not a factory tree)
      if (!isFactory) {
        const originalLoader = route.options?.loader;
        const originalBeforeLoad = route.options?.beforeLoad;
        restoreFns.push(() => {
          const restoreOpts: any = {};
          if (newLoader !== undefined) {
            restoreOpts.loader = originalLoader;
          }
          if (newBeforeLoad !== undefined) {
            restoreOpts.beforeLoad = originalBeforeLoad;
          }
          route.update(restoreOpts);
        });
      }

      // Apply the new loader/beforeLoad
      const updateOpts: any = {};
      if (newLoader !== undefined) {
        updateOpts.loader = newLoader;
      }
      if (newBeforeLoad !== undefined) {
        updateOpts.beforeLoad = newBeforeLoad;
      }
      route.update(updateOpts);
    }

    // Recurse into children
    if (route.children) {
      if (Array.isArray(route.children)) {
        route.children.forEach(walkRoute);
      } else if (typeof route.children === 'object') {
        Object.values(route.children).forEach(walkRoute);
      }
    }
  };

  walkRoute(routeTree);

  return () => {
    restoreFns.forEach((fn) => fn());
  };
};

/** Builds the router history based on options. */
const buildHistory = (options: TanStackPreviewOptions['router'] = {}) => {
  if (options.history) {
    return options.history;
  }

  const initialEntries = options.forceNotFound
    ? ['/__storybook_not_found__']
    : (options.initialEntries ?? [
        buildInitialEntry(options.storyPath ?? '/', options.defaultSearch),
      ]);

  return createMemoryHistory({
    initialEntries,
    initialIndex: options.initialIndex,
  });
};

/** Builds the options object for createRouter. */
const buildRouterCreateOptions = (
  options: TanStackPreviewOptions['router'],
  routeTree: AnyRouter['routeTree'],
  history: any
) => {
  return {
    routeTree,
    history,
    context: options?.context,
    defaultPendingComponent: options?.defaultPendingComponent,
    defaultErrorComponent: options?.defaultErrorComponent,
    defaultNotFoundComponent: options?.defaultNotFoundComponent,
  };
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
    hasDefaultParams &&
    (!(location as any).params || Object.keys((location as any).params).length === 0)
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

const TanStackProvider: React.FC<{
  storyElement: React.ReactElement;
  options: TanStackPreviewOptions;
  storyId: string;
}> = ({ storyElement, options, storyId }) => {
  const queryClient = useMemo(
    () => options.queryClient ?? new QueryClient(options.queryClientConfig),
    [options.queryClient, options.queryClientConfig]
  );

  // Use ref to hold latest storyElement without it being a memo dependency
  const storyElementRef = useRef(storyElement);
  storyElementRef.current = storyElement;

  const { router, restore } = useMemo(() => {
    const routerOptions = options.router ?? {};

    // Detect mode
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
      return { router: null, restore: () => {} };
    }

    // Instance mode: skip patching, return instance directly
    if (mode === 'instance') {
      return { router: routerOptions.instance ?? null, restore: () => {} };
    }

    // RouteTree mode
    if (mode === 'routeTree') {
      // Resolve route tree (factory or static)
      let resolvedTree: AnyRouter['routeTree'] | null = null;
      let isFactory = false;

      if (routerOptions.createRouteTree) {
        resolvedTree = routerOptions.createRouteTree();
        isFactory = true;
      } else if (routerOptions.routeTree) {
        resolvedTree = routerOptions.routeTree;
        isFactory = false;
      }

      if (!resolvedTree) {
        return { router: null, restore: () => {} };
      }

      // Patch the route tree
      const restoreFn = patchRouteTree(resolvedTree, routerOptions, isFactory);

      // Build history
      const history = buildHistory(routerOptions);

      // Build router create options
      const routerCreateOpts = buildRouterCreateOptions(routerOptions, resolvedTree, history);

      // Create router
      const createRouterFn = routerOptions.createRouter ?? createRouter;
      const createdRouter = createRouterFn(routerCreateOpts);

      // Apply default location only if not forcing not-found
      if (!routerOptions.forceNotFound) {
        applyDefaultLocation(createdRouter, routerOptions);
      }

      return { router: createdRouter, restore: restoreFn };
    }

    // Story mode: build minimal route tree inline
    const storyPath = routerOptions.storyPath ?? '/';

    const rootRoute = createRootRoute({
      component: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    } as any);

    const storyRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: storyPath,
      component: () => storyElementRef.current,
    });

    const fallbackRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '*',
      component: () => storyElementRef.current,
    });

    const routeTree = rootRoute.addChildren([storyRoute, fallbackRoute]);

    // isFactory = true (fresh routes, no restore needed)
    const restoreFn = patchRouteTree(routeTree, routerOptions, true);

    // Build history
    const history = buildHistory(routerOptions);

    // Build router create options
    const routerCreateOpts = buildRouterCreateOptions(routerOptions, routeTree, history);

    // Create router
    const createRouterFn = routerOptions.createRouter ?? createRouter;
    const createdRouter = createRouterFn(routerCreateOpts);

    // Apply default location only if not forcing not-found
    if (!routerOptions.forceNotFound) {
      applyDefaultLocation(createdRouter, routerOptions);
    }

    return { router: createdRouter, restore: restoreFn };
  }, [storyId, options]);

  // Registry + cleanup effect
  useEffect(() => {
    if (router) {
      routerRegistry.set(storyId, router);
      lastRegisteredRouter = router;
    }

    return () => {
      restore();
      routerRegistry.delete(storyId);
      if (lastRegisteredRouter === router) {
        lastRegisteredRouter = null;
      }
    };
  }, [router, storyId, restore]);

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

export const decorators: Decorator[] = [
  (Story: any, context: any) => {
    const options = (context.parameters?.tanstack ?? {}) as TanStackPreviewOptions;
    const storyElement = <Story />;
    return <TanStackProvider storyElement={storyElement} options={options} storyId={context.id} />;
  },
];

export const parameters = {
  layout: 'fullscreen',
  tanstack: {
    // surface the cancellation helper for test setup if needed
    isQueryCancelledError,
  },
};
