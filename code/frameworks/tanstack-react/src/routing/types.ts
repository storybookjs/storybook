import type { FileRoute, Route } from '@tanstack/react-router';
import type { RouteOptions } from '@tanstack/router-core';

export type RouteParameters = Pick<
  RouteOptions<any>,
  'loader' | 'beforeLoad' | 'validateSearch' | 'loaderDeps' | 'loader' | 'context'
>;
export interface RouterParameters {
  route?: RouteParameters | Route;
  path?: string;
}
