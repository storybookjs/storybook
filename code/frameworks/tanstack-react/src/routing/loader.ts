import type { Decorator } from '@storybook/react';
import type { LoaderFunction, Renderer } from 'storybook/internal/types';
import { Route, RootRoute } from '@tanstack/react-router';

function isRoute(value: unknown): value is InstanceType<typeof Route> {
  return value instanceof Route || value instanceof RootRoute;
}

/**
 * Loader that detects when a TanStack Route is passed as `component` in meta, if so, extract the component from route and set the route as a parameter for the story.
 */
export const routeComponentLoader: LoaderFunction<Renderer> = (context) => {
  if (isRoute(context.component)) {
    const route = context.component;
    const component = route.options?.component;
    if (component) {
      context.component = component;
    }
    if (!context.route) {
      context.route = route;
    }
    // Apply route options from args to the route instance
    const routeOptionKeys = [
      'loader',
      'beforeLoad',
      'validateSearch',
      'loaderDeps',
      'context',
      'params',
      'head',
      'search',
      'parseParams',
    ] as const;
    const overrides: Record<string, unknown> = {};

    for (const key of routeOptionKeys) {
      if (key in (context.args ?? {}) && context.args[key] !== undefined) {
        overrides[key] = context.args[key];
      }
    }

    if (Object.keys(overrides).length > 0) {
      route.update(overrides);
    }
  }
};
