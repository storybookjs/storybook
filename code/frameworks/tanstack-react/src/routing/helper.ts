import {
  createRootRoute,
  createRoute,
  type RoutePathOptions,
  type AnyRootRoute,
  type AnyRoute,
  type FileRoutesByPath,
} from '@tanstack/react-router';
import type { CreateStoryRouteOptions, StoryRouteFileOptions } from './types';

function buildStoryRoute(options: CreateStoryRouteOptions): AnyRootRoute {
  const root = createRootRoute();
  // @ts-expect-error - route options. HARD to make it work when spreading obj.
  const route = createRoute({
    getParentRoute: () => root,
    ...options,
  });

  root.addChildren([route]);

  return root;
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
  pathOrOptions: CreateStoryRouteOptions<TRoute>
): AnyRootRoute;
export function createStoryRoute<TRoute extends AnyRoute = AnyRoute>(
  pathOrOptions: keyof FileRoutesByPath
): (options?: StoryRouteFileOptions) => AnyRootRoute;
export function createStoryRoute<TRoute extends AnyRoute = AnyRoute>(
  pathOrOptions: keyof FileRoutesByPath | (string & {}) | CreateStoryRouteOptions<TRoute>
): AnyRootRoute | ((options?: StoryRouteFileOptions) => AnyRootRoute) {
  // String path — return a curried builder
  if (typeof pathOrOptions === 'string') {
    return (options?: StoryRouteFileOptions) => {
      return buildStoryRoute({ ...options, path: pathOrOptions });
    };
  }
  // Flat options object
  return buildStoryRoute(pathOrOptions);
}
