import type { AnyRootRoute, AnyRoute, Route, FileRoutesByPath } from '@tanstack/react-router';
import type { RouteOptions } from '@tanstack/router-core';

type StoryRoutePathForRoute<TRoute extends AnyRoute> = string extends TRoute['path']
  ? keyof FileRoutesByPath | (string & {})
  : TRoute['path'] extends '/'
    ? `/${string}`
    : TRoute['path'] | `${TRoute['path']}/${string}`;

export type StoryRoutePath<TRoute extends AnyRoute | undefined = undefined> =
  TRoute extends AnyRoute ? StoryRoutePathForRoute<TRoute> : keyof FileRoutesByPath | (string & {});

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
    path: StoryRoutePath<TRoute>;
  };

export type StoryRouteOptions<TRoute extends AnyRoute | undefined = undefined> =
  | CreateStoryRouteOptions<TRoute>
  | AnyRoute;

export interface RouterParameters<TRoute extends AnyRoute | undefined = undefined> {
  route?: StoryRouteOptions<TRoute>;
  path?: StoryRoutePath<TRoute>;
}
