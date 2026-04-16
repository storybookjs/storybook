import type { LoaderFunction, Renderer } from 'storybook/internal/types';
import { Route, RootRoute } from '@tanstack/react-router';

import type { RouterParameters } from './types.ts';

function isRoute(value: unknown): value is InstanceType<typeof Route> {
  return value instanceof Route || value instanceof RootRoute;
}

function getComponentFromRoute(route: InstanceType<typeof Route>) {
  if (route.options?.component) {
    return route.options.component;
  }

  if (route instanceof RootRoute) {
    return (route.children as Route[] | undefined)?.[0]?.options?.component;
  }

  return undefined;
}

/**
 * Loader that extracts the render component from a TanStack Route when the
 * story uses either `component: Route` or `parameters.tanstack.router.route`.
 */
export const routeComponentLoader: LoaderFunction<Renderer> = (context) => {
  const componentRoute = isRoute(context.component) ? context.component : undefined;
  const routerParameters: RouterParameters = context.parameters.tanstack?.router ?? {};
  const parameterRoute = isRoute(routerParameters.route) ? routerParameters.route : undefined;
  const resolvedRoute = parameterRoute ?? componentRoute;

  if (!resolvedRoute) {
    return;
  }

  if (!context.component) {
    const component = getComponentFromRoute(resolvedRoute);

    if (component && (componentRoute || !context.component)) {
      context.component = component;
    }
  }

  if (!context.route) {
    // don't override parameters route with component route, as parameters take priority
    context.route = resolvedRoute;
  }
};
