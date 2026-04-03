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
  }
};
