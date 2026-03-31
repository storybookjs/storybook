import type { AnyRootRoute, Route } from '@tanstack/react-router';
import type { RouteOptions } from '@tanstack/router-core';

export type CreateStoryRouteOptions = Pick<
  RouteOptions<any>,
  'loader' | 'beforeLoad' | 'validateSearch' | 'loaderDeps' | 'loader' | 'context'
>;

export type StoryRouteOptions = CreateStoryRouteOptions | Route | AnyRootRoute;

export interface RouterParameters {
  route?: StoryRouteOptions;
  path?: string;
}
