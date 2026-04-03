import React, { type ComponentType } from 'react';
import type { Decorator } from '@storybook/react-vite';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  Route,
  RouterProvider,
  createRoute,
  RootRoute,
  interpolatePath,
  defaultStringifySearch,
} from '@tanstack/react-router';
import type { Router, AnyRootRoute } from '@tanstack/react-router';
import type { RouterParameters } from './types';
import type { BaseRoute } from '@tanstack/router-core';
import { onNavigate } from '../export-mocks/spies';

export type MockRouterOptions = {
  routeTree?: AnyRootRoute;
  initialPath?: string;
};

/**
 * Checks whether a value is a TanStack Router Route instance.
 */
function isRoute(value: unknown): value is InstanceType<typeof Route> {
  return value instanceof Route || value instanceof RootRoute;
}

function createInternalStoryRoute(
  Story: ComponentType,
  routeParameter?: RouterParameters['route']
): AnyRootRoute {
  console.log('paameter ', routeParameter);
  if (routeParameter instanceof RootRoute) {
    const children = routeParameter.children as BaseRoute[] | undefined;
    if (children?.length) {
      children[0].update({ component: () => <Story /> });
    } else {
      routeParameter.update({ component: () => <Story /> });
    }
    return routeParameter;
  }

  if (routeParameter instanceof Route) {
    const root = createRootRoute();
    const { id: _id, ...routeOpts } = (routeParameter as any).options ?? {};

    const child = createRoute({
      ...routeOpts,
      component: () => <Story />,
      getParentRoute: () => root,
    });
    root.addChildren([child]);
    return root;
  }

  const root = createRootRoute();

  // @ts-expect-error route options. HARD to make it work when spreading obj.
  const route = createRoute({
    component: () => <Story />,
    ...routeParameter,
    path: '/',
    getParentRoute: () => root,
  });
  console.log('???');
  root.addChildren([route]);
  return root;
}

export function createStoryRouter({
  routeTree,
  initialPath = '/',
}: MockRouterOptions): Router<AnyRootRoute> {
  const history = createMemoryHistory({
    initialEntries: [initialPath],
  });

  console.log('init mock router with path:', initialPath);
  const router = createRouter({
    routeTree,
    history,
    defaultNotFoundComponent(props) {
      return <div>Route not found: {props.routeId}</div>;
    },
  });
  history.push(initialPath);

  history.block({
    blockerFn() {
      onNavigate(history.location.pathname);
      return true;
    },
  });
  console.log(router, routeTree);
  return router;
}

export const tanstackRouteDecorator: Decorator = (Story, context) => {
  const routerParams: RouterParameters = context.parameters.tanstack?.router ?? {};

  const routeOptions = routerParams.route || context.route;

  // we override certain route options from the story parameters if they are set
  if (routeOptions && isRoute(routeOptions)) {
    const overrides: Record<string, unknown> = {};
    if (routerParams.loader) overrides.loader = routerParams.loader;
    if (routerParams.beforeLoad) overrides.beforeLoad = routerParams.beforeLoad;
    if (routerParams.validateSearch) overrides.validateSearch = routerParams.validateSearch;
    if (routerParams.loaderDeps) overrides.loaderDeps = routerParams.loaderDeps;

    if (Object.keys(overrides).length > 0) {
      (routeOptions as InstanceType<typeof Route>).update(overrides);
    }
  }

  const route = createInternalStoryRoute(Story, routeOptions);

  // Auto-detect initial path from the route or its first child if not explicitly set
  let initialPath = routerParams.path;
  if (!initialPath) {
    if (routeOptions && isRoute(routeOptions) && !(routeOptions instanceof RootRoute)) {
      initialPath = (routeOptions as any).options?.path ?? (routeOptions as any).path;
    } else if (route instanceof RootRoute) {
      const children = (route as any).children as BaseRoute[] | undefined;
      if (children?.length) {
        initialPath = (children[0].options as any)?.path;
      }
    }
  }

  // Interpolate params into the path and append query/search params
  let resolvedPath = interpolatePath({
    path: initialPath ?? '/',
    params: routerParams.params ?? {},
  }).interpolatedPath;
  console.log('interpolated path:', resolvedPath);
  const search = routerParams.query ? defaultStringifySearch(routerParams.query) : '';
  if (search) {
    resolvedPath += search;
  }

  const router = createStoryRouter({
    routeTree: route,
    initialPath: resolvedPath,
  });

  return <RouterProvider router={router}></RouterProvider>;
};
