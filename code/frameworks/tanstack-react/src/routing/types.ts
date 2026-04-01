import type { AnyRootRoute, AnyRoute, Route, FileRoutesByPath } from '@tanstack/react-router';
import type { RouteOptions } from '@tanstack/router-core';

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
    path: keyof FileRoutesByPath | (string & {});
  };

export type StoryRouteOptions<TRoute extends AnyRoute | undefined = undefined> =
  | CreateStoryRouteOptions<TRoute>
  | Route
  | AnyRoute;

export interface RouterParameters<TRoute extends AnyRoute | undefined = undefined> {
  route?: StoryRouteOptions<TRoute>;
  path?: string;
}
