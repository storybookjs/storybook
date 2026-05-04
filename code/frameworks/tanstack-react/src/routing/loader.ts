import type { LoaderFunction, Renderer } from 'storybook/internal/types';
import { type Route, RootRoute } from '@tanstack/react-router';

import type { RouterParameters } from './types.ts';
import { isRoute } from './utils.ts';

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
 * story uses `parameters.tanstack.router.route`.
 */
export const routeComponentLoader: LoaderFunction<Renderer> = (context) => {
  const routerParameters: RouterParameters = context.parameters.tanstack?.router ?? {};
  const parameterRoute = isRoute(routerParameters.route) ? routerParameters.route : undefined;

  if (!parameterRoute) {
    return;
  }

  if (!context.component) {
    const component = getComponentFromRoute(parameterRoute);

    if (component && !context.component) {
      context.component = component;
    }
  }

  if (!context.route) {
    // don't override parameters route with component route, as parameters take priority
    context.route = parameterRoute;
  }
};
