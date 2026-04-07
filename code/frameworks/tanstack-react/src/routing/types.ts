import type { AnyRootRoute, AnyRoute, Route, FileRoutesByPath } from '@tanstack/react-router';
import type { RouteOptions } from '@tanstack/router-core';

type StoryRoutePathForRoute<TRoute extends AnyRoute> = unknown extends TRoute['path']
  ? keyof FileRoutesByPath | (string & {})
  : TRoute['path'] extends '/'
    ? `/${string}`
    : TRoute['path'] | `${TRoute['path']}/${string}`;

export type StoryRoutePath<TRoute extends AnyRoute | undefined = undefined> =
  TRoute extends AnyRoute ? StoryRoutePathForRoute<TRoute> : keyof FileRoutesByPath | (string & {});

type StoryRouteParams<TRoute extends AnyRoute | undefined> = TRoute extends AnyRoute
  ? unknown extends TRoute['types']['allParams']
    ? Record<string, string>
    : TRoute['types']['allParams']
  : Record<string, string>;

type StoryRouteSearch<TRoute extends AnyRoute | undefined> = TRoute extends AnyRoute
  ? unknown extends TRoute['types']['fullSearchSchema']
    ? Record<string, unknown>
    : TRoute['types']['fullSearchSchema']
  : Record<string, unknown>;

export type StoryRouteFileOptions<TRoute extends AnyRoute | undefined = undefined> =
  TRoute extends AnyRoute
    ? Pick<
        TRoute['options'],
        | 'loader'
        | 'beforeLoad'
        | 'validateSearch'
        | 'loaderDeps'
        | 'context'
        | 'params'
        | 'head'
        | 'search'
        | 'parseParams'
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
      >;

export type CreateStoryRouteOptions<TRoute extends AnyRoute | undefined = undefined> =
  StoryRouteFileOptions<TRoute> & {
    path?: StoryRoutePath<TRoute>;
  };

export type StoryRouteOptions<TRoute extends AnyRoute | undefined = undefined> =
  | CreateStoryRouteOptions<TRoute>
  | AnyRoute;

export interface RouterParameters<TRoute extends AnyRoute | undefined = undefined> {
  /** A route object or route options to use for this story. */
  route?: StoryRouteOptions<TRoute>;
  /** The initial URL path to render. */
  path?: StoryRoutePath<TRoute>;
  /** URL params to interpolate into the path (e.g. `{ id: '42' }` for `/$id`). */
  params?: StoryRouteParams<TRoute>;
  /** Search/query params to append to the URL (e.g. `{ tab: 'details' }`). */
  query?: Partial<StoryRouteSearch<TRoute>>;
  /** Override the route's loader function. */
  loader?: StoryRouteFileOptions<TRoute>['loader'];
  /** Override the route's beforeLoad function. */
  beforeLoad?: StoryRouteFileOptions<TRoute>['beforeLoad'];
  /** Override the route's search params validation. */
  validateSearch?: StoryRouteFileOptions<TRoute>['validateSearch'];
  /** Override the route's loader dependencies. */
  loaderDeps?: StoryRouteFileOptions<TRoute>['loaderDeps'];
}
