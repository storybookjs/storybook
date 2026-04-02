import { createRootRoute, createRoute, type AnyRoute } from '@tanstack/react-router';
import type { CreateStoryRouteOptions, StoryRouteFileOptions, StoryRoutePath } from './types';

function buildStoryRoute<TRoute extends AnyRoute = AnyRoute>(
  options: CreateStoryRouteOptions<TRoute>
): TRoute {
  const root = createRootRoute();
  const route = createRoute({
    getParentRoute: () => root,
    ...options,
  });

  root.addChildren([route]);

  return root as unknown as TRoute;
}

/**
 * Creates a mock route tree for use in Storybook stories.
 *
 * Supports two call signatures:
 *
 * Type-safe curried form (pass the Route type to infer loader data, search params, etc.):
 * ```ts
 * import { Route } from '../routes/about'
 * createStoryRoute<typeof Route>('/about')({ loader: async () => ({ title: 'Mock' }) })
 * ```
 *
 * Flat form:
 * ```ts
 * createStoryRoute({ path: '/about', loader: async () => fetchData() })
 * ```
 */

export function createStoryRoute<TRoute extends AnyRoute = AnyRoute>(
  path: StoryRoutePath<TRoute>
): (options?: StoryRouteFileOptions<TRoute>) => TRoute;
export function createStoryRoute<TRoute extends AnyRoute = AnyRoute>(
  options: CreateStoryRouteOptions<TRoute>
): TRoute;
export function createStoryRoute<TRoute extends AnyRoute = AnyRoute>(
  pathOrOptions: StoryRoutePath<TRoute> | CreateStoryRouteOptions<TRoute>
): TRoute | ((options?: StoryRouteFileOptions<TRoute>) => TRoute) {
  // String path — return a curried builder
  if (typeof pathOrOptions === 'string') {
    return (options?: StoryRouteFileOptions<TRoute>) => {
      const routeOptions = {
        ...(options ?? {}),
        path: pathOrOptions,
      } as CreateStoryRouteOptions<TRoute>;
      return buildStoryRoute(routeOptions);
    };
  }
  // Flat options object
  return buildStoryRoute(pathOrOptions);
}
