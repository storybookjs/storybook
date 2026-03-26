import type { RouteOptions } from '@tanstack/router-core';

export type RouteParameters = Pick<
  RouteOptions<any>,
  'loader' | 'beforeLoad' | 'validateSearch' | 'loaderDeps' | 'loader'
>;
export interface RouterParameters {
  route?: RouteParameters;
  path?: string;
}
