import type { AnyRootRoute, Route, FileRoutesByPath } from '@tanstack/react-router';
import type { RouteOptions } from '@tanstack/router-core';

export type StoryRouteFileOptions = Pick<
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

export type CreateStoryRouteOptions = StoryRouteFileOptions & {
  path: keyof FileRoutesByPath | (string & {});
};

export type StoryRouteOptions = CreateStoryRouteOptions | Route | AnyRootRoute;

export interface RouterParameters {
  route?: StoryRouteOptions;
  path?: string;
}
