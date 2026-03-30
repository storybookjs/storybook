import React from 'react';
import type { Decorator, Loader } from '@storybook/react-vite';
import { createRootRoute, FileRoute, Route, RouterProvider } from '@tanstack/react-router';
import type { Router, AnyRootRoute } from '@tanstack/react-router';
import { createStoryRoute, createMockRouter as createStoryRouter } from '../export-mocks';
import type { RouterParameters } from './types';

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
  currentRouter = await createStoryRouter({
    initialPath: routerParams.path,
  });
};

export const tanstackRouteDecorator: Decorator = (Story, context) => {
  const routerParams: RouterParameters = context.parameters.tanstack?.router ?? {};

  const routeOptions = routerParams.route;

  const route = createStoryRoute(Story, routeOptions);

  const router = createStoryRouter({
    routeTree: route,
    initialPath: routerParams.path,
  });

  return <RouterProvider router={router}></RouterProvider>;
};
