import {
  createRootRoute,
  createRoute,
  type AnyRootRoute,
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
 * Supports two call signatures that mirror TanStack Router's API:
 *
 * builder form (like `createFileRoute`):
 * ```ts
 * createStoryRoute('/about')({ loader: async () => fetchData() })
 * ```
 *
 * flat form:
 * ```ts
 * createStoryRoute({ path: '/about', loader: async () => fetchData() })
 * ```
 */
export function createStoryRoute(
  pathOrOptions: keyof FileRoutesByPath | (string & {})
): (options?: StoryRouteFileOptions) => AnyRootRoute;
export function createStoryRoute(pathOrOptions: CreateStoryRouteOptions): AnyRootRoute;
export function createStoryRoute(
  pathOrOptions: keyof FileRoutesByPath | (string & {}) | CreateStoryRouteOptions
): AnyRootRoute | ((options?: StoryRouteFileOptions) => AnyRootRoute) {
  if (typeof pathOrOptions === 'string') {
    return (options?: StoryRouteFileOptions) => {
      return buildStoryRoute({ ...options, path: pathOrOptions });
    };
  }
  return buildStoryRoute(pathOrOptions);
}
