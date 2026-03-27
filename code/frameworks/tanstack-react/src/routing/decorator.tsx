import React from 'react';
import type { Decorator, Loader } from '@storybook/react-vite';
import { RouterProvider } from '@tanstack/react-router';
import type { Router, AnyRootRoute } from '@tanstack/react-router';
import { createMockRootRouteFromStory, createMockRouter } from '../export-mocks';
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
export const tanstackRouteLoader: Loader = ({ parameters }) => {
  const routerParams: RouterParameters = parameters.tanstack?.router ?? {};

  // We pass a placeholder component — the decorator will provide RouterProvider
  // which renders the actual Story via the route tree.
  const route = createMockRootRouteFromStory(() => null, routerParams.route);

  currentRouter = createMockRouter({
    routeTree: route,
    initialPath: routerParams.path,
  });
};

export const tanstackRouteDecorator: Decorator = (Story, context) => {
  const routerParams: RouterParameters = context.parameters.tanstack?.router ?? {};

  // Recreate the route tree with the actual Story component
  const route = createMockRootRouteFromStory(Story, routerParams.route);

  const router = createMockRouter({
    routeTree: route,
    initialPath: routerParams.path,
  });

  currentRouter = router;

  React.useEffect(() => {
    return () => {
      currentRouter = null;
    };
  }, []);

  return <RouterProvider router={router}></RouterProvider>;
};
