import type { AnyRootRoute, AnyRoute, Route, FileRoutesByPath } from '@tanstack/react-router';
import type { RouteOptions } from '@tanstack/router-core';

export type IsRoute<T> = T extends AnyRoute
  ? true
  : T extends FileRoutesByPath[keyof FileRoutesByPath]
    ? true
    : false;

type StoryRoutePathForRoute<TRoute> = TRoute extends { path: infer P }
  ? unknown extends P
    ? keyof FileRoutesByPath | (string & {})
    : P extends '/'
      ? `/${string}`
      : P extends string
        ? P | `${P}/${string}`
        : keyof FileRoutesByPath | (string & {})
  : keyof FileRoutesByPath | (string & {});

export type StoryRoutePath<TRoute = undefined> =
  IsRoute<TRoute> extends true
    ? StoryRoutePathForRoute<TRoute>
    : keyof FileRoutesByPath | (string & {});

type StoryRouteParams<TRoute> =
  IsRoute<TRoute> extends true
    ? TRoute extends { types: { allParams: infer P } }
      ? unknown extends P
        ? Record<string, string>
        : P
      : Record<string, string>
    : Record<string, string>;

type StoryRouteSearch<TRoute> =
  IsRoute<TRoute> extends true
    ? TRoute extends { types: { fullSearchSchema: infer S } }
      ? unknown extends S
        ? Record<string, unknown>
        : S
      : Record<string, unknown>
    : Record<string, unknown>;

export type StoryRouteFileOptions<TRoute = undefined> =
  IsRoute<TRoute> extends true
    ? TRoute extends { options: infer O }
      ? Pick<
          O,
          Extract<
            keyof O,
            | 'loader'
            | 'beforeLoad'
            | 'validateSearch'
            | 'loaderDeps'
            | 'context'
            | 'params'
            | 'head'
            | 'search'
            | 'parseParams'
            | 'context'
          >
        >
      : Pick<
          RouteOptions<unknown>,
          | 'loader'
          | 'beforeLoad'
          | 'validateSearch'
          | 'loaderDeps'
          | 'context'
          | 'params'
          | 'head'
          | 'search'
          | 'parseParams'
          | 'context'
        >
    : Pick<
        RouteOptions<unknown>,
        | 'loader'
        | 'beforeLoad'
        | 'validateSearch'
        | 'loaderDeps'
        | 'context'
        | 'params'
        | 'head'
        | 'search'
        | 'parseParams'
        | 'context'
      >;

export type CreateStoryRouteOptions<TRoute = undefined> = StoryRouteFileOptions<TRoute> & {
  path?: StoryRoutePath<TRoute>;
};

export type StoryRouteOptions<TRoute = undefined> = CreateStoryRouteOptions<TRoute> | AnyRoute;

/**
 * Extracts a single route option type directly from the route's options,
 * avoiding indexing into deferred conditional types (which causes DTS errors).
 */
type RouteOption<TRoute, K extends string> =
  IsRoute<TRoute> extends true
    ? TRoute extends { options: Record<K, infer V> }
      ? V
      : undefined
    : K extends keyof RouteOptions<unknown>
      ? RouteOptions<unknown>[K]
      : undefined;

export interface RouterParameters<TRoute = undefined> {
  /** A route object or route options to use for this story. */
  route?: StoryRouteOptions<TRoute>;
  /** The initial URL path to render. */
  path?: StoryRoutePath<TRoute>;
  /** URL params to interpolate into the path (e.g. `{ id: '42' }` for `/$id`). */
  params?: StoryRouteParams<TRoute>;
  /** Search/query params to append to the URL (e.g. `{ tab: 'details' }`). */
  query?: Partial<StoryRouteSearch<TRoute>>;
  /** Override the route's loader function. */
  loader?: RouteOption<TRoute, 'loader'>;
  /** Override the route's beforeLoad function. */
  beforeLoad?: RouteOption<TRoute, 'beforeLoad'>;
  /** Override the route's search params validation. */
  validateSearch?: RouteOption<TRoute, 'validateSearch'>;
  /** Override the route's loader dependencies. */
  loaderDeps?: RouteOption<TRoute, 'loaderDeps'>;
  /** Override the route's context. */
  context?: Record<string, unknown>;
}
