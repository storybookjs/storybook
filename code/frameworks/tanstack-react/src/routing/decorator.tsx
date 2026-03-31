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
import { BaseRoute } from '@tanstack/router-core';
import { onNavigate } from '../export-mocks/spies';

export type MockRouterOptions = {
  routeTree?: AnyRootRoute;
  initialPath?: string;
};

function createInternalStoryRoute(
  Story: ComponentType,
  routeParameter?: RouterParameters['route']
): AnyRootRoute {
  if (routeParameter instanceof RootRoute || routeParameter instanceof Route) {
    console.log('??');
    routeParameter.update({
      component: () => <Story />,
    });

    return routeParameter as RootRoute;
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

let currentRouter: Router<AnyRootRoute> | null = null;

/**
 * Returns the current story's mock `Router` instance.
 *
 * Available in `beforeEach`, `play`, and inside decorators/components.
 * Useful for inspecting router state or configuring the router before render.
 *
 * ```ts
 * import { getRouter } from '@storybook/tanstack-react';
 *
 * export const MyStory = {
 *   async beforeEach() {
 *     const router = getRouter();
 *     // inspect or configure the router
 *   },
 * };
 * ```
 */
export function getRouter(): Router<AnyRootRoute> {
  if (!currentRouter) {
    throw new Error('Router is not available. Make sure the TanStack Router decorator is active.');
  }
  return currentRouter;
}

/**
 * Loader that creates the mock router per story render.
 * Runs before `beforeEach`, so the router is accessible via `getRouter()`.
 */
export const tanstackRouteLoader: Loader = async ({ parameters }) => {
  const routerParams: RouterParameters = parameters.tanstack?.router ?? {};

  // If no explicit routeTree is provided, createMockRouter will
  // dynamically import the user's #/routeTree.gen.
  currentRouter = createStoryRouter({
    initialPath: routerParams.path,
  });
};

export const tanstackRouteDecorator: Decorator = (Story, context) => {
  const routerParams: RouterParameters = context.parameters.tanstack?.router ?? {};

  const routeOptions = routerParams.route;

  const route = createInternalStoryRoute(Story, routeOptions);

  const router = createStoryRouter({
    routeTree: route,
    initialPath: routerParams.path,
  });

  return <RouterProvider router={router}></RouterProvider>;
};
