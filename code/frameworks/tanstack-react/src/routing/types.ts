import type { AnyRootRoute, Route, FileRoutesByPath } from '@tanstack/react-router';
import type { RouteOptions } from '@tanstack/router-core';

export type CreateStoryRouteOptions = Pick<
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
> & { path: keyof FileRoutesByPath | (string & {}) };

export type StoryRouteOptions = CreateStoryRouteOptions | Route | AnyRootRoute;

export interface RouterParameters {
  route?: StoryRouteOptions;
  path?: string;
}
