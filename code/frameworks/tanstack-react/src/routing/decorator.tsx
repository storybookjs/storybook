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
import type { RouterParameters } from './types.ts';

export type MockRouterOptions = {
  Story: ComponentType;
  context: Parameters<Decorator>[1];
};

/**
 * Checks whether a value is a TanStack Router Route instance.
 */
function isRoute(value: unknown): value is InstanceType<typeof Route> {
  // todo: check if works with multiple versions of the router in a monorepo
  return value instanceof Route || value instanceof RootRoute;
}

function getRouteFromContext(
  Story: ComponentType,
  context: Parameters<Decorator>[1]
): AnyRootRoute {
  const metaRoute = context.route as Route | RootRoute | undefined;
  const routerParameters: RouterParameters = context.parameters.tanstack?.router ?? {};
  const routerParameterRoute = routerParameters.route;

  const { route: _route, ...routeOverrides } = routerParameters ?? {};

  const resolvedRoute = isRoute(routerParameterRoute)
    ? routerParameterRoute
    : isRoute(metaRoute)
      ? metaRoute
      : undefined;

  if (resolvedRoute instanceof RootRoute) {
    // Clone to avoid mutating the original route object across stories.
    const clonedRoot = createRootRoute({ ...(resolvedRoute as any).options });
    const children = resolvedRoute.children as Route[] | undefined;
    if (children?.length) {
      const clonedChildren = children.map((child) => {
        const { id: _id, getParentRoute: _g, ...childOpts } = (child as any).options ?? {};
        return createRoute({
          ...childOpts,
          ...routeOverrides,
          component: () => <Story />,
          getParentRoute: () => clonedRoot,
        });
      });
      clonedRoot.addChildren(clonedChildren);
    } else {
      clonedRoot.update({ component: () => <Story />, ...routeOverrides } as any);
    }
    return clonedRoot;
  }

  if (resolvedRoute instanceof Route) {
    const root = createRootRoute();
    const { id: _id, ...routeOpts } = (resolvedRoute as any).options ?? {};

    const child = createRoute({
      ...routeOpts,
      ...routeOverrides,
      component: () => <Story />,
      getParentRoute: () => root,
    });

    root.addChildren([child]);
    return root;
  }

  // No route instance — create from plain options or default.
  const root = createRootRoute();
  // @ts-expect-error route options spread
  const child = createRoute({
    component: () => <Story />,
    ...routerParameterRoute,
    path: (routerParameterRoute as any)?.path ?? '/',
    getParentRoute: () => root,
  });
  root.addChildren([child]);
  return root;
}

function createStoryRouter({ Story, context }: MockRouterOptions): Router<AnyRootRoute> {
  const routerParameters: RouterParameters = context.parameters.tanstack?.router ?? {};

  const routeTree: AnyRootRoute = getRouteFromContext(Story, context);

  const inferredPath =
    routerParameters?.path ||
    routeTree.children?.[0]?.fullPath ||
    routeTree.children?.[0]?.path ||
    routeTree.children?.[0]?.options?.path;

  const initialPath = inferredPath ?? '/';

  // Interpolate params into the path and append query/search params.
  let resolvedPath = interpolatePath({
    path: initialPath,
    params: routerParameters?.params ?? {},
  }).interpolatedPath;
  const search = routerParameters?.query ? defaultStringifySearch(routerParameters.query) : '';
  if (search) {
    resolvedPath += search;
  }
  const history = createMemoryHistory({
    initialEntries: [resolvedPath],
  });

  history.replace(resolvedPath);

  const router = createRouter({
    routeTree,
    history,
    defaultNotFoundComponent(props) {
      return <div>Route not found: {props.routeId}</div>;
    },
  });
  return router;
}

export const tanstackRouteDecorator: Decorator = (Story, context) => {
  const router = createStoryRouter({
    Story,
    context,
  });

  return <RouterProvider router={router}></RouterProvider>;
};
