import React, { type ComponentType } from 'react';
import type { Decorator, Loader } from '@storybook/react-vite';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  Route,
  RouterProvider,
  createRoute,
  RootRoute,
} from '@tanstack/react-router';
import type { Router, AnyRootRoute } from '@tanstack/react-router';
import type { RouterParameters } from './types';
import type { BaseRoute } from '@tanstack/router-core';
import { onNavigate } from '../export-mocks/spies';

export type MockRouterOptions = {
  routeTree?: AnyRootRoute;
  initialPath?: string;
};

function createInternalStoryRoute(
  Story: ComponentType,
  routeParameter?: RouterParameters['route']
): AnyRootRoute {
  if (routeParameter instanceof RootRoute) {
    // createStoryRoute() returns a root with a child route that has the loader/options.
    // Set the Story component on the child so useLoaderData() works inside it.
    const children = routeParameter.children as BaseRoute[] | undefined;
    if (children?.length) {
      children[0].update({ component: () => <Story /> });
    } else {
      routeParameter.update({ component: () => <Story /> });
    }
    return routeParameter;
  }

  if (routeParameter instanceof Route) {
    routeParameter.update({ component: () => <Story /> });
    const root = createRootRoute();
    root.addChildren([routeParameter as any]);
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

  root.addChildren([route]);
  return root;
}

export function createStoryRouter({
  routeTree,
  initialPath = '/',
}: MockRouterOptions): Router<AnyRootRoute> {
  const history = createMemoryHistory();

  console.log('init mock router with path:', initialPath);
  const router = createRouter({
    routeTree,
    history,
  });

  history.replace(initialPath);
  history.block({
    blockerFn() {
      onNavigate(history.location.pathname);
      return true;
    },
  });

  return router;
}

export const tanstackRouteDecorator: Decorator = (Story, context) => {
  const routerParams: RouterParameters = context.parameters.tanstack?.router ?? {};

  const routeOptions = routerParams.route;

  const route = createInternalStoryRoute(Story, routeOptions);

  // Auto-detect initial path from the route tree's first child if not explicitly set
  let initialPath = routerParams.path;
  if (!initialPath && route instanceof RootRoute) {
    const children = (route as any).children as BaseRoute[] | undefined;
    if (children?.length) {
      initialPath = (children[0].options as any)?.path;
    }
  }

  const router = createStoryRouter({
    routeTree: route,
    initialPath: initialPath,
  });

  return <RouterProvider router={router}></RouterProvider>;
};
